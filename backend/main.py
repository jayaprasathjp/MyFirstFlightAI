import os
import json
import mimetypes
from datetime import date
from dateutil.relativedelta import relativedelta
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types

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
    message: str
    history: Optional[List[ChatMessage]] = []

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

@app.post("/api/extract-document")
async def extract_document(file: UploadFile = File(...), document_type: str = Form(...)):
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
        return {"document_type": document_type, "extracted": extracted}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Document extraction failed: {str(exc)}")

@app.post("/api/validate-trip")
def validate_trip(request: TripValidationRequest):
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
def chat_endpoint(request: ChatRequest):
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

        # Create chat session using recommended client.chats.create pattern
        chat = client.chats.create(
            model=model_name,
            history=history_contents,
            config=types.GenerateContentConfig(
                system_instruction="You are MyFirstFlightAI, an intelligent, friendly AI assistant. Help the user with flight planning, travel ideas, general knowledge, and coding tasks. Keep answers concise, clear, and engaging.",
                temperature=0.7,
            )
        )

        # Send current user message
        response = chat.send_message(request.message)

        return {"reply": response.text}

    except Exception as e:
        err_msg = str(e)
        if "RefreshError" in err_msg or "invalid_grant" in err_msg or "DefaultCredentialsError" in err_msg:
            return {
                "reply": "⚠️ **Vertex AI Auth Required**: Local Application Default Credentials (ADC) expired. Please run `gcloud auth application-default login` in your terminal to authenticate your GCP account."
            }
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {err_msg}")
