"""Cloud Text-to-Speech and Pub/Sub over REST, using the service's Google credentials (no extra packages)."""
import base64
import json
import logging
import os
import threading

import google.auth
from google.auth.transport.requests import AuthorizedSession

log = logging.getLogger("myfirstflight")

TTS_VOICE = {
    "en": "en-IN", "hi": "hi-IN", "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN", "ml": "ml-IN", "bn": "bn-IN",
    "mr": "mr-IN", "gu": "gu-IN", "ms": "ms-MY", "zh": "cmn-CN", "ar": "ar-XA",
}

_session = None
_lock = threading.Lock()


class ServiceUnavailable(RuntimeError):
    pass


def _authed():
    global _session
    with _lock:
        if _session is None:
            creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            _session = AuthorizedSession(creds)
        return _session


def _project():
    return os.getenv("GCP_PROJECT_ID", "")


def synthesize(text: str, lang: str) -> str:
    """MP3 audio (base64) for text in the given app language."""
    r = _authed().post(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        headers={"x-goog-user-project": _project()},
        json={"input": {"text": text}, "voice": {"languageCode": TTS_VOICE.get(lang, "en-IN")},
              "audioConfig": {"audioEncoding": "MP3", "speakingRate": 0.9}},
        timeout=30,
    )
    if r.status_code != 200:
        log.warning("TTS failed %s: %s", r.status_code, r.text[:300])
        raise ServiceUnavailable("Text-to-Speech is not available right now.")
    return r.json()["audioContent"]


def publish_assist(message: dict) -> bool:
    """Send an assistance request to the airport assist desk topic, if one is configured (ASSIST_TOPIC)."""
    topic = os.getenv("ASSIST_TOPIC")
    if not topic:
        return False
    data = base64.b64encode(json.dumps(message).encode()).decode()
    r = _authed().post(f"https://pubsub.googleapis.com/v1/projects/{_project()}/topics/{topic}:publish",
                       json={"messages": [{"data": data, "attributes": {"kind": message.get("kind", "")}}]}, timeout=15)
    if r.status_code != 200:
        log.warning("Pub/Sub publish failed %s: %s", r.status_code, r.text[:300])
        return False
    return True
