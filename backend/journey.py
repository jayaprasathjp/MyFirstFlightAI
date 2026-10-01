"""Journey deck: tap-through airport steps built from the real trip, contacts, boarding pass and Gemini tips.

Each step: {id, title, where[], do[], qa[[question, answer]], qa_alts[[other answers]], staff}. `qa` and `staff`
stay in English for officers and staff; the API adds translations alongside them.
"""
from checklist import airport_plan
from validation import fmt_date, parse_date

# Other honest answers to "why are you travelling?" (keyword, departure answer, arrival answer).
PURPOSES = [
    ("holiday", "To {city}, for a holiday.", "Tourism, a holiday."),
    ("personal", "To {city}, on a personal visit.", "A personal visit."),
    ("family", "To {city}, to meet my family.", "Visiting my family."),
    ("friend", "To {city}, to meet a friend.", "Meeting a friend."),
    ("business", "To {city}, for business meetings.", "Business meetings."),
]


def _step(id, title, where, do, staff, qa=None, qa_alts=None):
    qa = qa or []
    alts = (qa_alts or []) + [[] for _ in range(len(qa) - len(qa_alts or []))]
    return {"id": id, "title": title, "where": [w for w in where if w], "do": [d for d in do if d],
            "qa": qa, "qa_alts": alts, "staff": staff}


def purpose_alternatives(purpose, city):
    """(departure answers, arrival answers) for purposes other than the one on the visa."""
    other = [p for p in PURPOSES if p[0] not in purpose]
    return [d.format(city=city) for _, d, _ in other], [a for _, _, a in other]


def destination_contact(travellers, contacts):
    """Person to meet at the destination: saved contact first, else the visa's local contact."""
    for c in contacts or []:
        if c.get("at_destination"):
            return {"name": c["name"], "relation": c.get("relation") or "", "phone": c["phone"]}
    for t in travellers:
        v = (t.get("documents") or {}).get("visa") or {}
        if v.get("local_contact_name"):
            return {"name": v["local_contact_name"].title(), "relation": (v.get("local_contact_relation") or "").lower(),
                    "phone": v.get("local_contact_phone") or ""}
    return None


def build_journey(summary, travellers, advice=None, contacts=None, boarding=None):
    s, adv, boarding = summary or {}, advice or {}, boarding or {}
    if not s:
        return []
    flight = s["flights"][0] if s.get("flights") else "your flight"
    last_flight = s["flights"][-1] if s.get("flights") else flight
    dest_city = s.get("destination_city") or s.get("destination_code") or "your destination"
    dest_country = s.get("destination_country") or dest_city
    origin_country = s.get("origin_country") or ""
    gate, boarding_time = boarding.get("gate"), boarding.get("boarding_time")
    plan = airport_plan(s)
    visa = next(((t.get("documents") or {}).get("visa") for t in travellers if (t.get("documents") or {}).get("visa")), {}) or {}
    purpose = (visa.get("purpose") or "").strip().lower()
    arrive, leave = parse_date(s.get("arrival_date")), parse_date(s.get("return_date"))
    days = (leave - arrive).days if arrive and leave else None
    host = destination_contact(travellers, contacts)
    steps = []

    steps.append(_step("entry", "Reach the airport",
        [plan and plan["airport"].replace(" airport", " Airport"), plan and plan["terminal"], "Departures"],
        [plan and f"Be at the airport by {plan['reach']:%H:%M}, 3 hours before the {plan['dep']:%H:%M} flight.",
         "At the entry gate, show your passport and ticket to the security officer.",
         "Take a free trolley near the entrance for your bags."],
        "Which way to international departures?"))

    steps.append(_step("checkin", "Check-in counter", [s.get("airline"), flight],
        [f"Find {flight} on the departure screens. It shows your check-in counter row.",
         s.get("checkin_closes") and f"Check-in closes at {s['checkin_closes']}. Join the queue well before that.",
         "Show passports and visas. Put check-in bags on the belt"
         + (f" (up to {s['checked_bag_kg']:g} kg each)." if s.get("checked_bag_kg") else "."),
         "Keep power banks and medicines in your cabin bag.",
         "Take your boarding pass. Add the gate and boarding time below, so they show on your I'm Lost card."],
        f"Where is the check-in counter for {flight}?"))

    dep_alts, arr_alts = purpose_alternatives(purpose, dest_city)
    emig_qa = [["Where are you going?", f"To {dest_city}" + (f", for {purpose}." if purpose else ".")]]
    if days:
        emig_qa.append(["How long will you stay?", f"{days} days. Here is my return ticket."])
    steps.append(_step("emigration", "Emigration (passport control)", [origin_country, "Emigration"],
        ["Join the queue for your passport type.",
         "Show passport, visa and boarding pass together.",
         "The officer checks your documents and may stamp your passport.",
         *adv.get("emigration_tips", [])],
        "Which queue is for emigration?", emig_qa, [dep_alts]))

    steps.append(_step("security", "Security check", ["Security"],
        ["Put phone, wallet, belt, coins and laptop in the tray.",
         "Liquids of 100 ml or less go in one clear bag, in the tray.",
         "Walk through the frame when the officer signals.",
         "A beep is normal. They may check you by hand."],
        "Can I keep my medicines with me?"))

    steps.append(_step("gate", "Wait at the gate", [f"Gate {gate}" if gate else "Gate: see boarding pass",
                                                   boarding_time and f"Boarding {boarding_time}"],
        [f"Walk to Gate {gate}. Follow the gate signs." if gate else "Walk to the gate printed on your boarding pass.",
         "Watch the screens. Gates can change.",
         s.get("gate_closes") and f"The gate closes at {s['gate_closes']}. Be there before that.",
         "Board when your group is called. Show your boarding pass and passport."],
        f"Where is Gate {gate}?" if gate else "Where is my gate? Here is my boarding pass."))

    flights = s.get("flights") or []
    for i, tr in enumerate(s.get("transits") or []):
        nxt = flights[i + 1] if i + 1 < len(flights) else "your next flight"
        lay = tr.get("layover_minutes")
        steps.append(_step(f"transit_{i}", f"Change planes at {tr.get('city') or tr.get('code')}",
            [tr.get("code"), "Transfer"],
            [lay is not None and f"You have {lay // 60}h {lay % 60:02d}m to change planes.",
             "Follow 'Transfer' or 'Connecting flights' signs. Do NOT go to arrivals or baggage claim.",
             f"Find {nxt} on the screens to get your next gate.",
             f"Your check-in bags go straight to {dest_city}.",
             *adv.get("transit_tips", [])],
            f"I have a connecting flight, {nxt}. Where is the transfer area?"))

    arr_qa = [["What is the purpose of your visit?", purpose.capitalize() + "." if purpose else "A short visit."]]
    if days:
        arr_qa.append(["How long will you stay?", f"{days} days."])
    if host:
        rel = f" ({host['relation']})" if host["relation"] else ""
        arr_qa.append(["Where will you stay?", f"With {host['name']}{rel}. Phone: {host['phone']}." if host["phone"]
                       else f"With {host['name']}{rel}."])
    if s.get("return_date"):
        ret = s["return_flights"][0] if s.get("return_flights") else "my return flight"
        arr_qa.append(["Do you have a return ticket?", f"Yes, {ret} on {fmt_date(leave)}."])
    steps.append(_step("arrival", f"{dest_country} immigration", [s.get("destination_code"), "Arrivals", "Immigration"],
        ["Follow 'Arrival' and 'Immigration' signs.",
         "Show your passport and visa. Look at the camera if asked.",
         *adv.get("arrival_tips", [])],
        "Where is immigration?", arr_qa, [arr_alts]))

    steps.append(_step("baggage", "Bags and customs", ["Baggage belt", "Customs"],
        [f"Find {last_flight} on the baggage screen. It shows your belt number.",
         "Collect your bags and check the name tags.",
         "Nothing to declare? Walk through the green channel.",
         *adv.get("customs_tips", []),
         f"Exit to the arrival hall to meet {host['name']}." if host else "Exit to the arrival hall."],
        f"Which belt is for flight {last_flight}?"))
    return steps
