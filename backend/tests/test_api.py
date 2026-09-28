import copy

import pytest
from fastapi.testclient import TestClient

import db
import gemini
import main
from conftest import GAUTAM, SG_ADVICE


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(db, "_store", None)  # fresh in-memory store (and translation cache) per test
    monkeypatch.setattr(gemini, "extract_document", lambda content, mime, doc_type: copy.deepcopy(GAUTAM[doc_type]))
    monkeypatch.setattr(gemini, "translate", lambda texts, lang: {k: f"[{lang}] {v}" for k, v in texts.items()})
    monkeypatch.setattr(gemini, "trip_advice", lambda ctx, generic: copy.deepcopy(SG_ADVICE))
    return TestClient(main.app)


FILES = {name: (f"{name}.pdf", b"%PDF-1.4 sample", "application/pdf") for name in ("ticket", "passport", "visa")}


def test_full_flow(client):
    trip = client.post("/api/trips", json={"language": "en"}).json()
    assert trip["status"] == "empty" and trip["checklist"]["items"] == []

    r = client.post(f"/api/trips/{trip['id']}/travellers", files=FILES, data={"assistance": "wheelchair"})
    assert r.status_code == 200, r.text
    trip = r.json()
    assert trip["status"] == "ready"
    assert trip["travellers"][0]["name"] == "Gautam Guru"
    assert trip["summary"]["destination_code"] == "SIN"
    ids = [i["id"] for i in trip["checklist"]["items"]]
    assert "assist" in ids and "leave_home" in ids

    r = client.put(f"/api/trips/{trip['id']}/checklist", json={"done": {"webci": True, "forex": False}})
    assert r.json()["checklist_done"] == {"webci": True}
    trip = client.get(f"/api/trips/{trip['id']}").json()
    done = {i["id"]: i["done"] for i in trip["checklist"]["items"]}
    assert done["webci"] and not done["forex"]

    tid = trip["travellers"][0]["id"]
    trip = client.delete(f"/api/trips/{trip['id']}/travellers/{tid}").json()
    assert trip["travellers"] == [] and trip["status"] == "empty"


def test_language_switch_translates_checks_and_checklist(client):
    trip = client.post("/api/trips", json={"language": "en"}).json()
    client.post(f"/api/trips/{trip['id']}/travellers", files=FILES)
    trip = client.patch(f"/api/trips/{trip['id']}", json={"language": "ta"}).json()
    assert trip["checks"][0]["title"].startswith("[ta] ")
    assert trip["checklist"]["items"][0]["title"].startswith("[ta] ")


def test_translate_endpoint_caches(client, monkeypatch):
    calls = []
    monkeypatch.setattr(gemini, "translate", lambda texts, lang: calls.append(texts) or {k: "x" + v for k, v in texts.items()})
    body = {"language": "hi", "texts": {"a": "Hello cache", "b": "World cache"}}
    assert client.post("/api/translate", json=body).json()["texts"] == {"a": "xHello cache", "b": "xWorld cache"}
    assert client.post("/api/translate", json=body).json()["texts"] == {"a": "xHello cache", "b": "xWorld cache"}
    assert len(calls) == 1


def test_rejects_bad_input(client):
    assert client.post("/api/trips", json={"language": "xx"}).status_code == 400
    assert client.get("/api/trips/nope").status_code == 404
    trip = client.post("/api/trips", json={"language": "en"}).json()
    bad = {**FILES, "visa": ("visa.txt", b"hello", "text/plain")}
    assert client.post(f"/api/trips/{trip['id']}/travellers", files=bad).status_code == 415


def test_names_are_never_sent_for_translation(client, monkeypatch):
    seen = []

    def transliterating(texts, lang):  # behaves like Gemini at its worst: rewrites names
        seen.extend(texts.values())
        return {k: v.replace("Gautam", "கௌதம்").replace("GAUTAM", "கௌதம்") for k, v in texts.items()}

    monkeypatch.setattr(gemini, "translate", transliterating)
    trip = client.post("/api/trips", json={"language": "en"}).json()
    client.post(f"/api/trips/{trip['id']}/travellers", files=FILES, data={"assistance": "wheelchair"})
    trip = client.patch(f"/api/trips/{trip['id']}", json={"language": "ta"}).json()

    assert not any("Gautam" in s or "GAUTAM" in s or "TST7Q2" in s for s in seen)
    assert trip["checks"][0]["title"].startswith("Gautam Guru")
    assist = next(i for i in trip["checklist"]["items"] if i["id"] == "assist")
    assert "Gautam Guru" in assist["title"]


def test_lost_placeholder_falls_back_to_english(client, monkeypatch):
    monkeypatch.setattr(gemini, "translate", lambda texts, lang: {k: "அனுப்பு" for k in texts})
    trip = client.post("/api/trips", json={"language": "en"}).json()
    client.post(f"/api/trips/{trip['id']}/travellers", files=FILES)
    trip = client.patch(f"/api/trips/{trip['id']}", json={"language": "te"}).json()
    name_check = next(c for c in trip["checks"] if c["id"].endswith(":name"))
    assert name_check["title"] == "Gautam Guru: name matches"      # had {n0}: kept English
    assert trip["checklist"]["items"][-1]["title"] == "அனுப்பு"      # no names: translated


def test_trip_advice_is_cached_per_route(client, monkeypatch):
    calls = []
    monkeypatch.setattr(gemini, "trip_advice", lambda ctx, generic: calls.append(ctx) or copy.deepcopy(SG_ADVICE))
    for _ in range(2):  # two separate trips on the same route
        trip = client.post("/api/trips", json={"language": "en"}).json()
        trip = client.post(f"/api/trips/{trip['id']}/travellers", files=FILES).json()
    assert len(calls) == 1
    assert calls[0]["destination"]["country"] == "Singapore" and calls[0]["passport_nationalities"] == ["UTOPIAN"]
    ids = [i["id"] for i in trip["checklist"]["items"]]
    assert "ai:sg_arrival_card" in ids
    assert trip["journey"][0]["id"] == "entry"


def test_trip_advice_failure_falls_back(client, monkeypatch):
    def boom(ctx, generic):
        raise RuntimeError("Gemini down")
    monkeypatch.setattr(gemini, "trip_advice", boom)
    trip = client.post("/api/trips", json={"language": "en"}).json()
    r = client.post(f"/api/trips/{trip['id']}/travellers", files=FILES)
    assert r.status_code == 200
    ids = [i["id"] for i in r.json()["checklist"]["items"]]
    assert "arrival_card" in ids and not any(i.startswith("ai:") for i in ids)


def test_contacts_and_boarding(client):
    trip = client.post("/api/trips", json={"language": "en"}).json()
    trip = client.post(f"/api/trips/{trip['id']}/travellers", files=FILES).json()
    assert trip["destination_contact"] == {"name": "Arjun Guru", "relation": "son", "phone": "+65 8123 4567"}

    bad = client.put(f"/api/trips/{trip['id']}/contacts", json={"contacts": [{"name": "Amma", "phone": "call me"}]})
    assert bad.status_code == 422
    assert client.put(f"/api/trips/{trip['id']}/contacts", json={"contacts": []}).status_code == 422
    trip = client.put(f"/api/trips/{trip['id']}/contacts", json={"contacts": [
        {"name": "Lakshmi", "relation": "wife", "phone": "+91 98401 23412"}]}).json()
    assert trip["contacts"][0]["phone"] == "+91 98401 23412"
    lost = next(i for i in trip["checklist"]["items"] if i["id"] == "lost_card")
    assert "family phone number" in lost["detail"] and "Contacts step" not in lost["detail"]

    assert client.put(f"/api/trips/{trip['id']}/boarding", json={"gate": "B7", "boarding_time": "25:99"}).status_code == 422
    trip = client.put(f"/api/trips/{trip['id']}/boarding", json={"gate": " b7 ", "boarding_time": "23:10"}).json()
    assert trip["boarding"] == {"gate": "B7", "boarding_time": "23:10"}
    gate = next(st for st in trip["journey"] if st["id"] == "gate")
    assert gate["where"] == ["Gate B7", "Boarding 23:10"]


def test_journey_keeps_english_for_staff(client):
    trip = client.post("/api/trips", json={"language": "en"}).json()
    client.post(f"/api/trips/{trip['id']}/travellers", files=FILES)
    trip = client.patch(f"/api/trips/{trip['id']}", json={"language": "hi"}).json()
    emig = next(st for st in trip["journey"] if st["id"] == "emigration")
    assert emig["qa"][0]["q_en"] == "Where are you going?" and emig["qa"][0]["q"].startswith("[hi] ")
    assert emig["staff_en"] == "Which queue is for emigration?" and emig["staff"].startswith("[hi] ")
