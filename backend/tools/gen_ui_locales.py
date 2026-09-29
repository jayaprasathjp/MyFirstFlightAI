"""Pre-translate the app's screen labels into every supported language.

Reads frontend/src/locales/en.json and writes frontend/src/locales/<lang>.json, so labels switch instantly
(and offline) instead of being translated live. Only new or changed keys are sent to Gemini.

Run from backend/:  .venv/Scripts/python tools/gen_ui_locales.py [lang ...]
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
import main  # noqa: E402,F401  (loads .env and credentials)
import gemini  # noqa: E402

# One-time job: use the stronger model for label quality (live translation uses the faster one).
os.environ["TRANSLATE_MODEL"] = gemini.model_name()

LOCALES = BACKEND.parent / "frontend" / "src" / "locales"
SOURCE_KEY = "__source"  # English text each entry was translated from, to detect changed strings


def generate(lang, en):
    path = LOCALES / f"{lang}.json"
    old = json.loads(path.read_text(encoding="utf8")) if path.exists() else {}
    source = old.get(SOURCE_KEY, {})
    keep = {k: old[k] for k, v in en.items() if k in old and source.get(k) == v}
    todo = {k: v for k, v in en.items() if k not in keep}
    new = gemini.translate(todo, lang) if todo else {}
    out = {k: keep.get(k) or new.get(k) or en[k] for k in en}
    out[SOURCE_KEY] = en
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    return lang, len(todo)


if __name__ == "__main__":
    en = json.loads((LOCALES / "en.json").read_text(encoding="utf8"))
    langs = sys.argv[1:] or [code for code in gemini.LANGUAGES if code != "en"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for lang, n in pool.map(lambda code: generate(code, en), langs):
            print(f"{lang}: translated {n} strings")
