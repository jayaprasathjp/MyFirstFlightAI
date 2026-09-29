import base64
import json
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from google.api_core.exceptions import NotFound
from google.cloud import firestore, kms_v1, storage

PROFILE_SIZE_LIMIT = 48 * 1024
PASSPORT_RETENTION_DAYS = int(os.getenv("PASSPORT_RETENTION_DAYS", "30"))


def _project_id() -> str:
    project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GCP_PROJECT_ID")
    if not project_id:
        raise RuntimeError("FIREBASE_PROJECT_ID or GCP_PROJECT_ID must be configured.")
    return project_id


def _database() -> firestore.Client:
    return firestore.Client(project=_project_id(), database=os.getenv("FIRESTORE_DATABASE", "(default)"))


def _kms_key_name() -> str:
    key_name = os.getenv("PII_KMS_KEY_NAME")
    if not key_name:
        raise RuntimeError("PII_KMS_KEY_NAME must be configured before storing personal data.")
    return key_name


def _encrypt(payload: dict[str, Any], user_id: str, purpose: str = "profile") -> str:
    plaintext = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if len(plaintext) > PROFILE_SIZE_LIMIT:
        raise ValueError("Saved profile is too large. Remove old trips before saving more history.")
    client = kms_v1.KeyManagementServiceClient()
    aad = f"{user_id}:{purpose}".encode("utf-8")
    response = client.encrypt(request={"name": _kms_key_name(), "plaintext": plaintext, "additional_authenticated_data": aad})
    return base64.b64encode(response.ciphertext).decode("ascii")


def _decrypt(ciphertext: str, user_id: str, purpose: str = "profile") -> dict[str, Any]:
    client = kms_v1.KeyManagementServiceClient()
    aad = f"{user_id}:{purpose}".encode("utf-8")
    response = client.decrypt(request={"name": _kms_key_name(), "ciphertext": base64.b64decode(ciphertext), "additional_authenticated_data": aad})
    return json.loads(response.plaintext.decode("utf-8"))


def _profile_ref(user_id: str):
    return _database().collection("users").document(user_id).collection("profiles").document("current")


def _emergency_ref(user_id: str):
    return _database().collection("users").document(user_id).collection("private").document("emergency-contact")


def save_profile(user_id: str, payload: dict[str, Any]) -> None:
    ciphertext = _encrypt(payload, user_id)
    _profile_ref(user_id).set({"ciphertext": ciphertext, "updated_at": firestore.SERVER_TIMESTAMP})


def load_profile(user_id: str) -> dict[str, Any]:
    snapshot = _profile_ref(user_id).get()
    if not snapshot.exists:
        return {}
    record = snapshot.to_dict() or {}
    return _decrypt(record["ciphertext"], user_id)


def save_emergency_contact(user_id: str, contact: dict[str, Any]) -> None:
    ciphertext = _encrypt(contact, user_id, "emergency-contact")
    _emergency_ref(user_id).set({"ciphertext": ciphertext, "updated_at": firestore.SERVER_TIMESTAMP})


def load_emergency_contact(user_id: str) -> dict[str, Any]:
    snapshot = _emergency_ref(user_id).get()
    if not snapshot.exists:
        return {}
    record = snapshot.to_dict() or {}
    return _decrypt(record["ciphertext"], user_id, "emergency-contact")


def delete_emergency_contact(user_id: str) -> None:
    _emergency_ref(user_id).delete()


def _passport_blob(user_id: str, traveller_id: str):
    try:
        safe_traveller_id = str(UUID(traveller_id))
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid traveller identifier.") from exc
    bucket_name = os.getenv("PASSPORT_BUCKET")
    object_key = os.getenv("PASSPORT_KMS_KEY_NAME")
    if not bucket_name or not object_key:
        raise RuntimeError("PASSPORT_BUCKET and PASSPORT_KMS_KEY_NAME must be configured.")
    bucket = storage.Client(project=_project_id()).bucket(bucket_name)
    blob = bucket.blob(f"passports/{user_id}/{safe_traveller_id}/passport")
    blob.kms_key_name = object_key
    return blob


def store_passport(user_id: str, traveller_id: str, content: bytes, mime_type: str) -> str:
    blob = _passport_blob(user_id, traveller_id)
    try:
        blob.reload()
        generation = blob.generation
    except NotFound:
        generation = 0
    blob.upload_from_string(content, content_type=mime_type, if_generation_match=generation)
    return blob.name


def delete_passport(user_id: str, traveller_id: str) -> None:
    blob = _passport_blob(user_id, traveller_id)
    try:
        blob.delete()
    except NotFound:
        pass


def delete_user_data(user_id: str) -> None:
    bucket_name = os.getenv("PASSPORT_BUCKET")
    if bucket_name:
        bucket = storage.Client(project=_project_id()).bucket(bucket_name)
        for blob in bucket.list_blobs(prefix=f"passports/{user_id}/"):
            blob.delete()
    user_ref = _database().collection("users").document(user_id)
    for collection_name in ("profiles", "trips", "private", "usage"):
        for snapshot in user_ref.collection(collection_name).stream():
            snapshot.reference.delete()
    user_ref.delete()


def remove_expired_passports() -> int:
    now = datetime.now(timezone.utc).date()
    database = _database()
    removed = 0
    for snapshot in database.collection_group("profiles").stream():
        record = snapshot.to_dict() or {}
        if "ciphertext" not in record:
            continue
        user_id = snapshot.reference.parent.parent.id
        profile = _decrypt(record["ciphertext"], user_id)
        changed = False
        for traveller in profile.get("travellers", []):
            if not traveller.get("passport_stored"):
                continue
            passport = (traveller.get("extracted") or {}).get("passport") or {}
            expiry = passport.get("expiry_date")
            try:
                delete_after = date.fromisoformat(expiry[:10]) + timedelta(days=PASSPORT_RETENTION_DAYS)
            except (TypeError, ValueError):
                continue
            if delete_after > now:
                continue
            try:
                delete_passport(user_id, traveller["id"])
            except NotFound:
                pass
            traveller.setdefault("extracted", {}).pop("passport", None)
            traveller["passport_stored"] = False
            changed = True
            removed += 1
        if changed:
            snapshot.reference.set({"ciphertext": _encrypt(profile, user_id), "updated_at": firestore.SERVER_TIMESTAMP})
    return removed