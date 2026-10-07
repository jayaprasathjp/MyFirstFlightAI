"""Personalized pre-flight checklist.

Rule-based items come from facts (ticket, validation checks, assistance needs, universal airport rules).
Country- and route-specific items (arrival cards, customs, currency...) come from Gemini trip advice.
"""
import re
from datetime import timedelta

from validation import parse_date, parse_dt

AIRPORT_EARLY = timedelta(hours=3)   # reach the airport this long before an international departure
TRAVEL_TO_AIRPORT = timedelta(hours=1)
GROUPS = ("t3", "t1", "t0")
ASSIST_LABEL = {"elderly": "assistance", "wheelchair": "a wheelchair", "visually_impaired": "visual-impairment assistance"}

# Told to Gemini so its route-specific advice does not repeat what the rules already cover.
GENERIC_TITLES = [
    "web check-in", "request wheelchair/assistance", "cabin and check-in bag weight", "liquids 100 ml rule",
    "power banks in cabin bag", "no sharp items", "medicines with prescription", "print tickets and visas",
    "carry some local currency", "charge phone and roaming", "leave home 3 hours before", "documents in hand",
    "food and shopping on the plane may be paid",
]


# Official online arrival-card / pre-arrival declaration websites. Each one was opened and checked to load from
# the government site (Oct 2026). Never take URLs from Gemini (it can invent them). Re-check before adding more.
OFFICIAL_ARRIVAL_CARD = {
    "singapore": "https://eservices.ica.gov.sg/arrivalcard",                      # SG Arrival Card (ICA)
    "malaysia": "https://imigresen-online.imi.gov.my/mdac/main",                  # MDAC
    "thailand": "https://tdac.immigration.go.th/arrival-card/",                   # TDAC
    "indonesia": "https://allindonesia.imigrasi.go.id/",                          # All Indonesia
    "japan": "https://services.digital.go.jp/en/visit-japan-web/",                # Visit Japan Web
    "philippines": "https://etravel.gov.ph/",                                     # eTravel
    "taiwan": "https://twac.immigration.gov.tw/",                                 # Taiwan Arrival Card
    "new zealand": "https://www.travellerdeclaration.govt.nz/",                   # NZ Traveller Declaration
    "maldives": "https://imuga.immigration.gov.mv/",                              # IMUGA
    "india": "https://indianvisaonline.gov.in/earrival/",                         # e-Arrival (foreign nationals)
    "cambodia": "https://arrival.gov.kh/",                                        # Cambodia e-Arrival
    "mexico": "https://www.inm.gob.mx/fmme/publico/en/solicitud.html",            # FMM (multiple migration form)
}
ARRIVAL_CARD = re.compile(
    r"arrival card|arrival form|entry card|e-?arrival|digital arrival|arrival declaration|traveller declaration|"
    r"travel declaration|sgac|mdac|tdac|twac|visit japan web|etravel|all indonesia|imuga|fmm|forma migratoria", re.I)


def _item(id, group, title, detail, key=False, ai=False, optional=False, link=None):
    return {"id": id, "group": group, "title": title, "detail": detail, "key": key, "ai": ai,
            "optional": optional, "link": link}


def arrival_card_link(summary):
    country = ((summary or {}).get("destination_country") or "").strip().casefold()
    if country in OFFICIAL_ARRIVAL_CARD:
        return OFFICIAL_ARRIVAL_CARD[country]
    # Name variants, e.g. "Republic of the Philippines", "Taiwan (ROC)", "Kingdom of Thailand"
    return next((url for name, url in OFFICIAL_ARRIVAL_CARD.items() if country and name in country), None)


# Safe fallbacks when neither the ticket nor the airline's usual allowance is known (kept low on purpose:
# packing to a lower limit never causes extra fees at the airport).
DEFAULT_BAG_KG = {"cabin_bag_kg": 7, "checked_bag_kg": 15}
ADVICE_BAG = {"cabin_bag_kg": "typical_cabin_kg", "checked_bag_kg": "typical_checked_kg"}


def with_baggage(summary, advice=None):
    """Summary with cabin/check-in weights always filled: ticket > airline's usual (Gemini) > safe default.

    Adds cabin_bag_source / checked_bag_source = "ticket" | "airline" | "default" so the app can say where it came from.
    """
    if not summary:
        return summary
    s = dict(summary)
    for field, default in DEFAULT_BAG_KG.items():
        source = field.replace("_kg", "_source")
        if s.get(field):
            s[source] = "ticket"
        elif (advice or {}).get(ADVICE_BAG[field]):
            s[field], s[source] = float(advice[ADVICE_BAG[field]]), "airline"
        else:
            s[field], s[source] = float(default), "default"
    return s


BOARDING_BEFORE_DEPARTURE = timedelta(minutes=45)  # typical boarding start for international flights


def boarding_estimate(summary):
    """Estimated boarding time (HH:MM) until the real one comes from the boarding pass; None if unknown."""
    s = summary or {}
    dep = parse_dt(s.get("departure_date"), s.get("departure_time"))
    return f"{dep - BOARDING_BEFORE_DEPARTURE:%H:%M}" if dep and s.get("departure_time") else None


def airport_plan(summary):
    """Departure time, when to reach the airport and when to leave home; None if the time is unknown."""
    s = summary or {}
    dep = parse_dt(s.get("departure_date"), s.get("departure_time"))
    if not (dep and s.get("departure_time")):
        return None
    term = str(s.get("origin_terminal") or "").strip()
    if term and not term.lower().startswith("terminal"):
        term = "Terminal " + term  # Gemini may return just "2"
    return {
        "dep": dep, "reach": dep - AIRPORT_EARLY, "leave": dep - AIRPORT_EARLY - TRAVEL_TO_AIRPORT,
        "airport": f"{s['origin_city']} airport" if s.get("origin_city") else "the airport", "terminal": term,
    }


def advice_items(advice, card_link=None):
    items, seen = [], set()
    for a in (advice or {}).get("items") or []:
        slug = re.sub(r"[^a-z0-9]+", "_", (a.get("id") or a.get("title") or "").lower()).strip("_")[:40]
        if not slug or slug in seen or not a.get("title"):
            continue
        seen.add(slug)
        group = a.get("group") if a.get("group") in GROUPS else "t3"
        link = card_link if ARRIVAL_CARD.search(f"{slug} {a['title']}") else None
        items.append(_item("ai:" + slug, group, a["title"], a.get("detail") or "", key=bool(a.get("key")), ai=True, link=link))
    return items


def build_checklist(summary, travellers, checks, advice=None, contacts=None):
    s = summary or {}
    country = s.get("destination_country") or "your destination"
    airline = s.get("airline") or "the airline"
    items = []

    # ----- T-3 days -----
    for c in checks:
        if c["status"] in ("warn", "fail") and c["traveller_id"]:
            items.append(_item("fix:" + c["id"], "t3", "Fix: " + c["title"], c["message"], key=True))

    card_link = arrival_card_link(s)
    ai = advice_items(advice, card_link)
    if not ai:  # Gemini advice unavailable: fall back to a safe generic reminder
        items.append(_item("arrival_card", "t3", f"Check if {country} needs an arrival card",
                           "If it does, fill it only on the official government website. It is usually free.",
                           key=True, link=card_link))
    items.append(_item("webci", "t3", "Do web check-in",
                       "Most useful if you have no check-in bag: you can skip the check-in counter. "
                       f"Opens on {airline}'s website 48 hours before the flight. Choose seats together"
                       + (f" (booking {s['pnr']})." if s.get("pnr") else "."), optional=True))
    needs = [t for t in travellers if t.get("assistance", "none") != "none"]
    if needs:
        kinds = sorted({ASSIST_LABEL[t["assistance"]] for t in needs})
        names = ", ".join((t.get("name") or "traveller").title() for t in needs)
        items.append(_item("assist", "t3", f"Request {' and '.join(kinds)} for {names}",
                           f"If needed, tell {airline} at least 48 hours before departure. It is free.", optional=True))

    # ----- T-1 day -----
    s = with_baggage(s, advice)
    cabin, checked = s.get("cabin_bag_kg"), s.get("checked_bag_kg")
    bag_note = {"ticket": "", "airline": f" This is {airline}'s usual limit; your ticket does not show it, so please confirm.",
                "default": " Your ticket does not show it, so this is a safe limit; please confirm with the airline."}
    currency = (advice or {}).get("currency_code") or "local currency"
    home_currency = (advice or {}).get("origin_currency_code")
    onboard_cash = " or ".join(c for c in (home_currency, (advice or {}).get("currency_code")) if c) or "some cash"
    items += [
        _item("cabin_bag", "t1", f"Cabin bag {cabin:g} kg or less",
              "One cabin bag plus one small handbag per person. Weigh it at home." + bag_note[s["cabin_bag_source"]]),
        _item("checked_bag", "t1", f"Check-in bag {checked:g} kg or less",
              ("As printed on your ticket. " if s["checked_bag_source"] == "ticket" else "")
              + "Extra weight is costly at the airport." + bag_note[s["checked_bag_source"]]),
        _item("liquids", "t1", "Liquids in cabin: 100 ml each, in one clear bag",
              "Shampoo, pickle, ghee, creams. Bigger bottles go in the check-in bag, well sealed."),
        _item("power_banks", "t1", "Power banks only in the cabin bag", "Never in the check-in bag. It will be taken out."),
        _item("sharp", "t1", "No knives, scissors or lighters in the cabin bag", "Nail cutters and coconut scrapers too."),
        _item("medicines", "t1", "Medicines with prescription in the cabin bag", "Enough for the trip plus 2 extra days."),
        _item("print_docs", "t1", "Print or download tickets and visas", "Airport entry needs your ticket and passport."),
        _item("forex", "t1", f"Carry some {currency} or a forex card", "For a taxi or food right after landing."),
        _item("onboard_money", "t1", "Food and shopping on the plane may cost money",
              f"Only what your fare includes is free. Extra snacks, drinks and shopping are paid: keep {onboard_cash}"
              " or a debit/credit card in your handbag."),
        _item("phone", "t1", "Charge phone and turn on roaming", "So your family can reach you after landing."),
    ]

    # ----- Day of travel -----
    plan = airport_plan(s)
    if plan:
        term = f", {plan['terminal']}" if plan["terminal"] else ""
        items.append(_item("leave_home", "t0", f"Leave home by {plan['leave']:%H:%M}",
                           f"Reach {plan['airport']}{term} by {plan['reach']:%H:%M}, 3 hours before the "
                           f"{plan['dep']:%H:%M} flight. Leave earlier if the airport is more than 1 hour away.", key=True))
    else:
        items.append(_item("leave_home", "t0", "Leave home early", "Reach the airport 3 hours before an international flight.", key=True))
    items += [
        _item("docs_in_hand", "t0", "Passports, visas and tickets in hand", "Keep them together in one pouch, not in the suitcase."),
        _item("lost_card", "t0", "Check the I'm Lost card once",
              "Tap the red I'm Lost button and check the names and family phone number. It works even without internet."
              if contacts else "Add a family phone number in the Contacts step. It appears on the I'm Lost card.", key=True),
    ]

    # AI items go first within their group, after fixes (they are the destination-specific tasks).
    order = {g: i for i, g in enumerate(GROUPS)}
    fixes = [i for i in items if i["id"].startswith("fix:")]
    rest = [i for i in items if not i["id"].startswith("fix:")]
    return sorted(fixes + ai + rest, key=lambda i: order[i["group"]])


def quick_questions(summary, travellers, items):
    """Yes/no questions asked after upload; 'yes, already done' removes that item from the checklist."""
    s = summary or {}
    airline = s.get("airline") or "the airline"
    ids = {i["id"] for i in items}
    questions = []
    if "webci" in ids:
        questions.append({"id": "webci", "question": "Have you already done web check-in"
                          + (f" (booking {s['pnr']})?" if s.get("pnr") else "?")})
    if "assist" in ids:
        needs = [t for t in travellers if t.get("assistance", "none") != "none"]
        kinds = " and ".join(sorted({ASSIST_LABEL[t["assistance"]] for t in needs}))
        names = ", ".join((t.get("name") or "traveller").title() for t in needs)
        questions.append({"id": "assist", "question": f"Have you already asked {airline} for {kinds} for {names}?"})
    return questions


def group_dates(summary):
    """Actual calendar date for each checklist group, e.g. {'t3': '2026-10-12', ...}."""
    dep = parse_date((summary or {}).get("departure_date"))
    if not dep:
        return {}
    return {"t3": (dep - timedelta(days=3)).isoformat(), "t1": (dep - timedelta(days=1)).isoformat(), "t0": dep.isoformat()}
