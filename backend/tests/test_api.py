import copy

import pytest
from fastapi.testclient import TestClient

import gemini
import main
from conftest import GAUTAM


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(gemini, "extract_document", lambda content, mime, doc_type: copy.deepcopy(GAUTAM[doc_type]))
    monkeypatch.setattr(gemini, "translate", lambda texts, lang: {k: f"[{lang}] {v}" for k, v in texts.items()})
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
