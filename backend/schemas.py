"""Pydantic models: Gemini extraction schemas and API request bodies."""
import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

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
    typical_cabin_kg: Optional[float] = Field(None, description="this airline's usual economy cabin bag limit in kg for this route")
    typical_checked_kg: Optional[float] = Field(None, description="this airline's usual economy check-in bag allowance in kg for this route")
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


class QuickAnswers(BaseModel):
    answers: dict[str, bool]  # question id -> True ("yes, already done") / False ("not yet")


class ChecklistToggle(BaseModel):
    done: dict[str, bool]  # full map of item_id -> done; last write wins


def normalize_phone(raw: str) -> str | None:
    """Indian mobiles: exactly 10 digits starting 6-9 (+91 added if left out). Other country codes: 8-15 digits.
    Returns "+91 98765 43210" / "+6581234567", or None. Same rule as frontend/src/phone.js."""
    s = re.sub(r"[\s().-]", "", raw or "")
    india = re.fullmatch(r"(?:\+?91|0)?([6-9]\d{9})", s)
    if india:
        return f"+91 {india[1][:5]} {india[1][5:]}"
    if re.match(r"\+?91", s) or s.isdigit():
        return None  # Indian, or no country code, but not 10 digits
    other = re.fullmatch(r"\+(\d{8,15})", s)
    return f"+{other[1]}" if other else None


class Contact(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    relation: str = Field("", max_length=40)
    phone: str = Field(max_length=24)
    at_destination: bool = False

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        phone = normalize_phone(v)
        if not phone:
            raise ValueError("Indian mobile numbers need 10 digits; other numbers need their country code.")
        return phone


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


class Transcript(BaseModel):
    heard_clearly: bool = Field(True, description="false if there is no clear speech; never guess words")
    text: str = Field(description="exactly what was said, in the language and script it was spoken")


class LanguagePick(BaseModel):
    heard: str = Field(description="the words actually heard, in the script they were spoken; empty if none")
    code: str = Field(description="language code from the given list (e.g. ta, hi, en), or none")


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


FeedbackPart = Literal["documents", "checklist", "airport_steps", "help", "lost", "walkthrough", "voice"]


class FeedbackRequest(BaseModel):
    """After the trip: how it went (1 = very bad ... 5 = excellent), what helped, and anything else."""
    rating: int = Field(ge=1, le=5)
    helped: List[FeedbackPart] = Field([], max_length=7)
    comment: str = Field("", max_length=1000)


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: str
