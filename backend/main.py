import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
