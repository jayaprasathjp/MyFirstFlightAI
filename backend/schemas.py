"""Pydantic models: Gemini extraction schemas and API request bodies."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

DocType = Literal["ticket", "passport", "visa"]
Assistance = Literal["none", "elderly", "wheelchair", "visually_impaired"]


# ---------- Gemini extraction output (strict JSON) ----------

class Segment(BaseModel):
    flight_number: Optional[str] = None
    origin_code: Optional[str] = Field(None, description="IATA airport code, e.g. MAA")
    origin_city: Optional[str] = None
    origin_country: Optional[str] = None
    origin_terminal: Optional[str] = None
    destination_code: Optional[str] = Field(None, description="IATA airport code, e.g. SIN")
    destination_city: Optional[str] = None
    destination_country: Optional[str] = None
    destination_terminal: Optional[str] = None
    departure_date: Optional[str] = Field(None, description="YYYY-MM-DD, local time")
    departure_time: Optional[str] = Field(None, description="HH:MM 24h, local time")
    arrival_date: Optional[str] = Field(None, description="YYYY-MM-DD, local time")
    arrival_time: Optional[str] = Field(None, description="HH:MM 24h, local time")


class TicketData(BaseModel):
    passenger_names: List[str] = []
    pnr: Optional[str] = Field(None, description="Booking reference / PNR")
    airline: Optional[str] = None
    ticket_number: Optional[str] = None
    segments: List[Segment] = []
    cabin_bag_kg: Optional[float] = None
    checked_bag_kg: Optional[float] = None
    baggage_allowance_text: Optional[str] = None
    checkin_closes: Optional[str] = Field(None, description="Check-in closing time for the first flight, HH:MM")


class PassportData(BaseModel):
    surname: Optional[str] = None
    given_names: Optional[str] = None
    number: Optional[str] = None
    nationality: Optional[str] = None
    date_of_birth: Optional[str] = Field(None, description="YYYY-MM-DD")
    expiry_date: Optional[str] = Field(None, description="YYYY-MM-DD")


class VisaData(BaseModel):
    full_name: Optional[str] = None
    passport_number: Optional[str] = None
    visa_type: Optional[str] = None
    country: Optional[str] = Field(None, description="Country the visa is issued for (destination)")
    entries: Optional[str] = None
    valid_from: Optional[str] = Field(None, description="YYYY-MM-DD")
    valid_until: Optional[str] = Field(None, description="YYYY-MM-DD")
    max_stay_days: Optional[int] = None


EXTRACTION_MODELS = {"ticket": TicketData, "passport": PassportData, "visa": VisaData}


# ---------- API bodies ----------

class CreateTripRequest(BaseModel):
    language: str = "en"


class UpdateTripRequest(BaseModel):
    language: str


class ChecklistToggle(BaseModel):
    done: dict[str, bool]  # full map of item_id -> done; last write wins


class TranslateRequest(BaseModel):
    language: str
    texts: dict[str, str]


class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
