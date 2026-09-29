import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DB_BACKEND"] = "memory"

# Extracted JSON matching the sample PDFs (gautam_guru_ticket/passport/visa.pdf)
GAUTAM = {
    "ticket": {
        "passenger_names": ["MR GAUTAM GURU"], "pnr": "TST7Q2", "airline": "SkyLane Air",
        "ticket_number": "TEST-0000000001",
        "segments": [
            {"flight_number": "SL 301", "origin_code": "MAA", "origin_city": "Chennai", "origin_country": "India",
             "origin_terminal": "Terminal 2", "destination_code": "SIN", "destination_city": "Singapore",
             "destination_country": "Singapore", "destination_terminal": "Terminal 1",
             "departure_date": "2026-10-15", "departure_time": "23:50", "arrival_date": "2026-10-16", "arrival_time": "06:40"},
            {"flight_number": "SL 302", "origin_code": "SIN", "origin_city": "Singapore", "origin_country": "Singapore",
             "origin_terminal": "Terminal 1", "destination_code": "MAA", "destination_city": "Chennai",
             "destination_country": "India", "destination_terminal": "Terminal 2",
             "departure_date": "2026-10-25", "departure_time": "19:00", "arrival_date": "2026-10-25", "arrival_time": "20:40"},
        ],
        "cabin_bag_kg": 7, "checked_bag_kg": 20, "baggage_allowance_text": "Cabin 7 kg, checked 20 kg",
        "checkin_closes": "22:50",
    },
    "passport": {"surname": "GURU", "given_names": "GAUTAM", "number": "T0000001", "nationality": "UTOPIAN",
                 "date_of_birth": "1996-03-12", "expiry_date": "2032-01-09"},
    "visa": {"full_name": "GAUTAM GURU", "passport_number": "T0000001", "visa_type": "TOURIST / VISIT",
             "country": "SINGAPORE", "entries": "SINGLE", "valid_from": "2026-10-01", "valid_until": "2026-12-31",
             "max_stay_days": 30, "purpose": "VISITING FAMILY", "local_contact_name": "ARJUN GURU",
             "local_contact_relation": "SON", "local_contact_phone": "+65 8123 4567"},
}

# What Gemini trip advice returns for MAA -> SIN (shape of schemas.TripAdvice)
SG_ADVICE = {
    "currency_code": "SGD",
    "items": [
        {"id": "sg_arrival_card", "group": "t3", "title": "Submit SG Arrival Card online",
         "detail": "Free on the ICA official website, within 3 days before arrival.", "key": True},
        {"id": "chewing gum!", "group": "t1", "title": "Do not pack chewing gum", "detail": "It is not allowed.", "key": False},
        {"id": "bad group", "group": "someday", "title": "Plug type G adapter", "detail": "Singapore uses type G.", "key": False},
    ],
    "emigration_tips": ["Keep your boarding pass ready."],
    "transit_tips": [],
    "arrival_tips": ["Your SG Arrival Card is linked to your passport."],
    "customs_tips": ["Declare cigarettes; there is no duty-free allowance."],
}


@pytest.fixture
def sg_advice():
    return copy.deepcopy(SG_ADVICE)


@pytest.fixture
def gautam_docs():
    return copy.deepcopy(GAUTAM)


def traveller(docs, tid="t1", assistance="none"):
    return {"id": tid, "name": "Gautam Guru", "assistance": assistance, "documents": docs}
