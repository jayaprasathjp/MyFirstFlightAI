import asyncio
import hashlib
import logging
import mimetypes
import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.genai import types

# Load environment variables from .env file (before modules that read them)
load_dotenv()

import gemini  # noqa: E402
from checklist import build_checklist, group_dates  # noqa: E402
from db import now_iso, store  # noqa: E402
from schemas import ChatRequest, ChecklistToggle, CreateTripRequest, TranslateRequest, UpdateTripRequest  # noqa: E402
from validation import check_trip, overall_status, passport_name, trip_summary  # noqa: E402

log = logging.getLogger("myfirstflight")

app = FastAPI(
    title="MyFirstFlightAI Backend API",
    description="FastAPI Backend integrated with Google Gemini Chat via Vertex AI / Google AI Studio",
    version="1.1.0"
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

MAX_UPLOAD = 10 * 1024 * 1024
ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"}
ASSISTANCE = {"none", "elderly", "wheelchair", "visually_impaired"}


# ---------- translation (cached per string in Firestore) ----------

def _tkey(lang, text):
    return hashlib.sha256(f"{lang}\n{text}".encode()).hexdigest()


def localize(texts: dict[str, str], lang: str) -> dict[str, str]:
    if lang == "en" or not texts:
        return dict(texts)
    db, out, missing = store(), {}, {}
    for k, v in texts.items():
        hit = db.get("translations", _tkey(lang, v))
        if hit:
            out[k] = hit["text"]
        else:
            missing[k] = v
    if missing:
        try:
            done = gemini.translate(missing, lang)
        except Exception:
            log.exception("translation failed; falling back to English")
            return {**out, **missing}
        for k, v in done.items():
            if v != missing[k]:
                db.set("translations", _tkey(lang, missing[k]), {"text": v, "lang": lang, "source": missing[k]})
        out.update(done)
    return out


# ---------- trip helpers ----------

def load_trip(trip_id):
    trip = store().get("trips", trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
    return trip


def save_trip(trip):
    trip["updated_at"] = now_iso()
    store().set("trips", trip["id"], trip)


def recompute(trip):
    travellers = trip["travellers"]
    first_ticket = next(((t.get("documents") or {}).get("ticket") for t in travellers), None)
    trip["summary"] = trip_summary(first_ticket) if first_ticket else None
    trip["checks"] = check_trip(travellers)
    trip["status"] = overall_status(trip["checks"]) if travellers else "empty"


def trip_view(trip):
    """Trip as returned to the frontend, with checks and checklist in the trip language."""
    lang = trip.get("language", "en")
    checks = trip.get("checks") or []
    items = build_checklist(trip.get("summary"), trip["travellers"], checks) if trip["travellers"] else []

    texts = {}
    for c in checks:
        texts[f"c.{c['id']}.t"], texts[f"c.{c['id']}.m"] = c["title"], c["message"]
    for i in items:
        texts[f"i.{i['id']}.t"], texts[f"i.{i['id']}.d"] = i["title"], i["detail"]
    tr = localize(texts, lang)

    done = trip.get("checklist_done") or {}
    return {
        "id": trip["id"],
        "language": lang,
        "status": trip.get("status", "empty"),
        "summary": trip.get("summary"),
        "travellers": [{k: t.get(k) for k in ("id", "name", "assistance", "documents")} for t in trip["travellers"]],
        "checks": [{**c, "title": tr[f"c.{c['id']}.t"], "message": tr[f"c.{c['id']}.m"]} for c in checks],
        "checklist": {
            "dates": group_dates(trip.get("summary")),
            "items": [{**i, "title": tr[f"i.{i['id']}.t"], "detail": tr[f"i.{i['id']}.d"], "done": bool(done.get(i["id"]))}
                      for i in items],
        },
    }


async def read_upload(upload: UploadFile, label: str):
    mime = upload.content_type if upload.content_type in ALLOWED_MIME else mimetypes.guess_type(upload.filename or "")[0]
    if mime not in ALLOWED_MIME:
        raise HTTPException(status_code=415, detail=f"{label}: upload a PDF, JPG, PNG or WebP file.")
    content = await upload.read(MAX_UPLOAD + 1)
    if not content:
        raise HTTPException(status_code=400, detail=f"{label}: the file is empty.")
    if len(content) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail=f"{label}: file must be 10 MB or smaller.")
    return content, mime


# ---------- routes ----------

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
        "gemini_api_configured": is_configured,
        "db": os.getenv("DB_BACKEND", "firestore"),
    }


@app.get("/api/languages")
def languages():
    return gemini.LANGUAGES


@app.post("/api/translate")
def translate_ui(req: TranslateRequest):
    if req.language not in gemini.LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language.")
    if len(req.texts) > 300 or any(len(v) > 600 for v in req.texts.values()):
        raise HTTPException(status_code=413, detail="Too much text to translate at once.")
    return {"language": req.language, "texts": localize(req.texts, req.language)}


@app.post("/api/trips")
def create_trip(req: CreateTripRequest):
    if req.language not in gemini.LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language.")
    trip = {"id": uuid.uuid4().hex, "language": req.language, "travellers": [], "summary": None,
            "checks": [], "status": "empty", "checklist_done": {}, "created_at": now_iso()}
    save_trip(trip)
    return trip_view(trip)


@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str):
    return trip_view(load_trip(trip_id))


@app.patch("/api/trips/{trip_id}")
def update_trip(trip_id: str, req: UpdateTripRequest):
    if req.language not in gemini.LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language.")
    trip = load_trip(trip_id)
    trip["language"] = req.language
    save_trip(trip)
    return trip_view(trip)


@app.post("/api/trips/{trip_id}/travellers")
async def add_traveller(
    trip_id: str,
    ticket: UploadFile = File(...),
    passport: UploadFile = File(...),
    visa: UploadFile = File(...),
    assistance: str = Form("none"),
):
    trip = load_trip(trip_id)
    if assistance not in ASSISTANCE:
        raise HTTPException(status_code=400, detail="Unknown assistance type.")
    files = {"ticket": await read_upload(ticket, "Ticket"),
             "passport": await read_upload(passport, "Passport"),
             "visa": await read_upload(visa, "Visa")}

    async def extract(doc_type):
        content, mime = files[doc_type]
        try:
            return await asyncio.to_thread(gemini.extract_document, content, mime, doc_type)
        except ValueError as exc:  # missing Gemini configuration
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:
            log.exception("extraction failed for %s", doc_type)
            raise HTTPException(status_code=502, detail=f"Could not read the {doc_type}. Try a clearer copy. ({exc})")

    ticket_data, passport_data, visa_data = await asyncio.gather(extract("ticket"), extract("passport"), extract("visa"))

    # Files are only read in memory; we store the extracted text fields.
    trip = load_trip(trip_id)  # reload in case another traveller was added meanwhile
    trip["travellers"].append({
        "id": uuid.uuid4().hex[:8],
        "name": passport_name(passport_data).title() or "Traveller",
        "assistance": assistance,
        "documents": {"ticket": ticket_data, "passport": passport_data, "visa": visa_data},
        "added_at": now_iso(),
    })
    recompute(trip)
    save_trip(trip)
    return trip_view(trip)


@app.delete("/api/trips/{trip_id}/travellers/{traveller_id}")
def remove_traveller(trip_id: str, traveller_id: str):
    trip = load_trip(trip_id)
    before = len(trip["travellers"])
    trip["travellers"] = [t for t in trip["travellers"] if t["id"] != traveller_id]
    if len(trip["travellers"]) == before:
        raise HTTPException(status_code=404, detail="Traveller not found.")
    recompute(trip)
    save_trip(trip)
    return trip_view(trip)


@app.put("/api/trips/{trip_id}/checklist")
def set_checklist(trip_id: str, req: ChecklistToggle):
    trip = load_trip(trip_id)
    trip["checklist_done"] = {k: True for k, v in req.done.items() if v}
    save_trip(trip)
    return {"checklist_done": trip["checklist_done"]}


@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    try:
        client = gemini.get_genai_client()
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

        # Create chat session using recommended client.chats.create pattern
        chat = client.chats.create(
            model=gemini.model_name(),
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
