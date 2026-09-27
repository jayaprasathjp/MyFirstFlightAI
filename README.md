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

---

## 🐳 Local Docker Testing

### Backend Docker Container

```bash
cd backend
docker build -t myfirstflightai-backend .
docker run -p 8080:8080 myfirstflightai-backend
```

### Frontend Docker Container

```bash
cd frontend
docker build --build-arg VITE_API_BASE_URL="http://localhost:8080" -t myfirstflightai .
docker run -p 8081:8080 myfirstflightai
```

---

## ☁️ Google Cloud Run Deployment

### Option A: Manual CLI Deployment via `gcloud`

#### 1. Set Google Cloud Project
```bash
gcloud config set project YOUR_PROJECT_ID
```

#### 2. Deploy Backend to Cloud Run
```bash
cd backend
gcloud run deploy myfirstflightai-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```
*Note the returned Backend Service URL (e.g. `https://myfirstflightai-backend-xyz-uc.a.run.app`).*

#### 3. Deploy Frontend to Cloud Run
```bash
cd frontend
gcloud run deploy myfirstflightai \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars VITE_API_BASE_URL="https://myfirstflightai-backend-xyz-uc.a.run.app"
```

---

## ⚡ Setting Up Cloud Build Triggers (CI/CD)

Automate deployments to Cloud Run whenever changes are pushed to your Git repository.

### 1. Enable Required GCP APIs
```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com
```

### 2. Grant Cloud Run Admin Rights to Cloud Build
```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 3. Connect Repository & Create Cloud Build Trigger

1. Go to **Google Cloud Console** > **Cloud Build** > **Triggers**.
2. Click **Create Trigger**.
3. Select your repository provider (GitHub, GitLab, or Cloud Source Repositories).
4. Configure Trigger options:
   - **Name**: `deploy-myfirstflightai-on-push`
   - **Event**: `Push to a branch`
   - **Branch regex**: `^main$` or `^master$`
   - **Configuration**: `Cloud Build configuration file (yaml)`
   - **Location**: `Repository`
   - **File Location**: `cloudbuild.yaml`
   - **Substitution variables**:
     - `_VITE_API_BASE_URL`: `https://myfirstflightai-backend-xyz-uc.a.run.app`
5. Click **Create**. Now, any push to the main branch automatically builds and deploys both frontend and backend services to Cloud Run!
