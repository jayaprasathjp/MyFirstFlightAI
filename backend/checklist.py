"""Personalized pre-flight checklist built from the trip summary, travellers and validation checks."""
from datetime import timedelta

from validation import parse_date, parse_dt

AIRPORT_EARLY = timedelta(hours=3)   # reach the airport this long before an international departure
TRAVEL_TO_AIRPORT = timedelta(hours=1)
CURRENCY = {
    "singapore": "SGD", "malaysia": "MYR", "united arab emirates": "AED", "thailand": "THB",
    "united states": "USD", "united kingdom": "GBP", "saudi arabia": "SAR", "qatar": "QAR",
    "oman": "OMR", "kuwait": "KWD", "sri lanka": "LKR", "australia": "AUD", "canada": "CAD",
}
ASSIST_LABEL = {"elderly": "assistance", "wheelchair": "a wheelchair", "visually_impaired": "visual-impairment assistance"}


def _item(id, group, title, detail, key=False):
    return {"id": id, "group": group, "title": title, "detail": detail, "key": key}


def build_checklist(summary, travellers, checks):
    s = summary or {}
    country = s.get("destination_country") or "your destination"
    airline = s.get("airline") or "the airline"
    items = []

    # ----- T-3 days -----
    for c in checks:
        if c["status"] in ("warn", "fail") and c["traveller_id"]:
            items.append(_item("fix:" + c["id"], "t3", "Fix: " + c["title"], c["message"], key=True))

    if (country or "").casefold() == "singapore":
        items.append(_item("arrival_card", "t3", "Submit SG Arrival Card online",
                           "Free on Singapore ICA's official website, within 3 days before landing. One per traveller.", key=True))
    else:
        items.append(_item("arrival_card", "t3", f"Check if {country} needs an arrival card",
                           "If it does, fill it only on the official government website. It is usually free.", key=True))
    items.append(_item("webci", "t3", "Do web check-in",
                       f"Opens on {airline}'s website 48 hours before the flight. Choose seats together"
                       + (f" (booking {s['pnr']})." if s.get("pnr") else ".")))
    needs = [t for t in travellers if t.get("assistance", "none") != "none"]
    if needs:
        kinds = sorted({ASSIST_LABEL[t["assistance"]] for t in needs})
        names = ", ".join((t.get("name") or "traveller").title() for t in needs)
        items.append(_item("assist", "t3", f"Request {' and '.join(kinds)} for {names}",
                           f"Tell {airline} at least 48 hours before departure. It is free.", key=True))
    items.append(_item("lost_card", "t3", "Set up the I'm Lost card",
                       "Add a family phone number, check name spelling and choose the card language.", key=True))

    # ----- T-1 day -----
    cabin, checked = s.get("cabin_bag_kg"), s.get("checked_bag_kg")
    items += [
        _item("cabin_bag", "t1", f"Cabin bag {cabin:g} kg or less" if cabin else "Cabin bag within the weight on your ticket",
              "One cabin bag plus one small handbag per person. Weigh it at home."),
        _item("checked_bag", "t1", f"Check-in bag {checked:g} kg or less" if checked else "Check-in bag within your ticket allowance",
              "As printed on your ticket. Extra weight is costly at the airport."),
        _item("liquids", "t1", "Liquids in cabin: 100 ml each, in one clear bag",
              "Shampoo, pickle, ghee, creams. Bigger bottles go in the check-in bag, well sealed."),
        _item("power_banks", "t1", "Power banks only in the cabin bag", "Never in the check-in bag. It will be taken out."),
        _item("sharp", "t1", "No knives, scissors or lighters in the cabin bag", "Nail cutters and coconut scrapers too."),
        _item("medicines", "t1", "Medicines with prescription in the cabin bag", "Enough for the trip plus 2 extra days."),
        _item("print_docs", "t1", "Print or download tickets and visas", "Airport entry needs your ticket and passport."),
        _item("forex", "t1", f"Carry some {CURRENCY.get(country.casefold(), 'local currency')} or a forex card",
              "For a taxi or food right after landing."),
        _item("phone", "t1", "Charge phone and turn on roaming", "Keep the I'm Lost card saved for offline use."),
    ]

    # ----- Day of travel -----
    dep = parse_dt(s.get("departure_date"), s.get("departure_time"))
    if dep and s.get("departure_time"):
        reach, leave = dep - AIRPORT_EARLY, dep - AIRPORT_EARLY - TRAVEL_TO_AIRPORT
        term = str(s.get("origin_terminal") or "").strip()
        if term and not term.lower().startswith("terminal"):
            term = "Terminal " + term  # Gemini may return just "2"
        term = f", {term}" if term else ""
        airport = f"{s['origin_city']} airport" if s.get("origin_city") else "the airport"
        items.append(_item("leave_home", "t0", f"Leave home by {leave:%H:%M}",
                           f"Reach {airport}{term} by {reach:%H:%M}, 3 hours before the "
                           f"{dep:%H:%M} flight. Leave earlier if the airport is more than 1 hour away.", key=True))
    else:
        items.append(_item("leave_home", "t0", "Leave home early", "Reach the airport 3 hours before an international flight.", key=True))
    items += [
        _item("docs_in_hand", "t0", "Passports, visas and tickets in hand", "Keep them together in one pouch, not in the suitcase."),
        _item("test_lost", "t0", "Test the I'm Lost button once", "It works even without internet."),
    ]
    return items


def group_dates(summary):
    """Actual calendar date for each checklist group, e.g. {'t3': '2026-10-12', ...}."""
    dep = parse_date((summary or {}).get("departure_date"))
    if not dep:
        return {}
    return {"t3": (dep - timedelta(days=3)).isoformat(), "t1": (dep - timedelta(days=1)).isoformat(), "t0": dep.isoformat()}
