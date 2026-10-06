"""Live flight status (delays, cancellations, gate changes) from aviationstack.com.

Free plan = 100 requests/month, so results are cached per flight+date in Firestore (`flight_status`) and shared
by everyone on that flight, and the API is only called around travel day.
FLIGHT_STATUS_DEMO=SL301=delayed:45:B12 fakes a status for test flights that do not exist (e.g. SL 301).
"""
import logging
import os
from datetime import datetime, timedelta, timezone

import requests

from db import now_iso, store
from validation import parse_dt

log = logging.getLogger("myfirstflight")

API = "https://api.aviationstack.com/v1/flights"
CACHE = timedelta(minutes=30)
WINDOW_BEFORE, WINDOW_AFTER = timedelta(hours=24), timedelta(hours=12)  # only check around the departure


def _hhmm(value):
    # aviationstack sends local airport times labelled "+00:00": read the clock time as is.
    return value[11:16] if isinstance(value, str) and len(value) >= 16 else None


def _demo(code):
    for entry in (os.getenv("FLIGHT_STATUS_DEMO") or "").split(","):
        flight, _, spec = entry.partition("=")
        if flight.strip().upper() == code:
            status, delay, gate = (spec.split(":") + ["", "", ""])[:3]
            return {"status": status or "delayed", "delay_min": int(delay) if delay.isdigit() else None,
                    "gate": gate or None, "terminal": None, "estimated": None, "arrival_gate": None,
                    "baggage_belt": None, "demo": True}
    return None


def _fetch(code, date):
    key = os.getenv("AVIATIONSTACK_KEY")
    if not key:
        return None
    r = requests.get(API, params={"access_key": key, "flight_iata": code, "limit": 10}, timeout=20)
    data = r.json()
    if "error" in data:
        log.warning("aviationstack error: %s", data["error"])
        return None
    flights = data.get("data") or []
    f = next((x for x in flights if x.get("flight_date") == date), None)
    if not f:
        return None
    dep, arr = f.get("departure") or {}, f.get("arrival") or {}
    return {"status": f.get("flight_status"), "delay_min": dep.get("delay"), "gate": dep.get("gate"),
            "terminal": dep.get("terminal"), "estimated": _hhmm(dep.get("estimated")),
            "arrival_gate": arr.get("gate"), "baggage_belt": arr.get("baggage"), "demo": False}


def flight_status(summary, now=None):
    """Latest status for the trip's first flight, or None if unknown / not travel day yet."""
    s = summary or {}
    flight, date = (s.get("flights") or [None])[0], s.get("departure_date")
    if not flight or not date:
        return None
    code = flight.replace(" ", "").upper()
    demo = _demo(code)
    if demo:
        return {**demo, "flight": flight, "checked_at": now_iso()}

    dep = parse_dt(date, s.get("departure_time"))
    now = now or datetime.now()
    if not dep or not (dep - WINDOW_BEFORE <= now <= dep + WINDOW_AFTER):
        return None
    cache_id = f"{code}_{date}"
    cached = store().get("flight_status", cache_id)
    if cached and datetime.now(timezone.utc) - datetime.fromisoformat(cached["checked_at"]) < CACHE:
        return cached.get("data")
    try:
        data = _fetch(code, date)
    except Exception:
        log.exception("flight status fetch failed")
        return cached.get("data") if cached else None
    result = {**data, "flight": flight, "checked_at": now_iso()} if data else None
    store().set("flight_status", cache_id, {"data": result, "checked_at": now_iso()})
    return result


def status_alert(status, summary, boarding=None):
    """English popup text for anything the traveller should know, or None if all is normal."""
    if not status:
        return None
    flight, delay, gate = status["flight"], status.get("delay_min"), status.get("gate")
    s = summary or {}
    if status.get("status") == "cancelled":
        return {"level": "bad", "title": f"Flight {flight} is cancelled",
                "message": f"Please contact {s.get('airline') or 'the airline'} or go to the airline counter. "
                           "Show this message to airline staff."}
    lines = []
    if delay and delay >= 15:
        new = f" New departure time: {status['estimated']}." if status.get("estimated") else ""
        lines.append(f"Flight {flight} is delayed by {delay} minutes.{new}")
    my_gate = (boarding or {}).get("gate")
    if gate and my_gate and gate.upper() != my_gate.upper():
        lines.append(f"Gate changed from {my_gate} to {gate}. Please go to Gate {gate}.")
    elif gate and delay and delay >= 15:
        lines.append(f"Gate: {gate}.")
    if not lines:
        return None
    return {"level": "warn", "title": f"Flight {flight} update", "message": " ".join(lines)}
