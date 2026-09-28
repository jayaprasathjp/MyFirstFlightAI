"""Rule-based trip validation. Pure functions: extracted document JSON in, checks out.

Every check is a dict: {id, traveller_id, status, title, message} where status is
pass | info | warn | fail. Messages are English; translation happens at the API layer.
"""
import re
from datetime import date, datetime, timedelta

from dateutil.relativedelta import relativedelta

STOPOVER = timedelta(hours=24)  # a gap longer than this ends the outbound journey
TITLES = {"MR", "MRS", "MS", "MISS", "MSTR", "MASTER", "DR", "PROF", "SHRI", "SMT"}


# ---------- parsing helpers ----------

def parse_date(value):
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        return None


def parse_dt(d, t):
    day = parse_date(d)
    if not day:
        return None
    try:
        hh, mm = (int(x) for x in (t or "00:00").strip()[:5].split(":"))
    except ValueError:
        hh, mm = 0, 0
    return datetime(day.year, day.month, day.day, hh, mm)


def name_tokens(name):
    words = re.split(r"[^A-Z]+", (name or "").upper())
    return frozenset(w for w in words if w and w not in TITLES)


def passport_name(passport):
    return " ".join(x for x in (passport.get("given_names"), passport.get("surname")) if x).strip()


def fmt_date(d):
    return d.strftime("%d %b %Y") if d else "unknown"


def same_country(a, b):
    a, b = (a or "").strip().casefold(), (b or "").strip().casefold()
    return bool(a and b and (a == b or a in b or b in a))


# ---------- itinerary ----------

def build_itinerary(ticket):
    """Split ticket segments into outbound / return legs and find the destination and transits."""
    segs = [s for s in (ticket.get("segments") or []) if s.get("origin_code") or s.get("destination_code")]
    segs.sort(key=lambda s: parse_dt(s.get("departure_date"), s.get("departure_time")) or datetime.max)
    if not segs:
        return None

    split = len(segs)
    for i in range(len(segs) - 1):
        arr = parse_dt(segs[i].get("arrival_date"), segs[i].get("arrival_time"))
        nxt = parse_dt(segs[i + 1].get("departure_date"), segs[i + 1].get("departure_time"))
        if arr and nxt and nxt - arr > STOPOVER:
            split = i + 1
            break
    outbound, inbound = segs[:split], segs[split:]
    first, last = outbound[0], outbound[-1]

    transits = []
    for a, b in zip(outbound, outbound[1:]):
        arr = parse_dt(a.get("arrival_date"), a.get("arrival_time"))
        dep = parse_dt(b.get("departure_date"), b.get("departure_time"))
        transits.append({
            "code": a.get("destination_code"), "city": a.get("destination_city"),
            "country": a.get("destination_country"),
            "layover_minutes": int((dep - arr).total_seconds() // 60) if arr and dep else None,
        })

    return {
        "origin_code": first.get("origin_code"), "origin_city": first.get("origin_city"),
        "origin_terminal": first.get("origin_terminal"),
        "destination_code": last.get("destination_code"), "destination_city": last.get("destination_city"),
        "destination_country": last.get("destination_country"),
        "flights": [s.get("flight_number") for s in outbound],
        "departure_date": first.get("departure_date"), "departure_time": first.get("departure_time"),
        "arrival_date": last.get("arrival_date"), "arrival_time": last.get("arrival_time"),
        "return_date": inbound[0].get("departure_date") if inbound else None,
        "return_flights": [s.get("flight_number") for s in inbound],
        "transits": transits,
    }


def trip_summary(ticket):
    it = build_itinerary(ticket or {})
    if not it:
        return None
    return {
        **it,
        "pnr": ticket.get("pnr"), "airline": ticket.get("airline"),
        "cabin_bag_kg": ticket.get("cabin_bag_kg"), "checked_bag_kg": ticket.get("checked_bag_kg"),
        "checkin_closes": ticket.get("checkin_closes"),
    }


# ---------- checks ----------

def _check(cid, tid, status, title, message):
    return {"id": cid, "traveller_id": tid, "status": status, "title": title, "message": message}


def check_traveller(trav):
    tid, docs = trav["id"], trav.get("documents") or {}
    ticket, passport, visa = docs.get("ticket") or {}, docs.get("passport") or {}, docs.get("visa") or {}
    pname = passport_name(passport) or trav.get("name") or "Traveller"
    who = pname.title()
    out = []

    it = build_itinerary(ticket)
    if not it:
        return [_check(f"{tid}:ticket", tid, "fail", f"{who}: ticket not readable",
                       "We could not read any flights from the ticket. Upload a clearer copy of the e-ticket.")]
    if not passport:
        return [_check(f"{tid}:passport", tid, "fail", f"{who}: passport missing", "Upload the passport photo page.")]

    # 1. Name matches across ticket, passport and visa
    p_tokens = name_tokens(pname)
    ticket_match = next((n for n in ticket.get("passenger_names") or [] if name_tokens(n) == p_tokens), None)
    visa_ok = not visa or name_tokens(visa.get("full_name")) == p_tokens
    if ticket_match and visa_ok:
        out.append(_check(f"{tid}:name", tid, "pass", f"{who}: name matches",
                          "The name is the same on the ticket, passport" + (" and visa." if visa else ".")))
    else:
        where = []
        if not ticket_match:
            where.append(f"ticket shows {', '.join(ticket.get('passenger_names') or ['no name'])}")
        if not visa_ok:
            where.append(f"visa shows {visa.get('full_name') or 'no name'}")
        out.append(_check(f"{tid}:name", tid, "fail", f"{who}: name does not match",
                          f"Passport says {pname}, but the {'; '.join(where)}. Ask the airline or visa office to correct it before you fly."))

    # 2. Passport valid 6 months beyond travel
    expiry = parse_date(passport.get("expiry_date"))
    start = parse_date(it["departure_date"])
    end = parse_date(it["return_date"]) or parse_date(it["arrival_date"]) or start
    if not expiry:
        out.append(_check(f"{tid}:passport_expiry", tid, "warn", f"{who}: passport expiry not readable",
                          "Check the expiry date on the passport. It must be valid at least 6 months after your trip."))
    elif start and expiry < start:
        out.append(_check(f"{tid}:passport_expiry", tid, "fail", f"{who}: passport has expired",
                          f"The passport expired on {fmt_date(expiry)}, before the flight. Renew it before travelling."))
    elif end and expiry < end + relativedelta(months=6):
        out.append(_check(f"{tid}:passport_expiry", tid, "warn", f"{who}: passport expires soon",
                          f"The passport expires on {fmt_date(expiry)}, less than 6 months after the trip ({fmt_date(end)}). "
                          "Many countries refuse entry. Renew it before flying."))
    else:
        out.append(_check(f"{tid}:passport_expiry", tid, "pass", f"{who}: passport valid",
                          f"Valid until {fmt_date(expiry)}, more than 6 months after the trip."))

    # 3. Visa covers destination and dates
    dest_country = it["destination_country"]
    if not visa:
        out.append(_check(f"{tid}:visa", tid, "warn", f"{who}: no visa uploaded",
                          f"Check whether {dest_country or 'the destination'} needs a visa for this passport."))
        return out
    if dest_country and visa.get("country") and not same_country(visa["country"], dest_country):
        out.append(_check(f"{tid}:visa_country", tid, "fail", f"{who}: visa is for a different country",
                          f"The visa is for {visa['country']}, but you are flying to {dest_country}."))
    vfrom, vuntil = parse_date(visa.get("valid_from")), parse_date(visa.get("valid_until"))
    arrive = parse_date(it["arrival_date"]) or start
    if not (vfrom and vuntil):
        out.append(_check(f"{tid}:visa_dates", tid, "warn", f"{who}: visa dates not readable",
                          "Check the 'valid from' and 'valid until' dates on the visa."))
    elif arrive and (arrive < vfrom or end > vuntil):
        out.append(_check(f"{tid}:visa_dates", tid, "fail", f"{who}: visa does not cover your dates",
                          f"The visa is valid {fmt_date(vfrom)} to {fmt_date(vuntil)}, but you arrive {fmt_date(arrive)}"
                          + (f" and leave {fmt_date(end)}." if it["return_date"] else ".")))
    else:
        out.append(_check(f"{tid}:visa_dates", tid, "pass", f"{who}: visa covers your trip",
                          f"Valid {fmt_date(vfrom)} to {fmt_date(vuntil)}."))
    max_stay = visa.get("max_stay_days")
    if max_stay and it["return_date"] and arrive and (end - arrive).days > max_stay:
        out.append(_check(f"{tid}:visa_stay", tid, "warn", f"{who}: stay is longer than the visa allows",
                          f"You plan to stay {(end - arrive).days} days, but the visa allows {max_stay} days per visit."))
    v_no, p_no = (visa.get("passport_number") or "").upper(), (passport.get("number") or "").upper()
    if v_no and p_no and v_no != p_no:
        out.append(_check(f"{tid}:visa_passport", tid, "fail", f"{who}: visa is on a different passport",
                          f"The visa lists passport {v_no}, but this passport is {p_no}. The visa must match the passport you carry."))
    return out


def check_trip(travellers):
    checks = [c for t in travellers for c in check_traveller(t)]
    itineraries = [(t, build_itinerary((t.get("documents") or {}).get("ticket") or {})) for t in travellers]
    itineraries = [(t, it) for t, it in itineraries if it]

    # Travellers on different flights
    keys = {(tuple(it["flights"]), it["departure_date"]) for _, it in itineraries}
    if len(keys) > 1:
        checks.append(_check("trip:flights", None, "warn", "Travellers are on different flights",
                             "Not everyone is on the same flight. Check each ticket, and plan where to meet."))

    # Transit: bags on the same booking go through; stay airside
    if itineraries:
        it = itineraries[0][1]
        for tr in it["transits"]:
            lay = tr["layover_minutes"]
            lay_txt = f"{lay // 60}h {lay % 60:02d}m" if lay is not None else "a short stop"
            checks.append(_check(f"trip:transit:{tr['code']}", None, "info", f"Change of plane at {tr['city'] or tr['code']}",
                                 f"You have {lay_txt} to change planes. Your flights are on one booking, so bags go straight to "
                                 f"{it['destination_city'] or it['destination_code']}. Follow 'Transfer' signs; do not exit to arrivals. "
                                 f"Check whether {tr['country'] or 'this country'} needs a transit visa for your passport."))
    return checks


def overall_status(checks):
    return "fix" if any(c["status"] in ("warn", "fail") for c in checks) else "ready"
