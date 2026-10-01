"""Gemini trip advice (destination/route-specific checklist items and airport tips), cached per route.

Cache: advice/{signature} in Firestore, where the signature is the route countries + passport nationalities
+ visa types. Advice older than ADVICE_TTL is regenerated, so rule changes are picked up.
"""
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

import gemini
from checklist import GENERIC_TITLES
from db import now_iso, store

log = logging.getLogger("myfirstflight")

ADVICE_VERSION = 3  # bump when the prompt or schema changes to invalidate the cache
ADVICE_TTL = timedelta(days=30)


def advice_context(summary, travellers):
    s = summary or {}
    docs = [t.get("documents") or {} for t in travellers]
    return {
        "origin": {"airport": s.get("origin_code"), "city": s.get("origin_city"), "country": s.get("origin_country")},
        "destination": {"airport": s.get("destination_code"), "city": s.get("destination_city"),
                        "country": s.get("destination_country")},
        "transits": [{"airport": t.get("code"), "country": t.get("country")} for t in s.get("transits") or []],
        "passport_nationalities": sorted({(d.get("passport") or {}).get("nationality") or "unknown" for d in docs}),
        "visa_types": sorted({(d.get("visa") or {}).get("visa_type") or "none" for d in docs}),
        "departure_date": s.get("departure_date"),
        "return_date": s.get("return_date"),
        "airline": s.get("airline"),
    }


def _signature(ctx):
    key = {k: ctx[k] for k in ("origin", "destination", "transits", "passport_nationalities", "visa_types")}
    key["origin"] = ctx["origin"]["country"]
    key["destination"] = ctx["destination"]["country"]
    key["transits"] = [t["country"] for t in ctx["transits"]]
    raw = json.dumps({"v": ADVICE_VERSION, **key}, sort_keys=True).casefold()
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def get_advice(summary, travellers, generate=True):
    """Cached or freshly generated advice for this route; None if unavailable.

    generate=False only reads the cache (fast), so requests never wait for Gemini; the caller then
    generates in the background.
    """
    if not summary or not summary.get("destination_country"):
        return None
    ctx = advice_context(summary, travellers)
    sig = _signature(ctx)
    db = store()
    cached = db.get("advice", sig)
    if cached:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(cached["created_at"])
        if age < ADVICE_TTL:
            return cached["advice"]
    if not generate:
        return None
    try:
        advice = gemini.trip_advice(ctx, GENERIC_TITLES)
    except Exception:
        log.exception("trip advice failed")
        return cached["advice"] if cached else None  # stale advice beats none
    db.set("advice", sig, {"advice": advice, "context": ctx, "created_at": now_iso()})
    return advice
