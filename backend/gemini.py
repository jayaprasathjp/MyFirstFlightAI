"""Gemini client, document extraction and translation."""
import json
import os
import threading

from google import genai
from google.genai import types

from schemas import EXTRACTION_MODELS

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
