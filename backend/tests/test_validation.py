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


def test_checklist_is_personalized(gautam_docs):
    gautam_docs["passport"]["expiry_date"] = "2027-02-03"
    travellers = [traveller(gautam_docs, assistance="wheelchair")]
    checks = check_trip(travellers)
    summary = trip_summary(gautam_docs["ticket"])
    items = {i["id"]: i for i in build_checklist(summary, travellers, checks)}

    assert items["arrival_card"]["title"] == "Submit SG Arrival Card online"
    assert items["cabin_bag"]["title"] == "Cabin bag 7 kg or less"
    assert items["checked_bag"]["title"] == "Check-in bag 20 kg or less"
    assert items["forex"]["title"].startswith("Carry some SGD")
    assert items["leave_home"]["title"] == "Leave home by 19:50"      # 23:50 - 3h - 1h
    assert "20:50" in items["leave_home"]["detail"]
    assert "wheelchair" in items["assist"]["title"] and "Gautam Guru" in items["assist"]["title"]
    assert items["fix:t1:passport_expiry"]["group"] == "t3" and items["fix:t1:passport_expiry"]["key"]
    assert group_dates(summary) == {"t3": "2026-10-12", "t1": "2026-10-14", "t0": "2026-10-15"}


def test_no_assistance_item_when_nobody_needs_it(gautam_docs):
    travellers = [traveller(gautam_docs)]
    items = build_checklist(trip_summary(gautam_docs["ticket"]), travellers, check_trip(travellers))
    assert "assist" not in {i["id"] for i in items}
