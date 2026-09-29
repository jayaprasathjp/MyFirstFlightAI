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
│   ├── main.py               # FastAPI application entrypoint with CORS
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Container definition for FastAPI
│   └── venv/                 # Local Python virtual environment
├── cloudbuild.yaml           # Unified Cloud Build pipeline for Frontend & Backend
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

# Create backend/.env from backend/.env.example and set local GCP/Firebase values
# Optional local service-account credentials: set GOOGLE_APPLICATION_CREDENTIALS=./sa-key.json
# Never commit backend/.env or backend/sa-key.json. On Cloud Run, use its attached service account.

# Run development server
uvicorn main:app --reload --port 8000
```
- API Endpoint: `http://127.0.0.1:8000`
- Interactive API Docs (Swagger): `http://127.0.0.1:8000/docs`

### 2. Frontend (React + Vite)

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
- Web Application: `http://localhost:5173`

## Security, Accounts, and Live Flight Status

See [docs/SECURITY_AND_DATA.md](docs/SECURITY_AND_DATA.md) for Firebase setup, encrypted Firestore/GCS storage, passport retention and deletion, Cloud Scheduler cleanup, and the free flight-status limit. The account and persistence features remain unavailable until the documented cloud resources and Firebase web configuration are provisioned.

---