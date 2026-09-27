"""Trip storage. Firestore in the cloud; an in-memory store for local dev and tests (DB_BACKEND=memory).

Firestore layout (text only for now, no files are stored):
  trips/{trip_id}          -> {language, travellers[], summary, checks[], status, checklist_done{}, created_at, updated_at}
  translations/{lang_hash} -> {text: {key: translated}}   cache for Gemini translations
"""
import copy
import os
from datetime import datetime, timezone


class MemoryStore:
    def __init__(self):
        self._data = {"trips": {}, "translations": {}}

    def get(self, collection, doc_id):
        doc = self._data[collection].get(doc_id)
        return copy.deepcopy(doc) if doc is not None else None

    def set(self, collection, doc_id, value):
        self._data[collection][doc_id] = copy.deepcopy(value)


class FirestoreStore:
    def __init__(self):
        import firebase_admin
        from firebase_admin import firestore

        if not firebase_admin._apps:
            project = os.getenv("GCP_PROJECT_ID")
            firebase_admin.initialize_app(options={"projectId": project} if project else None)
        self._db = firestore.client()

    def get(self, collection, doc_id):
        snap = self._db.collection(collection).document(doc_id).get()
        return snap.to_dict() if snap.exists else None

    def set(self, collection, doc_id, value):
        self._db.collection(collection).document(doc_id).set(value)


_store = None


def store():
    global _store
    if _store is None:
        _store = MemoryStore() if os.getenv("DB_BACKEND", "firestore").lower() == "memory" else FirestoreStore()
    return _store


def now_iso():
    return datetime.now(timezone.utc).isoformat()
