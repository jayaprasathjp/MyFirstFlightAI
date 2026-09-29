import asyncio
import hashlib
import logging
import mimetypes
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from google.genai import types

# Load backend/.env (before modules that read it), whatever folder the server is started from.
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")
_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if _creds and not Path(_creds).is_absolute():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(BACKEND_DIR / _creds)

import gcp  # noqa: E402
import gemini  # noqa: E402
from advice import get_advice  # noqa: E402
from checklist import build_checklist, group_dates  # noqa: E402
from db import StoreError, now_iso, store  # noqa: E402
from journey import build_journey, destination_contact  # noqa: E402
from schemas import (AssistRequest, BoardingRequest, ChatRequest, ChecklistToggle, ContactsRequest,  # noqa: E402
                     CreateTripRequest, TranslateRequest, TTSRequest, UpdateTripRequest)
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

@app.exception_handler(StoreError)
async def store_error_handler(request: Request, exc: StoreError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


MAX_UPLOAD = 10 * 1024 * 1024
ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"}
ASSISTANCE = {"none", "elderly", "wheelchair", "visually_impaired"}


# ---------- translation (cached per string in Firestore) ----------

def _tkey(lang, text):
    return hashlib.sha256(f"{lang}\n{text}".encode()).hexdigest()


def _mask(text, terms):
    """Swap protected terms (names, document numbers) for {n0}, {n1}... so Gemini cannot transliterate them."""
    mapping = {}
    for term in terms:
        if term in text:
            key = f"{{n{len(mapping)}}}"
            text = text.replace(term, key)
            mapping[key] = term
    return text, mapping


def localize(texts: dict[str, str], lang: str, protect=()) -> dict[str, str]:
    """Translate {key: english}; `protect` terms are kept exactly as written."""
    if lang == "en" or not texts:
        return dict(texts)
    terms = sorted({t for t in protect if t and len(t) >= 2}, key=len, reverse=True)
    masked, maps = {}, {}
    for k, v in texts.items():
        masked[k], maps[k] = _mask(v, terms)

    db, tr, missing = store(), {}, {}
    cached = db.get_many("translations", [_tkey(lang, v) for v in masked.values()])
    for k, v in masked.items():
        hit = cached.get(_tkey(lang, v))
        if hit:
            tr[k] = hit["text"]
        else:
            missing[k] = v
    if missing:
        try:
            done = gemini.translate(missing, lang)
        except Exception:
            log.exception("translation failed; falling back to English")
            done = dict(missing)
        db.set_many("translations", {
            _tkey(lang, missing[k]): {"text": v, "lang": lang, "source": missing[k]}
            for k, v in done.items() if v != missing[k] and all(p in v for p in maps[k])
        })
        tr.update(done)

    out = {}
    for k, v in tr.items():
        if not all(p in v for p in maps[k]):
            out[k] = texts[k]  # a placeholder was lost: English is safer than a missing name
            continue
        for p, term in maps[k].items():
            v = v.replace(p, term)
        out[k] = v
    return out


def protected_terms(trip):
    """Names and identifiers in a trip that must never be translated or transliterated."""
    s = trip.get("summary") or {}
    terms = {s.get("pnr"), s.get("airline"), *(s.get("flights") or []), *(s.get("return_flights") or [])}
    for c in trip.get("contacts") or []:
        terms |= {c.get("name"), c.get("phone")}
    host = destination_contact(trip["travellers"], trip.get("contacts"))
    if host:
        terms |= {host["name"], host["phone"]}
    for t in trip["travellers"]:
        docs = t.get("documents") or {}
        passport, ticket, visa = docs.get("passport") or {}, docs.get("ticket") or {}, docs.get("visa") or {}
        pname = passport_name(passport)
        terms |= {t.get("name"), (t.get("name") or "").title(), pname, pname.title(),
                  passport.get("number"), visa.get("full_name"), visa.get("passport_number"),
                  *(ticket.get("passenger_names") or [])}
    return {x for x in terms if isinstance(x, str)}


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
    trip["advice"] = get_advice(trip["summary"], travellers) if travellers else None  # Gemini, cached per route


def trip_view(trip):
    """Trip as returned to the frontend, with checks and checklist in the trip language."""
    lang = trip.get("language", "en")
    checks = trip.get("checks") or []
    travellers, contacts, advice = trip["travellers"], trip.get("contacts") or [], trip.get("advice")
    items = build_checklist(trip.get("summary"), travellers, checks, advice, contacts) if travellers else []
    journey = build_journey(trip.get("summary"), travellers, advice, contacts, trip.get("boarding")) if travellers else []

    texts = {}
    for c in checks:
        texts[f"c.{c['id']}.t"], texts[f"c.{c['id']}.m"] = c["title"], c["message"]
    for i in items:
        texts[f"i.{i['id']}.t"], texts[f"i.{i['id']}.d"] = i["title"], i["detail"]
    bp = trip.get("boarding_pass") or {}
    for n, f in enumerate(bp.get("fields") or []):
        texts[f"bp.{n}"] = f["meaning"]
    for st in journey:
        j = f"j.{st['id']}"
        texts[f"{j}.t"], texts[f"{j}.s"] = st["title"], st["staff"]
        texts.update({f"{j}.w{n}": w for n, w in enumerate(st["where"])})
        texts.update({f"{j}.d{n}": d for n, d in enumerate(st["do"])})
        for n, (q, a) in enumerate(st["qa"]):
            texts[f"{j}.q{n}"], texts[f"{j}.a{n}"] = q, a
    tr = localize(texts, lang, protect=protected_terms(trip))

    def journey_step(st):
        j = f"j.{st['id']}"
        return {
            "id": st["id"], "title": tr[f"{j}.t"],
            "where": [tr[f"{j}.w{n}"] for n in range(len(st["where"]))],
            "do": [tr[f"{j}.d{n}"] for n in range(len(st["do"]))],
            # Officers and staff speak English: keep the English line, show the translation under it.
            "qa": [{"q_en": q, "a_en": a, "q": tr[f"{j}.q{n}"], "a": tr[f"{j}.a{n}"]} for n, (q, a) in enumerate(st["qa"])],
            "staff_en": st["staff"], "staff": tr[f"{j}.s"],
        }

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
        "contacts": contacts,
        "destination_contact": destination_contact(travellers, []),  # from the visa, to prefill the contacts form
        "boarding": trip.get("boarding") or {},
        "journey": [journey_step(st) for st in journey],
        "boarding_pass": {**bp, "fields": [{**f, "meaning": tr[f"bp.{n}"]} for n, f in enumerate(bp.get("fields") or [])]}
                         if bp else None,
        "assist_requests": trip.get("assist_requests") or [],
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
            "checks": [], "status": "empty", "checklist_done": {}, "contacts": [], "boarding": {},
            "advice": None, "created_at": now_iso()}
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

    traveller_id = uuid.uuid4().hex[:8]

    async def process(doc_type):
        content, mime = files[doc_type]
        try:
            data = await asyncio.to_thread(gemini.extract_document, content, mime, doc_type)
        except ValueError as exc:  # missing Gemini configuration
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:
            log.exception("extraction failed for %s", doc_type)
            raise HTTPException(status_code=502, detail=f"Could not read the {doc_type}. Try a clearer copy. ({exc})")
            
        path = f"trips/{trip_id}/travellers/{traveller_id}/{doc_type}"
        await asyncio.to_thread(store().set_file, path, content, mime)
        return data

    ticket_data, passport_data, visa_data = await asyncio.gather(process("ticket"), process("passport"), process("visa"))

    # Original files are in Cloud Storage (set_file above); Firestore keeps only the extracted text fields.
    trip = load_trip(trip_id)  # reload in case another traveller was added meanwhile
    trip["travellers"].append({
        "id": traveller_id,
        "name": passport_name(passport_data).title() or "Traveller",
        "assistance": assistance,
        "documents": {"ticket": ticket_data, "passport": passport_data, "visa": visa_data},
        "added_at": now_iso(),
    })
    await asyncio.to_thread(recompute, trip)  # may call Gemini for trip advice
    save_trip(trip)
    return await asyncio.to_thread(trip_view, trip)


@app.delete("/api/trips/{trip_id}/travellers/{traveller_id}")
def remove_traveller(trip_id: str, traveller_id: str):
    trip = load_trip(trip_id)
    before = len(trip["travellers"])
    trip["travellers"] = [t for t in trip["travellers"] if t["id"] != traveller_id]
    if len(trip["travellers"]) == before:
        raise HTTPException(status_code=404, detail="Traveller not found.")
    
    for doc in ("ticket", "passport", "visa"):
        store().delete_file(f"trips/{trip_id}/travellers/{traveller_id}/{doc}")
        
    recompute(trip)
    save_trip(trip)
    return trip_view(trip)


@app.get("/api/trips/{trip_id}/travellers/{traveller_id}/documents/{doc_type}")
def get_document(trip_id: str, traveller_id: str, doc_type: str):
    if doc_type not in ("ticket", "passport", "visa"):
        raise HTTPException(status_code=400, detail="Invalid document type.")
    path = f"trips/{trip_id}/travellers/{traveller_id}/{doc_type}"
    file_data = store().get_file(path)
    if not file_data:
        raise HTTPException(status_code=404, detail="Document not found.")
    return Response(
        content=file_data["content"],
        media_type=file_data["mime_type"],
        headers={"Cache-Control": "private, max-age=86400"}
    )


@app.put("/api/trips/{trip_id}/checklist")
def set_checklist(trip_id: str, req: ChecklistToggle):
    trip = load_trip(trip_id)
    trip["checklist_done"] = {k: True for k, v in req.done.items() if v}
    save_trip(trip)
    return {"checklist_done": trip["checklist_done"]}


@app.put("/api/trips/{trip_id}/contacts")
def set_contacts(trip_id: str, req: ContactsRequest):
    trip = load_trip(trip_id)
    trip["contacts"] = [c.model_dump() for c in req.contacts]
    save_trip(trip)
    return trip_view(trip)


@app.put("/api/trips/{trip_id}/boarding")
def set_boarding(trip_id: str, req: BoardingRequest):
    """Gate and boarding time from the boarding pass (known only at the airport)."""
    trip = load_trip(trip_id)
    trip["boarding"] = {"gate": req.gate.strip().upper(), "boarding_time": req.boarding_time}
    save_trip(trip)
    return trip_view(trip)


# ---------- step 7: always-on helpers ----------

AUDIO_MIME = {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/aac"}


async def read_audio(audio: UploadFile | None):
    if audio is None:
        return None, None
    mime = (audio.content_type or "").split(";")[0].strip()
    if mime not in AUDIO_MIME:
        raise HTTPException(status_code=415, detail="Unsupported audio format.")
    content = await audio.read(MAX_UPLOAD + 1)
    if not content or len(content) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="Recording is empty or too long.")
    return content, mime


def trip_facts(trip):
    """Compact English facts about the trip for the concierge to answer from."""
    travellers, contacts, advice = trip["travellers"], trip.get("contacts") or [], trip.get("advice")
    done = trip.get("checklist_done") or {}
    return {
        "today": now_iso()[:10],
        "trip": trip.get("summary"),
        "travellers": [{"name": t["name"], "assistance": t.get("assistance")} for t in travellers],
        "document_checks": [{"status": c["status"], "result": c["title"], "detail": c["message"]}
                            for c in trip.get("checks") or []],
        "checklist": [{"task": i["title"], "detail": i["detail"], "done": bool(done.get(i["id"]))}
                      for i in build_checklist(trip.get("summary"), travellers, trip.get("checks") or [], advice, contacts)],
        "airport_steps": [{"step": st["title"], "do": st["do"]}
                          for st in build_journey(trip.get("summary"), travellers, advice, contacts, trip.get("boarding"))],
        "boarding_pass": trip.get("boarding") or {},
        "family_contacts": [{"name": c["name"], "relation": c.get("relation")} for c in contacts],
        "destination_tips": {k: (advice or {}).get(k) for k in ("arrival_tips", "customs_tips", "transit_tips")},
    }


def gemini_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except gemini.UnclearAudio as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        log.exception("Gemini helper failed")
        raise HTTPException(status_code=502, detail=f"Could not get an answer right now. Please try again. ({exc})")


@app.post("/api/trips/{trip_id}/ask")
async def ask(trip_id: str, text: str = Form(""), audio: UploadFile | None = File(None)):
    """Voice concierge: question by voice or text, answered in the trip language from the trip's own data."""
    trip = load_trip(trip_id)
    content, mime = await read_audio(audio)
    if not content and not text.strip():
        raise HTTPException(status_code=400, detail="Ask a question by voice or text.")
    return await asyncio.to_thread(gemini_call, gemini.ask, trip_facts(trip), trip.get("language", "en"),
                                   text.strip()[:500], content, mime)


@app.post("/api/trips/{trip_id}/to-english")
async def to_english(trip_id: str, text: str = Form(""), audio: UploadFile | None = File(None)):
    """Show to staff: anything the traveller says, as one polite English sentence."""
    trip = load_trip(trip_id)
    content, mime = await read_audio(audio)
    if not content and not text.strip():
        raise HTTPException(status_code=400, detail="Say or type what you want to tell staff.")
    s = trip.get("summary") or {}
    context = f"At the airport, flying {' + '.join(s.get('flights') or [])} to {s.get('destination_city') or ''}."
    return await asyncio.to_thread(gemini_call, gemini.to_english, trip.get("language", "en"),
                                   text.strip()[:500], content, mime, context)


@app.post("/api/trips/{trip_id}/boarding-pass")
async def boarding_pass(trip_id: str, file: UploadFile = File(...)):
    """Boarding pass explainer: read the photo, explain each field, fill gate + boarding time."""
    content, mime = await read_upload(file, "Boarding pass")
    data = await asyncio.to_thread(gemini_call, gemini.read_boarding_pass, content, mime)
    trip = load_trip(trip_id)
    trip["boarding_pass"] = data
    boarding = dict(trip.get("boarding") or {})
    if data.get("gate"):
        boarding["gate"] = data["gate"].strip().upper()[:8]
    if data.get("boarding_time"):
        boarding["boarding_time"] = data["boarding_time"][:5]
    trip["boarding"] = boarding
    save_trip(trip)
    return await asyncio.to_thread(trip_view, trip)


@app.post("/api/trips/{trip_id}/assist")
def request_assist(trip_id: str, req: AssistRequest):
    """Assistance request / I'm Lost alert: stored for the assist desk and published to Pub/Sub if configured."""
    trip = load_trip(trip_id)
    person = next((t for t in trip["travellers"] if t["id"] == req.traveller_id), None)
    if not person:
        raise HTTPException(status_code=404, detail="Traveller not found.")
    s, boarding = trip.get("summary") or {}, trip.get("boarding") or {}
    request = {
        "id": "AS-" + uuid.uuid4().hex[:6].upper(), "trip_id": trip_id, "kind": req.kind, "location": req.location,
        "note": req.note.strip(), "traveller": person["name"], "assistance_need": person.get("assistance"),
        "flight": " + ".join(s.get("flights") or []), "airport": s.get("origin_code"), "gate": boarding.get("gate"),
        "boarding_time": boarding.get("boarding_time"),
        "family_phone": ((trip.get("contacts") or [{}])[0]).get("phone"), "status": "open", "created_at": now_iso(),
    }
    store().set("assist_requests", request["id"], request)
    request["sent_to_desk"] = gcp.publish_assist(request)
    trip.setdefault("assist_requests", []).append(
        {k: request[k] for k in ("id", "kind", "location", "traveller", "status", "created_at", "sent_to_desk")})
    save_trip(trip)
    return {"request": request, "trip": trip_view(trip)}


@app.post("/api/tts")
def tts(req: TTSRequest):
    """Spoken answer (MP3, base64) via Cloud Text-to-Speech; 503 lets the app fall back to the phone's voice."""
    try:
        return {"audio": gcp.synthesize(req.text, req.language), "mime": "audio/mpeg"}
    except gcp.ServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        log.exception("TTS error")
        raise HTTPException(status_code=503, detail="Text-to-Speech is not available right now.")


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
