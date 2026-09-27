"""Trip storage. Firestore in the cloud; an in-memory store for local dev and tests (DB_BACKEND=memory).

Firestore layout (text only for now, no files are stored):
  trips/{trip_id}          -> {language, travellers[], summary, checks[], status, checklist_done{}, created_at, updated_at}
  translations/{lang_hash} -> {text: {key: translated}}   cache for Gemini translations
"""
import copy
import logging
import os
from datetime import datetime, timezone

log = logging.getLogger("myfirstflight")


class StoreError(RuntimeError):
    """Database unavailable or misconfigured; the API turns this into a 503 with the message."""


class MemoryStore:
    def __init__(self):
        self._data = {"trips": {}, "translations": {}}

    def get(self, collection, doc_id):
        doc = self._data[collection].get(doc_id)
        return copy.deepcopy(doc) if doc is not None else None

    def set(self, collection, doc_id, value):
        self._data[collection][doc_id] = copy.deepcopy(value)

    def get_many(self, collection, doc_ids):
        return {i: self.get(collection, i) for i in doc_ids if i in self._data[collection]}

    def set_many(self, collection, docs):
        for i, v in docs.items():
            self.set(collection, i, v)


def _explain(exc):
    text = str(exc)
    if "DefaultCredentialsError" in type(exc).__name__ or "default credentials" in text.lower():
        return ("Firestore: no Google credentials found. Put sa-key.json in backend/ and set "
                "GOOGLE_APPLICATION_CREDENTIALS=sa-key.json in backend/.env, or set DB_BACKEND=memory.")
    if "does not exist" in text or "NotFound" in type(exc).__name__:
        return "Firestore: the database does not exist. Create a Firestore database (Native mode) in the GCP project."
    if "PermissionDenied" in type(exc).__name__ or "403" in text:
        return "Firestore: permission denied. Give the service account the 'Cloud Datastore User' role."
    return f"Firestore error: {text[:300]}"


class FirestoreStore:
    def __init__(self):
        try:
            import firebase_admin
            from firebase_admin import firestore

            if not firebase_admin._apps:
                project = os.getenv("GCP_PROJECT_ID")
                firebase_admin.initialize_app(options={"projectId": project} if project else None)
            self._db = firestore.client()
        except Exception as exc:
            log.exception("Firestore init failed")
            raise StoreError(_explain(exc)) from exc

    def get(self, collection, doc_id):
        try:
            snap = self._db.collection(collection).document(doc_id).get()
        except Exception as exc:
            log.exception("Firestore read failed")
            raise StoreError(_explain(exc)) from exc
        return snap.to_dict() if snap.exists else None

    def set(self, collection, doc_id, value):
        try:
            self._db.collection(collection).document(doc_id).set(value)
        except Exception as exc:
            log.exception("Firestore write failed")
            raise StoreError(_explain(exc)) from exc

    def get_many(self, collection, doc_ids):
        """One round trip for many documents (translation cache lookups)."""
        try:
            col = self._db.collection(collection)
            snaps = self._db.get_all([col.document(i) for i in set(doc_ids)])
            return {s.id: s.to_dict() for s in snaps if s.exists}
        except Exception as exc:
            log.exception("Firestore batch read failed")
            raise StoreError(_explain(exc)) from exc

    def set_many(self, collection, docs):
        try:
            col, items = self._db.collection(collection), list(docs.items())
            for start in range(0, len(items), 500):  # Firestore batch limit
                batch = self._db.batch()
                for i, v in items[start:start + 500]:
                    batch.set(col.document(i), v)
                batch.commit()
        except Exception as exc:
            log.exception("Firestore batch write failed")
            raise StoreError(_explain(exc)) from exc


_store = None


def store():
    global _store
    if _store is None:
        _store = MemoryStore() if os.getenv("DB_BACKEND", "firestore").lower() == "memory" else FirestoreStore()
    return _store


def now_iso():
    return datetime.now(timezone.utc).isoformat()
