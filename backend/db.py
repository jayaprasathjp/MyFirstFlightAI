"""Trip storage. Firestore in the cloud; an in-memory store for local dev and tests (DB_BACKEND=memory).

Firestore layout (extracted text; the original uploaded files go to Cloud Storage, see set_file):
  trips/{trip_id}          -> {language, travellers[], summary, checks[], status, checklist_done{}, created_at, updated_at}
  translations/{lang_hash} -> {text, lang, source}   cache for Gemini translations
  advice/{route_hash}      -> {advice, context, created_at}   cache for Gemini trip advice
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
        self._data = {}

    def get(self, collection, doc_id):
        doc = self._data.get(collection, {}).get(doc_id)
        return copy.deepcopy(doc) if doc is not None else None

    def set(self, collection, doc_id, value):
        self._data.setdefault(collection, {})[doc_id] = copy.deepcopy(value)

    def get_many(self, collection, doc_ids):
        return {i: self.get(collection, i) for i in doc_ids if i in self._data.get(collection, {})}

    def query(self, collection, field, value):
        docs = self._data.get(collection, {})
        return {k: copy.deepcopy(v) for k, v in docs.items() if v.get(field) == value}

    def set_many(self, collection, docs):
        for i, v in docs.items():
            self.set(collection, i, v)

    def update(self, collection, doc_id, fields):
        doc = self._data.get(collection, {}).get(doc_id)
        if doc is not None:
            doc.update(copy.deepcopy(fields))

    def set_file(self, path, content, mime_type):
        self._data.setdefault("files", {})[path] = {"content": content, "mime_type": mime_type}

    def get_file(self, path):
        return self._data.get("files", {}).get(path)

    def delete_file(self, path):
        self._data.get("files", {}).pop(path, None)


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
            from google.cloud import storage

            if not firebase_admin._apps:
                project = os.getenv("GCP_PROJECT_ID")
                firebase_admin.initialize_app(options={"projectId": project} if project else None)
            self._db = firestore.client()
            
            project = os.getenv("GCP_PROJECT_ID")
            self._storage = storage.Client(project=project)
            self._bucket_name = os.getenv("GCS_BUCKET", (project + "-mff-docs") if project else "mff-docs")
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

    def query(self, collection, field, value):
        try:
            from google.cloud.firestore_v1.base_query import FieldFilter
            docs = self._db.collection(collection).where(filter=FieldFilter(field, "==", value)).stream()
            return {d.id: d.to_dict() for d in docs}
        except Exception as exc:
            log.exception("Firestore query failed")
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

    def update(self, collection, doc_id, fields):
        """Change only these fields (does not overwrite edits made meanwhile by another request)."""
        try:
            self._db.collection(collection).document(doc_id).update(fields)
        except Exception as exc:
            log.exception("Firestore update failed")
            raise StoreError(_explain(exc)) from exc

    def set_file(self, path, content, mime_type):
        try:
            from google.api_core.exceptions import Forbidden, NotFound
            bucket = self._storage.bucket(self._bucket_name)
            if not getattr(self, "_bucket_checked", False):  # check/create the bucket once, not on every upload
                try:
                    if not bucket.exists():
                        bucket.create(location=os.getenv("GCP_LOCATION", "us-central1"))
                    self._bucket_checked = True
                except Forbidden:
                    log.warning(f"GCS: No permission to create bucket '{self._bucket_name}'. Please create it manually in GCP console.")

            blob = bucket.blob(path)
            blob.upload_from_string(content, content_type=mime_type)
        except Exception as exc:
            if "Forbidden" in str(type(exc)):
                log.error(f"GCS write failed: Permission denied for bucket '{self._bucket_name}'. Ensure your service account has Storage Object Admin.")
            else:
                log.error(f"GCS write failed: {exc}")

    def get_file(self, path):
        try:
            bucket = self._storage.bucket(self._bucket_name)
            blob = bucket.blob(path)
            if not blob.exists():
                return None
            return {"content": blob.download_as_bytes(), "mime_type": blob.content_type}
        except Exception as exc:
            if "Forbidden" in str(type(exc)):
                log.error(f"GCS read failed: Permission denied. Ensure your service account has Storage Object Viewer.")
            else:
                log.error(f"GCS read failed: {exc}")
            return None

    def delete_file(self, path):
        try:
            bucket = self._storage.bucket(self._bucket_name)
            blob = bucket.blob(path)
            if blob.exists():
                blob.delete()
        except Exception as exc:
            if "Forbidden" in str(type(exc)):
                log.warning(f"GCS delete failed: Permission denied for '{self._bucket_name}'.")
            else:
                log.warning(f"GCS delete failed: {exc}")


_store = None


def store():
    global _store
    if _store is None:
        _store = MemoryStore() if os.getenv("DB_BACKEND", "firestore").lower() == "memory" else FirestoreStore()
    return _store


def now_iso():
    return datetime.now(timezone.utc).isoformat()
