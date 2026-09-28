"""Gemini client, document extraction and translation."""
import json
import os
import threading

from google import genai
from google.genai import types

from schemas import EXTRACTION_MODELS, TripAdvice

LANGUAGES = {
    "en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "kn": "Kannada",
    "ml": "Malayalam", "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati",
    "ms": "Malay", "zh": "Simplified Chinese", "ar": "Arabic",
}


def model_name():
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


# One shared client. A genai.Client closes its HTTP connection when garbage-collected, so a throwaway
# client (e.g. `get_client().models...` racing in parallel threads) fails with "client has been closed".
_client = None
_client_lock = threading.Lock()


def get_genai_client():
    global _client
    with _client_lock:
        if _client is None:
            _client = _new_client()
        return _client


def _new_client():
    use_vertex = os.getenv("USE_VERTEX_AI", "false").lower() in ("true", "1", "yes")
    project = os.getenv("GCP_PROJECT_ID")
    location = os.getenv("GCP_LOCATION", "us-central1")
    api_key = os.getenv("GEMINI_API_KEY")

    if use_vertex or project:
        if not project:
            raise ValueError("GCP_PROJECT_ID must be set in .env when using Vertex AI.")
        return genai.Client(vertexai=True, project=project, location=location)
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not set in backend/.env.")
    return genai.Client(api_key=api_key)


EXTRACT_PROMPT = (
    "You are reading a traveller's {doc} ({hint}). Extract only values printed on the document; "
    "never guess. Use null for anything missing. Dates as YYYY-MM-DD, times as HH:MM 24-hour local time. "
    "Keep names exactly as spelled on the document, without titles like MR/MRS. "
    "For airports give the 3-letter IATA code and the country the airport is in."
)
DOC_HINTS = {
    "ticket": "airline e-ticket / itinerary: list every flight segment in order, including return flights",
    "passport": "passport data page; prefer the printed fields and use the MRZ to confirm",
    "visa": "visa or e-visa approval",
}


def extract_document(content: bytes, mime_type: str, doc_type: str) -> dict:
    model = EXTRACTION_MODELS[doc_type]
    response = get_genai_client().models.generate_content(
        model=model_name(),
        contents=[
            types.Part.from_bytes(data=content, mime_type=mime_type),
            EXTRACT_PROMPT.format(doc=doc_type, hint=DOC_HINTS[doc_type]),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json", response_schema=model, temperature=0,
        ),
    )
    return model.model_validate_json(response.text).model_dump()


def translate(texts: dict[str, str], lang: str) -> dict[str, str]:
    """Translate a {key: english_text} map, keeping keys and {placeholders} intact."""
    if lang == "en" or not texts:
        return dict(texts)
    prompt = (
        f"Translate the JSON values into {LANGUAGES.get(lang, lang)} for elderly first-time flyers from India. "
        "Use simple, warm, everyday words. Keep the JSON keys unchanged. Copy these exactly as written, in Latin "
        "letters, never transliterated: people's names, passport/visa/ticket numbers, booking codes, flight numbers, "
        "airport codes, {placeholders}, times and amounts (spelling differences in names matter). Return only JSON.\n\n"
        + json.dumps(texts, ensure_ascii=False)
    )
    response = get_genai_client().models.generate_content(
        model=model_name(),
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json", temperature=0.2,
            thinking_config=types.ThinkingConfig(thinking_budget=0),  # translation needs no reasoning; much faster
        ),
    )
    out = json.loads(response.text)
    # Fall back to English for any key the model dropped.
    return {k: out.get(k) if isinstance(out.get(k), str) else v for k, v in texts.items()}


ADVICE_PROMPT = """You help elderly first-time flyers prepare for an international trip. Trip facts (JSON):
{context}

Give advice that is SPECIFIC to these countries, airports, passports and this visa. Do not repeat these generic
items, the app already shows them: {generic}. The app also already checks visa dates and passport validity, and
its airport steps already say to follow signs, show passport and boarding pass, use security trays, watch the gate
screens and exchange money. Never repeat any of that: every item and tip must name something that is true only for
these countries or airports.

items (3 to 6): things to do before the trip for THIS destination and route, for example an official online
arrival card or entry registration (name the authority and say it must be done only on the official
government website), customs rules that commonly catch travellers from the origin country (food, medicines,
cash limits), transit visa or transfer rules, local currency, plug type if different from the origin country.
Use group t3 for tasks to finish days before, t1 for packing the day before, t0 for the travel day.

emigration_tips, transit_tips, arrival_tips, customs_tips: 0 to 3 short tips each, for the matching airport step.

Rules: plain simple English, short sentences. Only include requirements you are confident exist for these
countries; if a detail may have changed, tell them to confirm on the official website. Never invent fees,
URLs, phone numbers or deadlines you are unsure of."""


def trip_advice(context: dict, generic_titles: list[str]) -> dict:
    """Route-specific checklist items and airport tips, as TripAdvice JSON."""
    response = get_genai_client().models.generate_content(
        model=model_name(),
        contents=ADVICE_PROMPT.format(context=json.dumps(context, ensure_ascii=False),
                                      generic="; ".join(generic_titles)),
        config=types.GenerateContentConfig(
            response_mime_type="application/json", response_schema=TripAdvice, temperature=0.2,
            thinking_config=types.ThinkingConfig(thinking_budget=1024),
        ),
    )
    return TripAdvice.model_validate_json(response.text).model_dump()


HELPER_RULES = ("You help an elderly first-time flyer at the airport. Use short, simple, warm sentences. "
                "Never invent gate numbers, times or rules that are not in the trip facts; if unsure, tell them "
                "to ask airport staff or the information desk.")


def _media_part(content: bytes | None, mime: str | None):
    return [types.Part.from_bytes(data=content, mime_type=mime)] if content else []


def ask(trip_facts: dict, lang: str, text: str = "", audio: bytes | None = None, mime: str | None = None) -> dict:
    """Voice/text concierge: answer the traveller's question from their own trip data, in their language."""
    from schemas import AskResult
    language = LANGUAGES.get(lang, "English")
    prompt = (f"{HELPER_RULES}\nTrip facts (JSON): {json.dumps(trip_facts, ensure_ascii=False)}\n\n"
              + (f"The traveller asked (typed): {text}\n" if text else "The traveller's question is in the audio.\n")
              + f"Write the question and a 1-4 sentence answer in {language}. Keep flight numbers, gates and times as digits.")
    response = get_genai_client().models.generate_content(
        model=model_name(), contents=[*_media_part(audio, mime), prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=AskResult,
                                           temperature=0.3, thinking_config=types.ThinkingConfig(thinking_budget=512)),
    )
    return AskResult.model_validate_json(response.text).model_dump()


def to_english(lang: str, text: str = "", audio: bytes | None = None, mime: str | None = None, context: str = "") -> dict:
    """Turn what the traveller says (any language, text or audio) into one polite English sentence for staff."""
    from schemas import StaffPhrase
    prompt = (f"A first-time flyer who speaks {LANGUAGES.get(lang, lang)} wants to tell airport staff something. "
              + (f"They typed: {text}\n" if text else "Their message is in the audio.\n")
              + f"Context: {context}\nWrite 'original' in their language and 'english' as one short polite English "
              "sentence, first person, that staff will understand. Do not add facts they did not say.")
    response = get_genai_client().models.generate_content(
        model=model_name(), contents=[*_media_part(audio, mime), prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=StaffPhrase,
                                           temperature=0.2, thinking_config=types.ThinkingConfig(thinking_budget=0)),
    )
    return StaffPhrase.model_validate_json(response.text).model_dump()


def read_boarding_pass(content: bytes, mime: str) -> dict:
    from schemas import BoardingPassData
    prompt = ("This is a boarding pass. Extract the fields exactly as printed (null if missing, never guess). "
              "Times as HH:MM 24-hour. In 'fields' list every printed field with a plain-English meaning for an "
              "elderly first-time flyer (e.g. GATE: where you board; BOARDING: be at the gate by this time; "
              "ZONE/GROUP: wait until this group is called).")
    response = get_genai_client().models.generate_content(
        model=model_name(), contents=[types.Part.from_bytes(data=content, mime_type=mime), prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=BoardingPassData,
                                           temperature=0),
    )
    return BoardingPassData.model_validate_json(response.text).model_dump()
