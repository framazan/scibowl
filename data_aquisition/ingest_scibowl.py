from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from datetime import datetime

import firebase_admin
from firebase_admin import firestore as firestore_admin
from google.cloud.firestore import SERVER_TIMESTAMP
from docx import Document
from pypdf import PdfReader
import google.generativeai as genai

SUPPORTED_EXTS = {".pdf", ".docx"}
DEFAULT_PROMPT_PATH = Path(__file__).parent / "prompts" / "extract_scibowl.tmpl"
DEFAULT_APPEND_LOG = Path(__file__).parent / "questions.jsonl"


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def read_docx_text(path):
    doc = Document(str(path))
    return "\n".join(
        (p.text or "").strip("\u200b\ufeff\n\r ") for p in doc.paragraphs if (p.text or "").strip("\u200b\ufeff\n\r ")
    )


def read_pdf_text(path):
    reader = PdfReader(str(path))
    parts = []
    for page in reader.pages:
        try:
            txt = page.extract_text() or ""
        except Exception:
            txt = ""
        if txt:
            parts.append(txt)
    return "\n".join(parts)


def read_file_text(path):
    ext = path.suffix.lower()
    if ext == ".docx":
        return read_docx_text(path)
    if ext == ".pdf":
        return read_pdf_text(path)
    raise ValueError(f"Unsupported file type: {ext}")


def load_prompt_template(path):
    tpl_path = Path(path).expanduser() if path else DEFAULT_PROMPT_PATH
    if not tpl_path.exists():
        raise FileNotFoundError(f"Prompt template not found: {tpl_path}")
    return tpl_path.read_text(encoding="utf-8")


def render_prompt(template, content):
    return template.replace("{{TEXT}}", content)


def append_json_record(path, record):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _coerce_json(raw):
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z0-9]*\n|\n```$", "", raw)
    try:
        return json.loads(raw)
    except Exception:
        pass
    m = re.search(r"(\{.*\}|\[.*\])", raw, flags=re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    raise ValueError("Model did not return valid JSON")


def extract_questions(
    model_name,
    text,
    prompt_file,
    retries=2,
):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set.")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    prompt_template = load_prompt_template(prompt_file)
    prompt = render_prompt(prompt_template, text)

    for attempt in range(retries + 1):
        try:
            resp = model.generate_content([{"role": "user", "parts": [prompt]}])
            candidates = getattr(resp, "candidates", None)
            if not candidates or not hasattr(candidates[0], "content"):
                raise ValueError("No candidates returned from Gemini API.")
            content = candidates[0].content
            if not hasattr(content, "parts") or not content.parts:
                raise ValueError("No content parts returned from Gemini API.")
            raw_text = getattr(content.parts[0], "text", "")
            data = _coerce_json(raw_text)
            if not isinstance(data, dict) or "questions" not in data or not isinstance(data["questions"], list):
                raise ValueError("Model did not return valid JSON matching current schema (missing 'questions').")
            out = dict(data)
            out["questions"] = list(data["questions"])
            return out
        except Exception as e:
            if attempt == retries:
                raise RuntimeError(f"Model call failed after retries: {e}")
            time.sleep(1.5 * (attempt + 1))


# Ensure category/categories are capitalized strictly for upload
def normalize_categories_field(q):
    out = dict(q)
    # Single category string
    if isinstance(out.get("category"), str):
        out["category"] = out["category"].strip().upper()
    # Categories can be list or string
    if "categories" in out:
        cats = out["categories"]
        if isinstance(cats, list):
            out["categories"] = [c.strip().upper() if isinstance(c, str) else c for c in cats]
        elif isinstance(cats, str):
            out["categories"] = cats.strip().upper()
    return out


class FirestoreUploader:
    """Uploader for new per-round schema (no dry-run support)."""

    def __init__(self, project_id, tournament: str, rounds_subcollection: str = "rounds"):
        try:
            firebase_admin.get_app()
        except ValueError:
            cred = firebase_admin.credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {"projectId": project_id})
        self.client = firestore_admin.client()
        self.tournament = tournament
        self.rounds_subcollection = rounds_subcollection

    def upsert_round(self, questions, round_val, year_val):
        tossups = []
        bonuses = []
        errors = 0
        for q in questions:
            try:
                q_norm = normalize_categories_field(q)
                q_norm["round"] = round_val
                if year_val is not None:
                    q_norm["year"] = year_val
                qtype = (q_norm.get("question_type") or "").lower()
                if qtype == "tossup":
                    tossups.append(q_norm)
                elif qtype == "bonus":
                    bonuses.append(q_norm)
                else:
                    errors += 1
                    eprint(f"[WARN] Skipping question with unknown question_type='{q_norm.get('question_type')}'")
            except Exception as e:
                errors += 1
                qid = q.get("id") or q.get("question_number")
                eprint(f"[ERROR] Failed to process question '{qid}': {e}")

        def _sort_key(d):
            num = d.get("question_number")
            try:
                return int(num)
            except Exception:
                return 10**9
        tossups.sort(key=_sort_key)
        bonuses.sort(key=_sort_key)

        categories_agg = {}
        for d in tossups + bonuses:
            cat = d.get("category")
            if cat:
                categories_agg[cat] = categories_agg.get(cat, 0) + 1

        round_doc = {
            "tournament": self.tournament,
            "round": str(round_val),
            "questionCount": len(tossups) + len(bonuses),
            "tossups": sanitize_for_firestore(tossups),
            "bonuses": sanitize_for_firestore(bonuses),
            "categoriesAgg": categories_agg,
            "sourceCounts": {"tossup": len(tossups), "bonus": len(bonuses)},
            "ingestedAt": SERVER_TIMESTAMP,
        }

        ref = (
            self.client
            .collection("tournaments")
            .document(self.tournament)
            .collection(self.rounds_subcollection)
            .document(str(round_val))
        )
        ref.set(round_doc, merge=True)
        eprint(f"[WRITE] Wrote round doc tournaments/{self.tournament}/rounds/{round_val} (tossups={len(tossups)} bonuses={len(bonuses)})")
        return True, errors


def build_doc_id(*args, **kwargs):  # Backwards compatibility if referenced elsewhere
    raise NotImplementedError("Per-question document IDs are deprecated; use per-round storage.")


def sanitize_for_firestore(q):
    def _san(x):
        if isinstance(x, (str, int, float, bool)) or x is None:
            return x
        if isinstance(x, list):
            return [_san(v) for v in x]
        if isinstance(x, dict):
            return {str(k): _san(v) for k, v in x.items()}
        return str(x)
    # Top-level can be a dict (single object) or list (e.g., list of question dicts)
    if isinstance(q, dict):
        return {str(k): _san(v) for k, v in q.items()}
    if isinstance(q, list):
        return [_san(v) for v in q]
    # Fallback: sanitize primitive/other types directly
    return _san(q)

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Extract and upload Science Bowl questions to Firestore (single file)")
    p.add_argument("input_file", type=str, help="Path to a PDF or DOCX file to process")
    p.add_argument("--project-id", required=True, help="GCP Project ID for Firestore")
    p.add_argument("--tournament", required=True, help="Tournament identifier (used for collection path tournaments/<tournament>/rounds/<round>)")
    p.add_argument("--rounds-subcollection", default="rounds", help="Name of rounds subcollection (default: rounds)")
    p.add_argument("--model", default="gemma-3", help="Model name for Gemini API (e.g., gemma-3)")
    p.add_argument("--retries", type=int, default=2, help="Retries for the model request")
    p.add_argument("--append-json", type=str, default=DEFAULT_APPEND_LOG, help="Append results to this JSONL file (default: questions.jsonl next to script)")
    p.add_argument("--prompt-file", type=str, default=DEFAULT_PROMPT_PATH, help="Path to prompt template (tmpl/yaml)")
    p.add_argument("--save-json", type=str, default=None, help="Optional path to save extracted JSON output")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    path = Path(args.input_file).expanduser().resolve()
    if not path.exists() or not path.is_file():
        eprint(f"Input file not found: {path}")
        return 2
    if path.suffix.lower() not in SUPPORTED_EXTS:
        eprint(f"Unsupported file type: {path.suffix}. Use one of: {', '.join(sorted(SUPPORTED_EXTS))}")
        return 2

    try:
        text = read_file_text(path)
        text = str(path.stem) + ' ' + text
    except Exception as e:
        eprint(f"[ERROR] Failed to read file: {e}")
        return 1

    try:
        result = extract_questions(
            args.model,
            text,
            retries=args.retries,
            prompt_file=args.prompt_file,
        )
    except Exception as e:
        eprint(f"[ERROR] Model extraction failed: {e}")
        return 1

    round_val = result.get("round")
    year_val = result.get("year")
    all_questions = list(result.get("questions", []))

    # Save JSON output immediately after getting the model response
    if args.save_json:
        out_path = Path(args.save_json).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as f:
            json.dump({"round": round_val, "year": year_val, "questions": all_questions}, f, ensure_ascii=False, indent=2)
        eprint(f"Saved JSON to {out_path}")

    if not round_val:
        eprint("[ERROR] Extracted data missing 'round' field; cannot write round document.")
        return 1

    uploader = FirestoreUploader(project_id=args.project_id, tournament=args.tournament, rounds_subcollection=args.rounds_subcollection)
    wrote, errors = uploader.upsert_round(all_questions, round_val, year_val)
    eprint(f"Upload summary: wrote_round={wrote} question_errors={errors}")

    append_path = Path(args.append_json).expanduser().resolve() if args.append_json else DEFAULT_APPEND_LOG
    record = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "input_file": str(path),
        "model": args.model,
        "project_id": args.project_id,
    "tournament": args.tournament,
    "rounds_subcollection": args.rounds_subcollection,
        "round": round_val,
        "year": year_val,
        "questions": all_questions,
    }
    try:
        append_json_record(append_path, record)
        eprint(f"Appended {len(all_questions)} questions to {append_path}")
    except Exception as e:
        eprint(f"[WARN] Failed to append results to log: {e}")
    # For per-round ingestion, treat any question parsing errors as non-fatal unless all failed.
    return 0


if __name__ == "__main__":
    sys.exit(main())
