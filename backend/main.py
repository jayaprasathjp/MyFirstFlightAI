import os
import json
import mimetypes
import re
from datetime import date, datetime, timezone
from dateutil.relativedelta import relativedelta
import firebase_admin
import httpx
from firebase_admin import auth as firebase_auth, initialize_app
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.responses import Response
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token
from google.cloud import speech_v1, texttospeech_v1, translate_v3
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types
from secure_store import delete_emergency_contact, delete_passport, delete_user_data, load_emergency_contact, load_profile, remove_expired_passports, save_emergency_contact, save_profile, store_passport

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="MyFirstFlightAI Backend API",
    description="FastAPI Backend integrated with Google Gemini Chat via Vertex AI / Google AI Studio",
    version="1.0.0"
)

# Enable CORS for frontend development and production
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str # "user" or "model"
    content: str

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=3000)
    history: Optional[List[ChatMessage]] = []
    language: str = "en"

class TravellerDocuments(BaseModel):
    name: str = ""
    assistance: str = ""
    documents: dict = Field(default_factory=dict)

class TripValidationRequest(BaseModel):
    origin: Optional[str] = None
    destination: str
    departure_date: date
    return_date: Optional[date] = None
    travellers: List[TravellerDocuments]

class ProfileRequest(BaseModel):
    language: str = "en"
    trip: dict = Field(default_factory=dict)
    travellers: list[dict] = Field(default_factory=list)
    trip_history: list[dict] = Field(default_factory=list)

class FlightStatusRequest(BaseModel):
    flight_iata: str
    flight_date: date

class TranslationRequest(BaseModel):
    target_language: str
    texts: list[str]
    source_language: str = "en"

class SpeechSynthesisRequest(BaseModel):
    text: str
    language: str

class EmergencyContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=7, max_length=24)
    relationship: str = Field(default="", max_length=80)

    @field_validator("phone")
    @classmethod
    def phone_has_valid_digit_count(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if not 7 <= len(digits) <= 15:
            raise ValueError("Enter a phone number with 7 to 15 digits.")
        return value.strip()

LANGUAGE_SERVICES = {
    "en": {"translate": "en", "speech": "en-IN", "voice": "en-IN"},
    "hi": {"translate": "hi", "speech": "hi-IN", "voice": "hi-IN"},
    "ta": {"translate": "ta", "speech": "ta-IN", "voice": "ta-IN"},
    "te": {"translate": "te", "speech": "te-IN", "voice": "te-IN"},
    "kn": {"translate": "kn", "speech": "kn-IN", "voice": "kn-IN"},
    "ml": {"translate": "ml", "speech": "ml-IN", "voice": "ml-IN"},
    "bn": {"translate": "bn", "speech": "bn-IN", "voice": "bn-IN"},
    "mr": {"translate": "mr", "speech": "mr-IN", "voice": "mr-IN"},
    "gu": {"translate": "gu", "speech": "gu-IN", "voice": "gu-IN"},
    "ms": {"translate": "ms", "speech": "ms-MY", "voice": "ms-MY"},
    "zh": {"translate": "zh-CN", "speech": "cmn-Hans-CN", "voice": "cmn-CN"},
    "ar": {"translate": "ar", "speech": "ar-XA", "voice": "ar-XA"},
}

def require_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to access saved travel data.")
    project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GCP_PROJECT_ID")
    if not project_id:
        raise HTTPException(status_code=503, detail="Firebase Authentication is not configured.")
    try:
        try:
            app_instance = firebase_admin.get_app()
        except ValueError:
            app_instance = initialize_app(options={"projectId": project_id})
        decoded = firebase_auth.verify_id_token(authorization.removeprefix("Bearer "), app=app_instance)
        return {"uid": decoded["uid"]}
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Your sign-in has expired. Please sign in again.") from exc

def reserve_service_request(user_id: str, service: str, global_limit: int, user_limit: int, units: int = 1, unit_name: str = "requests") -> None:
    from google.cloud import firestore

    month = datetime.now(timezone.utc).strftime("%Y-%m")
    database = firestore.Client(project=os.getenv("GCP_PROJECT_ID") or os.getenv("FIREBASE_PROJECT_ID"))
    global_ref = database.collection("system").document(f"{service}-{month}")
    user_ref = database.collection("users").document(user_id).collection("usage").document(f"{service}-{month}")
    transaction = database.transaction()

    @firestore.transactional
    def increment(transaction):
        global_snapshot = global_ref.get(transaction=transaction)
        user_snapshot = user_ref.get(transaction=transaction)
        global_count = (global_snapshot.to_dict() or {}).get(unit_name, 0)
        user_count = (user_snapshot.to_dict() or {}).get(unit_name, 0)
        if global_count + units > global_limit or user_count + units > user_limit:
            raise HTTPException(status_code=429, detail="The monthly request allowance for this service has been used.")
        transaction.set(global_ref, {unit_name: global_count + units, "month": month}, merge=True)
        transaction.set(user_ref, {unit_name: user_count + units, "month": month}, merge=True)

    increment(transaction)

EXTRACTION_SCHEMAS = {
    "ticket": {
        "type": "object", "properties": {
            "passenger_names": {"type": "array", "items": {"type": "string"}},
            "pnr": {"type": ["string", "null"]}, "airline": {"type": ["string", "null"]},
            "segments": {"type": "array", "items": {"type": "object", "properties": {
                "flight_number": {"type": ["string", "null"]}, "origin": {"type": ["string", "null"]},
                "destination": {"type": ["string", "null"]}, "departure_date": {"type": ["string", "null"]},
                "arrival_date": {"type": ["string", "null"]}}, "required": ["flight_number", "origin", "destination", "departure_date", "arrival_date"]}},
            "baggage_allowance": {"type": ["string", "null"]}
        }, "required": ["passenger_names", "pnr", "airline", "segments", "baggage_allowance"]
    },
    "passport": {"type": "object", "properties": {
        "name": {"type": ["string", "null"]}, "number": {"type": ["string", "null"]},
        "expiry_date": {"type": ["string", "null"]}, "nationality": {"type": ["string", "null"]}},
        "required": ["name", "number", "expiry_date", "nationality"]},
    "visa": {"type": "object", "properties": {
        "name": {"type": ["string", "null"]}, "visa_type": {"type": ["string", "null"]},
        "country": {"type": ["string", "null"]}, "valid_from": {"type": ["string", "null"]},
        "valid_until": {"type": ["string", "null"]}},
        "required": ["name", "visa_type", "country", "valid_from", "valid_until"]},
}

def parse_date(value):
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None

def compare_names(first, second):
    clean = lambda value: " ".join("".join(c for c in value.casefold() if c.isalnum() or c.isspace()).split())
    return bool(first and second and clean(first) == clean(second))

def get_genai_client():
    use_vertex = os.getenv("USE_VERTEX_AI", "false").lower() in ("true", "1", "yes")
    project = os.getenv("GCP_PROJECT_ID")
    location = os.getenv("GCP_LOCATION", "us-central1")
    api_key = os.getenv("GEMINI_API_KEY")

    if use_vertex or project:
        if not project:
            raise ValueError("GCP_PROJECT_ID must be set in .env when using Vertex AI.")
        # Initialize Client for GCP Vertex AI
        return genai.Client(vertexai=True, project=project, location=location)
    else:
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError("GEMINI_API_KEY is not set in backend/.env.")
        # Initialize Client for Google AI Studio
        return genai.Client(api_key=api_key)

@app.get("/")
def read_root():
    return {"message": "Welcome to MyFirstFlightAI Backend API"}

@app.get("/api/health")
def health_check():
    use_vertex = os.getenv("USE_VERTEX_AI", "false").lower() in ("true", "1", "yes")
    project_set = bool(os.getenv("GCP_PROJECT_ID"))
    api_key_set = bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here")

    is_configured = (use_vertex and project_set) or project_set or api_key_set

    return {
        "status": "ok",
        "mode": "Vertex AI" if (use_vertex or project_set) else "Google AI Studio",
        "gemini_api_configured": is_configured
    }

@app.post("/api/translate")
def translate_text(request: TranslationRequest, user: dict = Depends(require_user)):
    target = LANGUAGE_SERVICES.get(request.target_language)
    source = LANGUAGE_SERVICES.get(request.source_language)
    if not target or not source:
        raise HTTPException(status_code=400, detail="Choose a supported language.")
    if not request.texts or len(request.texts) > 200 or sum(len(text) for text in request.texts) > 20000:
        raise HTTPException(status_code=413, detail="Translation text is too large.")
    if request.target_language == request.source_language:
        return {"translations": request.texts}
    project_id = os.getenv("GCP_PROJECT_ID") or os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        raise HTTPException(status_code=503, detail="Google Cloud Translation is not configured.")
    try:
        reserve_service_request(user["uid"], "translation", int(os.getenv("TRANSLATION_MONTHLY_CHAR_LIMIT", "400000")), int(os.getenv("TRANSLATION_USER_MONTHLY_CHAR_LIMIT", "50000")), sum(len(text) for text in request.texts), "characters")
        client = translate_v3.TranslationServiceClient()
        response = client.translate_text(request={
            "parent": f"projects/{project_id}/locations/global",
            "contents": request.texts,
            "mime_type": "text/plain",
            "source_language_code": source["translate"],
            "target_language_code": target["translate"],
        })
        return {"translations": [item.translated_text for item in response.translations]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Google translation is temporarily unavailable.") from exc

@app.post("/api/text-to-speech")
def text_to_speech(request: SpeechSynthesisRequest, user: dict = Depends(require_user)):
    language = LANGUAGE_SERVICES.get(request.language)
    text = request.text.strip()
    if not language:
        raise HTTPException(status_code=400, detail="Choose a supported language.")
    if not text or len(text) > 2000:
        raise HTTPException(status_code=413, detail="Text-to-speech input must be between 1 and 2000 characters.")
    try:
        client = texttospeech_v1.TextToSpeechClient()
        available_voices = client.list_voices(request={"language_code": language["voice"]}).voices
        standard_voice = next((voice for voice in available_voices if "-Standard-" in voice.name), None)
        if standard_voice is None:
            raise HTTPException(status_code=503, detail="A standard voice is not available for this language.")
        reserve_service_request(user["uid"], "texttospeech", int(os.getenv("TTS_MONTHLY_CHARACTER_LIMIT", "3000000")), int(os.getenv("TTS_USER_MONTHLY_CHARACTER_LIMIT", "200000")), len(text), "characters")
        result = client.synthesize_speech(request={
            "input": {"text": text},
            "voice": {"language_code": language["voice"], "name": standard_voice.name, "ssml_gender": texttospeech_v1.SsmlVoiceGender.NEUTRAL},
            "audio_config": {"audio_encoding": texttospeech_v1.AudioEncoding.MP3, "speaking_rate": 0.9},
        })
        return Response(content=result.audio_content, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Google text-to-speech is temporarily unavailable.") from exc

@app.post("/api/speech-to-text")
async def speech_to_text(file: UploadFile = File(...), language_code: str = Form(...), user: dict = Depends(require_user)):
    language = LANGUAGE_SERVICES.get(language_code)
    if not language:
        raise HTTPException(status_code=400, detail="Choose a supported language.")
    mime_type = (file.content_type or "").split(";")[0].casefold()
    encodings = {
        "audio/webm": speech_v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        "audio/ogg": speech_v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
        "audio/wav": speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
        "audio/x-wav": speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
        "audio/mpeg": speech_v1.RecognitionConfig.AudioEncoding.MP3,
    }
    if mime_type not in encodings:
        raise HTTPException(status_code=415, detail="Use a WebM, OGG, WAV or MP3 recording.")
    audio_content = await file.read(8 * 1024 * 1024 + 1)
    if not audio_content or len(audio_content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Recording must be non-empty and no larger than 8 MB.")
    try:
        reserve_service_request(user["uid"], "speechrecognition", int(os.getenv("STT_MONTHLY_LIMIT", "50")), int(os.getenv("STT_USER_MONTHLY_LIMIT", "15")))
        client = speech_v1.SpeechClient()
        response = client.recognize(request={
            "config": {
                "encoding": encodings[mime_type],
                "language_code": language["speech"],
                "enable_automatic_punctuation": True,
            },
            "audio": {"content": audio_content},
        }, timeout=30)
        transcript = " ".join(result.alternatives[0].transcript for result in response.results if result.alternatives)
        return {"transcript": transcript}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Google speech recognition is temporarily unavailable.") from exc

@app.get("/api/emergency-contact")
def get_emergency_contact(user: dict = Depends(require_user)):
    try:
        return load_emergency_contact(user["uid"])
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Emergency contact could not be loaded.") from exc

@app.put("/api/emergency-contact")
def put_emergency_contact(request: EmergencyContactRequest, user: dict = Depends(require_user)):
    contact = request.model_dump()
    contact["name"] = contact["name"].strip()
    contact["relationship"] = contact["relationship"].strip()
    if not contact["name"]:
        raise HTTPException(status_code=422, detail="Enter the emergency contact's name.")
    try:
        save_emergency_contact(user["uid"], contact)
        return {"saved": True}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Encrypted emergency-contact storage is not available.") from exc

@app.delete("/api/emergency-contact")
def remove_emergency_contact(user: dict = Depends(require_user)):
    try:
        delete_emergency_contact(user["uid"])
        return {"deleted": True}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Emergency contact could not be deleted.") from exc

@app.post("/api/extract-document")
async def extract_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    traveller_id: str = Form(...),
    store_passport_consent: bool = Form(False),
    user: dict = Depends(require_user),
):
    if document_type not in EXTRACTION_SCHEMAS:
        raise HTTPException(status_code=400, detail="Choose a ticket, passport or visa document.")
    allowed = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
    mime_type = file.content_type if file.content_type in allowed else mimetypes.guess_type(file.filename or "")[0]
    if mime_type not in allowed:
        raise HTTPException(status_code=415, detail="Upload a PDF, JPG, PNG or WebP document.")
    content = await file.read(10 * 1024 * 1024 + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File must be 10 MB or smaller.")
    try:
        client = get_genai_client()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    prompt = (f"Extract only fields visible in this {document_type}. Do not infer missing values. "
              "Use ISO YYYY-MM-DD dates when possible; use null for unknown values. "
              "Names must preserve the document's spelling. Return only the requested structured fields.")
    try:
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=[types.Part.from_bytes(data=content, mime_type=mime_type), prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=EXTRACTION_SCHEMAS[document_type], temperature=0),
        )
        extracted = json.loads(response.text)
        passport_stored = False
        if document_type == "passport" and store_passport_consent:
            expiry_date = parse_date(extracted.get("expiry_date"))
            if not expiry_date:
                raise HTTPException(status_code=422, detail="Passport expiry could not be read. Retry the upload; no copy was retained.")
            try:
                store_passport(user["uid"], traveller_id, content, mime_type)
                profile = load_profile(user["uid"])
                travellers = profile.setdefault("travellers", [])
                saved_traveller = next((item for item in travellers if item.get("id") == traveller_id), None)
                if saved_traveller is None:
                    saved_traveller = {"id": traveller_id, "name": "", "assistance": ""}
                    travellers.append(saved_traveller)
                saved_traveller.setdefault("extracted", {})["passport"] = extracted
                saved_traveller["passport_consent"] = True
                saved_traveller["passport_stored"] = True
                save_profile(user["uid"], profile)
                passport_stored = True
            except Exception as exc:
                try:
                    delete_passport(user["uid"], traveller_id)
                except Exception:
                    pass
                if isinstance(exc, HTTPException):
                    raise
                raise HTTPException(status_code=503, detail="Encrypted passport storage is not available. No passport copy was saved.") from exc
        return {"document_type": document_type, "extracted": extracted, "passport_stored": passport_stored}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Document reading failed. Please retry with a clear file.") from exc

@app.get("/api/profile")
def get_profile(user: dict = Depends(require_user)):
    try:
        return load_profile(user["uid"])
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Saved profile could not be loaded.") from exc

@app.put("/api/profile")
def put_profile(request: ProfileRequest, user: dict = Depends(require_user)):
    profile = request.model_dump()
    try:
        previous_profile = load_profile(user["uid"])
        previous_travellers = {item.get("id"): item for item in previous_profile.get("travellers", []) if item.get("id")}
        profile["travellers"] = [
        {key: value for key, value in traveller.items() if key in {"id", "name", "assistance", "extracted", "passport_consent", "passport_stored"}}
        for traveller in profile["travellers"]
        ]
        for traveller_id, previous in previous_travellers.items():
            current = next((item for item in profile["travellers"] if item.get("id") == traveller_id), None)
            if previous.get("passport_stored") and (current is None or not current.get("passport_consent")):
                delete_passport(user["uid"], traveller_id)
        for traveller in profile["travellers"]:
            previous = previous_travellers.get(traveller.get("id"), {})
            if not traveller.get("passport_consent") or not previous.get("passport_stored"):
                (traveller.get("extracted") or {}).pop("passport", None)
            traveller["passport_stored"] = bool(previous.get("passport_stored") and traveller.get("passport_consent"))
        save_profile(user["uid"], profile)
        return {"saved": True}
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Encrypted profile storage is not available.") from exc

@app.delete("/api/profile")
def delete_profile(user: dict = Depends(require_user)):
    try:
        delete_user_data(user["uid"])
        return {"deleted": True}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Saved data could not be deleted. Please contact support.") from exc

@app.delete("/api/passports/{traveller_id}")
def revoke_passport_storage(traveller_id: str, user: dict = Depends(require_user)):
    try:
        profile = load_profile(user["uid"])
        delete_passport(user["uid"], traveller_id)
        for traveller in profile.get("travellers", []):
            if traveller.get("id") == traveller_id:
                traveller["passport_stored"] = False
                traveller["passport_consent"] = False
                (traveller.get("extracted") or {}).pop("passport", None)
        save_profile(user["uid"], profile)
        return {"deleted": True}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Passport data could not be deleted.") from exc

@app.post("/api/internal/expire-passports")
def expire_passports(authorization: str = Header(default="")):
    expected_email = os.getenv("PASSPORT_CLEANUP_SERVICE_ACCOUNT", "")
    audience = os.getenv("PASSPORT_CLEANUP_AUDIENCE", "")
    if not authorization.startswith("Bearer ") or not expected_email or not audience:
        raise HTTPException(status_code=403, detail="Forbidden.")
    try:
        claims = id_token.verify_oauth2_token(authorization.removeprefix("Bearer "), GoogleAuthRequest(), audience)
        if claims.get("email") != expected_email or not claims.get("email_verified"):
            raise HTTPException(status_code=403, detail="Forbidden.")
        return {"removed": remove_expired_passports()}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Passport retention cleanup could not complete.") from exc

def _reserve_flight_request(user_id: str) -> int:
    from google.cloud import firestore

    month = datetime.now(timezone.utc).strftime("%Y-%m")
    database = firestore.Client(project=os.getenv("GCP_PROJECT_ID") or os.getenv("FIREBASE_PROJECT_ID"))
    reference = database.collection("system").document(f"aviationstack-{month}")
    user_reference = database.collection("users").document(user_id).collection("usage").document(f"aviationstack-{month}")
    transaction = database.transaction()

    @firestore.transactional
    def increment(transaction):
        snapshot = reference.get(transaction=transaction)
        used = (snapshot.to_dict() or {}).get("requests", 0)
        user_snapshot = user_reference.get(transaction=transaction)
        user_used = (user_snapshot.to_dict() or {}).get("requests", 0)
        if used >= int(os.getenv("AVIATIONSTACK_MONTHLY_LIMIT", "100")):
            raise HTTPException(status_code=429, detail="This month's free flight-status checks have been used.")
        if user_used >= int(os.getenv("AVIATIONSTACK_USER_MONTHLY_LIMIT", "10")):
            raise HTTPException(status_code=429, detail="This account has used its flight-status checks for this month.")
        transaction.set(reference, {"requests": used + 1, "month": month}, merge=True)
        transaction.set(user_reference, {"requests": user_used + 1, "month": month}, merge=True)
        return used + 1

    return increment(transaction)

@app.post("/api/flight-status")
async def get_flight_status(request: FlightStatusRequest, user: dict = Depends(require_user)):
    api_key = os.getenv("AVIATIONSTACK_ACCESS_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Flight status is not configured.")
    flight_iata = re.sub(r"\s+", "", request.flight_iata).upper()
    if not flight_iata or len(flight_iata) > 10 or not flight_iata.isalnum():
        raise HTTPException(status_code=400, detail="Enter the flight number shown on your ticket.")
    try:
        _reserve_flight_request(user["uid"])
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get("https://api.aviationstack.com/v1/flights", params={"access_key": api_key, "flight_iata": flight_iata, "flight_date": request.flight_date.isoformat()})
        response.raise_for_status()
        records = response.json().get("data", [])
        if not records:
            raise HTTPException(status_code=404, detail="No live status was found for this flight and date.")
        record = records[0]
        departure = record.get("departure") or {}
        arrival = record.get("arrival") or {}
        status = record.get("flight_status") or "unknown"
        return {
            "flight_iata": flight_iata,
            "flight_date": request.flight_date.isoformat(),
            "status": status,
            "cancelled": status.casefold() == "cancelled",
            "departure_delay_minutes": departure.get("delay"),
            "arrival_delay_minutes": arrival.get("delay"),
            "departure_estimated": departure.get("estimated"),
            "arrival_estimated": arrival.get("estimated"),
            "departure_gate": departure.get("gate"),
            "departure_terminal": departure.get("terminal"),
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "best_effort": True,
        }
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="The flight-status service could not be reached. Try again later.") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Flight status is temporarily unavailable.") from exc

@app.post("/api/validate-trip")
def validate_trip(request: TripValidationRequest, user: dict = Depends(require_user)):
    if not request.travellers:
        raise HTTPException(status_code=400, detail="Add at least one traveller.")
    if request.return_date and request.return_date < request.departure_date:
        raise HTTPException(status_code=400, detail="Return date must be on or after departure date.")
    trip_end_date = request.return_date or request.departure_date
    checks = []
    issues = 0
    for index, traveller in enumerate(request.travellers, start=1):
        docs = traveller.documents
        ticket, passport, visa = docs.get("ticket", {}), docs.get("passport", {}), docs.get("visa", {})
        if not all((ticket, passport, visa)):
            checks.append({"status": "review", "title": f"Traveller {index}: missing documents", "message": "Upload and extract a ticket, passport and visa."})
            issues += 1
            continue
        ticket_names = ticket.get("passenger_names") or []
        ticket_name_matches = any(compare_names(name, traveller.name) and compare_names(name, passport.get("name")) for name in ticket_names)
        name_matches = (compare_names(passport.get("name"), visa.get("name"))
                        and compare_names(passport.get("name"), traveller.name)
                        and ticket_name_matches)
        checks.append({"status": "pass" if name_matches else "review", "title": f"Traveller {index}: name match", "message": "Names match across the submitted details." if name_matches else "Names differ or could not be confirmed across the documents. Check spelling and ticket passenger names."})
        if not name_matches: issues += 1
        expiry = parse_date(passport.get("expiry_date"))
        six_month_limit = trip_end_date + relativedelta(months=6)
        passport_ok = expiry is not None and expiry >= six_month_limit
        checks.append({"status": "pass" if passport_ok else "review", "title": f"Traveller {index}: passport expiry", "message": f"Passport expires {expiry.isoformat()}." if expiry else "Passport expiry date was not readable."} if passport_ok else {"status": "review", "title": f"Traveller {index}: passport expiry", "message": "Expiry may be too close to your travel date or could not be read. Check the destination's official entry rules."})
        if not passport_ok: issues += 1
        visa_start, visa_end = parse_date(visa.get("valid_from")), parse_date(visa.get("valid_until"))
        visa_ok = bool(visa_start and visa_end and visa_start <= request.departure_date and visa_end >= trip_end_date)
        visa_country = visa.get("country") or ""
        country_ok = not visa_country or request.destination.casefold() in visa_country.casefold() or visa_country.casefold() in request.destination.casefold()
        visa_ok = visa_ok and country_ok
        checks.append({"status": "pass" if visa_ok else "review", "title": f"Traveller {index}: visa coverage", "message": "Visa dates and destination appear to cover this trip." if visa_ok else "Visa dates or destination may not cover the trip, or could not be read. Verify with the issuing authority."})
        if not visa_ok: issues += 1
    return {"status": "ready" if issues == 0 else "review", "checks": checks}

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest, user: dict = Depends(require_user)):
    reserve_service_request(user["uid"], "gemini-chat", int(os.getenv("GEMINI_CHAT_MONTHLY_LIMIT", "500")), int(os.getenv("GEMINI_CHAT_USER_MONTHLY_LIMIT", "100")))
    try:
        client = get_genai_client()
    except ValueError as e:
        return {"reply": f"⚠️ Configuration Error: {str(e)}"}

    try:
        # Build prior conversation history for chat session
        history_contents = []
        for msg in request.history:
            role = "user" if msg.role == "user" else "model"
            history_contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)]
                )
            )

        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        language_names = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "kn": "Kannada", "ml": "Malayalam", "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "ms": "Malay", "zh": "Chinese", "ar": "Arabic"}
        language_name = language_names.get(request.language)
        if not language_name:
            raise HTTPException(status_code=400, detail="Choose a supported language.")

        # Create chat session using recommended client.chats.create pattern
        chat = client.chats.create(
            model=model_name,
            history=history_contents,
            config=types.GenerateContentConfig(
                system_instruction=f"You are MyFirstFlightAI, a calm, patient airport travel assistant for first-time flyers. Use simple, short sentences. Reply in {language_name}. Do not guess flight or immigration rules; direct users to airline or official staff for confirmation.",
                temperature=0.7,
                max_output_tokens=512,
            )
        )

        # Send current user message
        response = chat.send_message(request.message)

        return {"reply": response.text}

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        if "RefreshError" in err_msg or "invalid_grant" in err_msg or "DefaultCredentialsError" in err_msg:
            return {
                "reply": "⚠️ **Vertex AI Auth Required**: Local Application Default Credentials (ADC) expired. Please run `gcloud auth application-default login` in your terminal to authenticate your GCP account."
            }
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {err_msg}")
