# MyFirstFlightAI

Full-stack web application with a **React (Vite)** frontend and a **FastAPI** backend, containerized for **Google Cloud Run** deployment with **Cloud Build** CI/CD triggers.

---

## 📁 Repository Structure

```
MyFirstFlightAI/
├── frontend/                 # React Frontend Application (Vite + Nginx)
│   ├── src/                  # React source files
│   ├── nginx.conf            # NGINX configuration for Cloud Run
│   ├── Dockerfile            # Multi-stage Docker build for React
│   └── package.json          # Node dependencies
├── backend/                  # FastAPI Backend Application
│   ├── main.py               # API routes (trips, travellers, checklist, translate, chat)
│   ├── gemini.py             # Gemini client: document extraction + translation
│   ├── schemas.py            # Strict JSON extraction schemas + request models
│   ├── validation.py         # Rule engine: names, passport 6-month rule, visa, transit
│   ├── checklist.py          # Personalized pre-flight checklist
│   ├── db.py                 # Firestore store (or in-memory with DB_BACKEND=memory)
│   ├── tests/                # pytest suite (Gemini mocked)
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Container definition for FastAPI
├── cloudbuild-backend.yaml   # Standalone Backend Cloud Build pipeline
├── cloudbuild-frontend.yaml  # Standalone Frontend Cloud Build pipeline
└── README.md                 # Project documentation
```

---

## 🚀 Local Development

### 1. Backend (FastAPI)

```bash
cd backend

# Create virtual environment (if not created yet)
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure: copy .env.example to .env and put your sa-key.json in backend/ (both gitignored)
# Use DB_BACKEND=memory to run without Firestore.

# Run development server
uvicorn main:app --reload --port 8000

# Run tests (no GCP access needed)
pip install pytest httpx
python -m pytest tests
```
- API Endpoint: `http://127.0.0.1:8000`
- Interactive API Docs (Swagger): `http://127.0.0.1:8000/docs`

### App flow (steps 1–5)

1. **Language**: 12 languages. UI text, check results and the checklist are translated by Gemini once, then cached in Firestore (`translations`) and on the device.
2. **Travellers**: upload ticket + passport + visa per person (PDF or photo), plus optional assistance needs.
3. **Extraction**: Gemini reads each document into strict JSON. Files are only processed in memory; only the extracted text is stored.
4. **Validation**: Python rules check name match, passport valid 6+ months after the trip, visa country/dates/stay length/passport number, transit and split flights.
5. **Checklist**: personalized T-3 / T-1 / travel-day list (bag limits from the ticket, leave-home time, arrival card, assistance, fixes from step 4). Ticks are saved to Firestore.

Firestore layout: `trips/{tripId}` holds language, travellers (extracted fields), summary, checks and checklist ticks.

**One-time GCP setup**: create a Firestore database (Native mode) in the project, and give the Cloud Run service account and the local dev service account the `Cloud Datastore User` role.

### 2. Frontend (React + Vite)

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
- Web Application: `http://localhost:5173`

---