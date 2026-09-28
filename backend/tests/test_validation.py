from checklist import build_checklist, group_dates
from conftest import traveller
from validation import build_itinerary, check_trip, overall_status, trip_summary


def by_id(checks):
    return {c["id"]: c for c in checks}


def test_sample_documents_are_ready_to_fly(gautam_docs):
    checks = check_trip([traveller(gautam_docs)])
    assert overall_status(checks) == "ready", checks
    ids = by_id(checks)
    assert ids["t1:name"]["status"] == "pass"
    assert ids["t1:passport_expiry"]["status"] == "pass"
    assert ids["t1:visa_dates"]["status"] == "pass"


def test_itinerary_splits_round_trip(gautam_docs):
    it = build_itinerary(gautam_docs["ticket"])
    assert (it["origin_code"], it["destination_code"], it["destination_country"]) == ("MAA", "SIN", "Singapore")
    assert it["flights"] == ["SL 301"] and it["return_flights"] == ["SL 302"]
    assert it["return_date"] == "2026-10-25" and it["transits"] == []


def test_name_match_ignores_order_titles_and_case(gautam_docs):
    gautam_docs["ticket"]["passenger_names"] = ["GURU/GAUTAM MR"]
    gautam_docs["visa"]["full_name"] = "Guru, Gautam"
    assert by_id(check_trip([traveller(gautam_docs)]))["t1:name"]["status"] == "pass"


def test_name_mismatch_is_flagged(gautam_docs):
    gautam_docs["ticket"]["passenger_names"] = ["MR GOUTAM GURU"]
    c = by_id(check_trip([traveller(gautam_docs)]))["t1:name"]
    assert c["status"] == "fail" and "GOUTAM" in c["message"]


def test_passport_expiring_within_six_months_of_return(gautam_docs):
    gautam_docs["passport"]["expiry_date"] = "2027-02-03"
    checks = check_trip([traveller(gautam_docs)])
    assert by_id(checks)["t1:passport_expiry"]["status"] == "warn"
    assert overall_status(checks) == "fix"


def test_expired_passport_fails(gautam_docs):
    gautam_docs["passport"]["expiry_date"] = "2026-01-01"
    assert by_id(check_trip([traveller(gautam_docs)]))["t1:passport_expiry"]["status"] == "fail"


def test_visa_not_covering_return_date(gautam_docs):
    gautam_docs["visa"]["valid_until"] = "2026-10-20"
    assert by_id(check_trip([traveller(gautam_docs)]))["t1:visa_dates"]["status"] == "fail"


def test_visa_for_wrong_country_and_passport(gautam_docs):
    gautam_docs["visa"]["country"] = "MALAYSIA"
    gautam_docs["visa"]["passport_number"] = "X1234567"
    ids = by_id(check_trip([traveller(gautam_docs)]))
    assert ids["t1:visa_country"]["status"] == "fail"
    assert ids["t1:visa_passport"]["status"] == "fail"


def test_stay_longer_than_visa_allows(gautam_docs):
    gautam_docs["visa"]["max_stay_days"] = 5
    assert by_id(check_trip([traveller(gautam_docs)]))["t1:visa_stay"]["status"] == "warn"


def test_transit_is_detected(gautam_docs):
    segs = gautam_docs["ticket"]["segments"]
    segs[0].update(destination_code="KUL", destination_city="Kuala Lumpur", destination_country="Malaysia",
                   arrival_date="2026-10-16", arrival_time="02:00")
    segs.insert(1, {**segs[0], "flight_number": "SL 900", "origin_code": "KUL", "origin_city": "Kuala Lumpur",
                    "destination_code": "SIN", "destination_city": "Singapore", "destination_country": "Singapore",
                    "departure_date": "2026-10-16", "departure_time": "04:30", "arrival_date": "2026-10-16", "arrival_time": "05:40"})
    checks = check_trip([traveller(gautam_docs)])
    transit = by_id(checks)["trip:transit:KUL"]
    assert transit["status"] == "info" and "2h 30m" in transit["message"]
    assert overall_status(checks) == "ready"


def test_travellers_on_different_flights(gautam_docs):
    import copy
    other = copy.deepcopy(gautam_docs)
    other["ticket"]["segments"][0]["flight_number"] = "SL 305"
    checks = check_trip([traveller(gautam_docs), traveller(other, "t2")])
    assert by_id(checks)["trip:flights"]["status"] == "warn"


def test_checklist_is_personalized(gautam_docs, sg_advice):
    gautam_docs["passport"]["expiry_date"] = "2027-02-03"
    travellers = [traveller(gautam_docs, assistance="wheelchair")]
    checks = check_trip(travellers)
    summary = trip_summary(gautam_docs["ticket"])
    items = {i["id"]: i for i in build_checklist(summary, travellers, checks, sg_advice)}

    # Country-specific items come from Gemini advice, sanitized
    assert items["ai:sg_arrival_card"]["title"] == "Submit SG Arrival Card online"
    assert items["ai:sg_arrival_card"]["ai"] and items["ai:sg_arrival_card"]["key"]
    assert items["ai:chewing_gum"]["group"] == "t1"
    assert items["ai:bad_group"]["group"] == "t3"                   # unknown group falls back to t3
    assert "arrival_card" not in items                              # no generic fallback when advice exists
    assert items["forex"]["title"].startswith("Carry some SGD")
    # Facts from the ticket and rules
    assert items["cabin_bag"]["title"] == "Cabin bag 7 kg or less"
    assert items["checked_bag"]["title"] == "Check-in bag 20 kg or less"
    assert items["leave_home"]["title"] == "Leave home by 19:50"      # 23:50 - 3h - 1h
    assert "Reach Chennai airport, Terminal 2 by 20:50" in items["leave_home"]["detail"]
    summary["origin_terminal"] = "2"  # Gemini sometimes returns just the number
    again = {i["id"]: i for i in build_checklist(summary, travellers, checks, sg_advice)}
    assert "Reach Chennai airport, Terminal 2 by 20:50" in again["leave_home"]["detail"]
    assert "wheelchair" in items["assist"]["title"] and "Gautam Guru" in items["assist"]["title"]
    assert items["fix:t1:passport_expiry"]["group"] == "t3" and items["fix:t1:passport_expiry"]["key"]
    assert group_dates(summary) == {"t3": "2026-10-12", "t1": "2026-10-14", "t0": "2026-10-15"}
    # Fixes come first, then AI items
    ids = [i["id"] for i in build_checklist(summary, travellers, checks, sg_advice)]
    assert ids[0] == "fix:t1:passport_expiry" and ids[1] == "ai:sg_arrival_card"


def test_checklist_without_advice_falls_back(gautam_docs):
    travellers = [traveller(gautam_docs)]
    items = {i["id"]: i for i in build_checklist(trip_summary(gautam_docs["ticket"]), travellers, check_trip(travellers))}
    assert items["arrival_card"]["title"] == "Check if Singapore needs an arrival card"
    assert items["forex"]["title"].startswith("Carry some local currency")
    assert not any(i.startswith("ai:") for i in items)


def test_no_assistance_item_when_nobody_needs_it(gautam_docs):
    travellers = [traveller(gautam_docs)]
    items = build_checklist(trip_summary(gautam_docs["ticket"]), travellers, check_trip(travellers))
    assert "assist" not in {i["id"] for i in items}


def test_journey_uses_real_trip_data(gautam_docs, sg_advice):
    from journey import build_journey
    travellers = [traveller(gautam_docs)]
    summary = trip_summary(gautam_docs["ticket"])
    steps = {st["id"]: st for st in build_journey(summary, travellers, sg_advice, [], {"gate": "B7", "boarding_time": "23:10"})}

    assert list(steps) == ["entry", "checkin", "emigration", "security", "gate", "arrival", "baggage"]
    assert "Be at the airport by 20:50, 3 hours before the 23:50 flight." in steps["entry"]["do"]
    assert "Terminal 2" in steps["entry"]["where"]
    assert any("Check-in closes at 22:50" in d for d in steps["checkin"]["do"])
    assert steps["checkin"]["staff"] == "Where is the check-in counter for SL 301?"
    assert steps["gate"]["where"] == ["Gate B7", "Boarding 23:10"]
    assert steps["emigration"]["qa"][0] == ["Where are you going?", "To Singapore, for visiting family."]
    assert ["How long will you stay?", "9 days. Here is my return ticket."] in steps["emigration"]["qa"]
    assert "Keep your boarding pass ready." in steps["emigration"]["do"]                  # Gemini tip
    assert steps["arrival"]["title"] == "Singapore immigration"
    qa = dict(steps["arrival"]["qa"])
    assert qa["Where will you stay?"] == "With Arjun Guru (son). Phone: +65 8123 4567."    # visa local contact
    assert qa["Do you have a return ticket?"] == "Yes, SL 302 on 25 Oct 2026."
    assert "Exit to the arrival hall to meet Arjun Guru." in steps["baggage"]["do"]


def test_journey_transit_and_missing_gate(gautam_docs):
    from journey import build_journey
    segs = gautam_docs["ticket"]["segments"]
    segs[0].update(destination_code="KUL", destination_city="Kuala Lumpur", destination_country="Malaysia",
                   arrival_date="2026-10-16", arrival_time="02:00")
    segs.insert(1, {**segs[0], "flight_number": "SL 900", "origin_code": "KUL", "origin_city": "Kuala Lumpur",
                    "destination_code": "SIN", "destination_city": "Singapore", "destination_country": "Singapore",
                    "departure_date": "2026-10-16", "departure_time": "04:30", "arrival_date": "2026-10-16", "arrival_time": "05:40"})
    contacts = [{"name": "Priya", "relation": "daughter", "phone": "+65 9000 0000", "at_destination": True}]
    steps = {st["id"]: st for st in build_journey(trip_summary(gautam_docs["ticket"]), [traveller(gautam_docs)], None, contacts)}
    assert steps["transit_0"]["title"] == "Change planes at Kuala Lumpur"
    assert "You have 2h 30m to change planes." in steps["transit_0"]["do"]
    assert "SL 900" in steps["transit_0"]["staff"]
    assert steps["gate"]["where"] == ["Gate: see boarding pass"]
    assert "Priya" in dict(steps["arrival"]["qa"])["Where will you stay?"]                # saved contact wins


def test_translate_splits_into_parallel_chunks_and_redoes_roman(monkeypatch):
    import gemini
    calls = []

    def fake_chunk(texts, lang, model):
        calls.append((len(texts), model))
        if model == gemini.translate_model():  # light model "forgets" the script for one line
            return {k: ("Parakka thayar" if k == "k3" else "தமிழ் " + v) for k, v in texts.items()}
        return {k: "பறக்கத் தயார்" for k in texts}

    monkeypatch.setattr(gemini, "_translate_chunk", fake_chunk)
    texts = {f"k{i}": f"Ready to fly {i}" for i in range(45)}
    out = gemini.translate(texts, "ta")
    light = [n for n, m in calls if m == gemini.translate_model()]
    assert sorted(light) == [5, 20, 20]                        # 45 strings -> 3 parallel chunks
    assert calls[-1] == (1, gemini.model_name())               # only the Roman-letter line is redone
    assert out["k3"] == "பறக்கத் தயார்" and out["k0"].startswith("தமிழ் ")


def test_native_script_check():
    import gemini
    assert gemini._needs_native_script("ta", "Ready to fly", "Parakka thayar")
    assert not gemini._needs_native_script("ta", "Ready to fly", "பறக்கத் தயார்")
    assert not gemini._needs_native_script("ta", "SIN", "SIN")               # codes stay as they are
    assert not gemini._needs_native_script("ta", "{n0}: passport valid", "{n0}: பாஸ்போர்ட்")
    assert not gemini._needs_native_script("ms", "Ready to fly", "Sedia untuk terbang")  # Malay uses Latin script
