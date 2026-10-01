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
    gate_closes: Optional[str] = Field(None, description="Boarding gate closing time for the first flight, HH:MM")


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
    purpose: Optional[str] = Field(None, description="Declared purpose of visit, e.g. VISITING FAMILY")
    local_contact_name: Optional[str] = Field(None, description="Local contact / sponsor name in the destination")
    local_contact_relation: Optional[str] = Field(None, description="Relation of the local contact, e.g. SON")
    local_contact_phone: Optional[str] = None


EXTRACTION_MODELS = {"ticket": TicketData, "passport": PassportData, "visa": VisaData}


# ---------- Gemini trip advice (route- and country-specific) ----------

class AdviceItem(BaseModel):
    id: str = Field(description="short snake_case id, e.g. sg_arrival_card")
    group: str = Field(description="t3 (3 days before), t1 (day before) or t0 (travel day)")
    title: str = Field(description="short action, max 10 words")
    detail: str = Field(description="one or two plain sentences")
    key: bool = Field(False, description="true only if missing it can block boarding or entry")


class TripAdvice(BaseModel):
    currency_code: Optional[str] = Field(None, description="ISO code of the destination currency")
    origin_currency_code: Optional[str] = Field(None, description="ISO code of the origin (home) country currency")
    items: List[AdviceItem] = []
    emigration_tips: List[str] = Field([], description="departure passport control tips for the origin country")
    transit_tips: List[str] = Field([], description="tips for the transit airports, empty if none")
    arrival_tips: List[str] = Field([], description="arrival immigration tips for the destination")
    customs_tips: List[str] = Field([], description="destination customs rules that commonly catch these travellers")


# ---------- API bodies ----------

class CreateTripRequest(BaseModel):
    language: str = "en"


class UpdateTripRequest(BaseModel):
    language: str


class ChecklistToggle(BaseModel):
    done: dict[str, bool]  # full map of item_id -> done; last write wins


class Contact(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    relation: str = Field("", max_length=40)
    phone: str = Field(pattern=r"^\+?[0-9][0-9 ()-]{5,19}$")
    at_destination: bool = False


class ContactsRequest(BaseModel):
    contacts: List[Contact] = Field(min_length=1, max_length=5)


class BoardingRequest(BaseModel):
    gate: str = Field("", max_length=8)
    boarding_time: str = Field("", pattern=r"^$|^([01]?[0-9]|2[0-3]):[0-5][0-9]$")


class TranslateRequest(BaseModel):
    language: str
    texts: dict[str, str]


class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


# ---------- Helpers (step 7) ----------

class AskResult(BaseModel):
    heard_clearly: bool = Field(True, description="false if the audio is silent, noise, too short or the words cannot be made out; never guess words")
    language: str = Field(description="ISO 639-1 code of the language the traveller spoke or typed, e.g. ta, hi, en")
    question: str = Field(description="what the traveller asked, written in the language they used")
    answer: str = Field(description="the answer, in the same language the traveller used")


class StaffPhrase(BaseModel):
    heard_clearly: bool = Field(True, description="false if the audio is silent, noise, too short or the words cannot be made out; never guess words")
    original: str = Field(description="what the traveller said, in their language")
    english: str = Field(description="one short, polite English sentence to show airport staff")


class BoardingPassField(BaseModel):
    field: str = Field(description="field name as printed, e.g. GATE")
    value: str
    meaning: str = Field(description="one plain sentence explaining what it means for the traveller")


class BoardingPassData(BaseModel):
    passenger_name: Optional[str] = None
    flight_number: Optional[str] = None
    date: Optional[str] = Field(None, description="YYYY-MM-DD")
    origin_code: Optional[str] = None
    destination_code: Optional[str] = None
    departure_time: Optional[str] = Field(None, description="HH:MM")
    gate: Optional[str] = None
    boarding_time: Optional[str] = Field(None, description="HH:MM 24h")
    seat: Optional[str] = None
    boarding_group: Optional[str] = None
    fields: List[BoardingPassField] = Field([], description="every printed field, in order")


class AssistRequest(BaseModel):
    traveller_id: str
    kind: Literal["wheelchair", "escort", "visual", "lost"]
    location: Literal["entrance", "checkin", "security", "gate", "arrival", "unknown"] = "entrance"
    note: str = Field("", max_length=300)


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: str
