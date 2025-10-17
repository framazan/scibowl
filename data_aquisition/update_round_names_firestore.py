"""Utility: Rename round documents for a specific tournament.

Goal for user request:
    1. Read all round names (document IDs) for tournament 'tjsbt'.
    2. For any round id or stored round field containing a variation of 'round robin'
     replace that phrase with the abbreviation 'RR'.
    3. Remove spaces between 'RR' and immediately following digits/letters (e.g. 'RR 1' -> 'RR1').
    4. Replace any occurrence of 'Double Elimination' (variations with underscore/hyphen/extra spaces) with 'DE'.
    5. Remove a solitary leading 'R' before a number token (e.g. 'R12' -> '12', 'Playoff R3' -> 'Playoff 3') but keep 'RR' forms.

Firestore structure (from migrate_questions_to_rounds.py):
  tournaments/<tournamentId>/rounds/<roundId>
    { round: <roundId>, ... }

Renaming strategy:
  Firestore does not support changing a document ID in-place. We:
    - Read the existing doc (data, including subfields) for each match.
    - Write a NEW document under the desired new ID (merge existing payload, but also
      update the 'round' field to the new canonical ID)
    - Delete the old document (unless --keep-original or --dry-run is set).

Safeguards:
  - Default is dry-run (must pass --execute to actually write changes).
  - Option to keep originals (--keep-original) to allow manual verification.
  - Skips if target ID already exists (unless --force provided).
  - Prints a summary at end.

Name normalization rules applied (case-insensitive):
    - Collapse extra internal whitespace to single spaces (final pass still strips ends).
    - Replace any occurrence of: 'round robin', 'round-robin', 'round_robin' with 'RR'.
    - Then collapse any single space between 'RR' and a following alphanumeric token: 'RR 3' -> 'RR3', 'RR A' -> 'RRA'.
    - Replace any occurrence of 'double elimination', 'double-elimination', 'double_elimination' with 'DE'.
    - Remove standalone 'R' prefix before digits (not part of 'RR'): 'R12' -> '12'; 'Bracket R3' -> 'Bracket 3'.
    - Example: 'Round Robin 3' -> 'RR3'; 'Prelims Round Robin A' -> 'Prelims RRA'; 'Double Elimination Bracket' -> 'DE Bracket'.

Additionally: uppercase answer fields (can be disabled)
        - By default, uppercase any 'answer' string at the document level and within each
            question inside 'tossups' and 'bonuses'. If an 'answers' array exists
            and contains strings, each string is uppercased as well. If it contains
            dicts with an 'answer' string, that field is uppercased.
        - Pass --no-uppercase-answers to disable any changes to answer fields and to suppress
          answer-related diffs in the plan.

IMPORTANT: Adjust PROJECT_ID via --project-id argument.

Usage examples:
  python update_round_names_firestore.py --project-id YOUR_PROJECT --tournament tjsbt
  python update_round_names_firestore.py --project-id YOUR_PROJECT --tournament tjsbt --execute
  python update_round_names_firestore.py --project-id YOUR_PROJECT --tournament tjsbt --execute --force
    # Remove a custom token 'Key' and 'Foo' from round ids during normalization
    python update_round_names_firestore.py --project-id YOUR_PROJECT --tournament tjsbt --remove Key --remove Foo --execute

    # Rename an entire tournament without uppercasing any answers
    python update_round_names_firestore.py --project-id YOUR_PROJECT --tournament SRC --rename-tournament DST --no-uppercase-answers --execute

"""

from __future__ import annotations

import argparse
import re
import sys
from typing import List, Tuple, Dict, Any
from copy import deepcopy
import string

import firebase_admin
from firebase_admin import firestore as firestore_admin


def eprint(*a, **k):
    print(*a, file=sys.stderr, **k)


ROUND_ROBIN_PATTERN = re.compile(r"round[_\-\s]*robin", re.IGNORECASE)
DOUBLE_ELIM_PATTERN = re.compile(r"double[_\-\s]*elimination", re.IGNORECASE)


# Category normalization map (case-insensitive keys -> canonical category names).
# Edit this dictionary to suit your dataset. Keys are matched case-insensitively after
# stripping and collapsing punctuation/whitespace; values are written verbatim.
# Examples below cover common SciBowl-style variants. Feel free to expand/modify.
CATEGORY_REPLACEMENTS: Dict[str, str] = {
    "earth and space science" : "EARTH AND SPACE",
    "life science" : "BIOLOGY",
    "synergy" : "ENERGY",
    "earth & space" : "EARTH AND SPACE",
}


def _norm_cat_key(s: str) -> str:
    """Normalize a category key for dictionary lookup.

    - Lowercase
    - Trim
    - Replace any run of non-alphanumerics with a single space
    - Collapse multiple spaces
    """
    s = s.strip().lower()
    s = re.sub(r"[^0-9a-zA-Z]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s


_CANON_CATEGORY_MAP: Dict[str, str] = { _norm_cat_key(k): v for k, v in CATEGORY_REPLACEMENTS.items() }


def _clean_category_value(value: str) -> Tuple[str, bool]:
    """Return (new_value, changed) after applying CATEGORY_REPLACEMENTS.

    If no mapping applies, returns (value, False).
    """
    if not isinstance(value, str):
        return value, False
    key = _norm_cat_key(value)
    if key in _CANON_CATEGORY_MAP:
        new_value = _CANON_CATEGORY_MAP[key]
        return new_value, new_value != value
    return value, False


def _clean_categories_in_doc(data: Dict[str, Any]) -> int:
    """Mutate data in-place to clean category-like fields.

    Applies mapping to keys named 'category' and 'subcategory' at the document level
    and within question arrays under 'tossups' and 'bonuses'. Returns number of fields changed.
    """
    changes = 0

    # Top-level (rare, but safe)
    for key in ("category", "subcategory"):
        if isinstance(data.get(key), str):
            new_val, changed = _clean_category_value(data[key])
            if changed:
                data[key] = new_val
                changes += 1

    # Nested questions
    for list_name in ("tossups", "bonuses"):
        arr = data.get(list_name)
        if isinstance(arr, list):
            for q in arr:
                if isinstance(q, dict):
                    for key in ("category", "subcategory"):
                        if isinstance(q.get(key), str):
                            new_val, changed = _clean_category_value(q[key])
                            if changed:
                                q[key] = new_val
                                changes += 1
    return changes


def _preview_category_clean_count(data: Dict[str, Any]) -> int:
    """Return how many category fields would change if cleaned, without mutating input."""
    tmp = deepcopy(data)
    return _clean_categories_in_doc(tmp)


def _preview_category_clean_diff(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """Return a list of diffs for category fields that would change.

    Each diff dict has: { path, from, to }
    Paths examples:
      - category
      - subcategory
      - tossups[12].category
      - bonuses[3].subcategory
    """
    diffs: List[Dict[str, str]] = []

    def check_and_add(path: str, value: Any):
        if isinstance(value, str):
            new_val, changed = _clean_category_value(value)
            if changed:
                diffs.append({"path": path, "from": value, "to": new_val})

    # Top-level
    for key in ("category", "subcategory"):
        if key in data:
            check_and_add(key, data.get(key))

    # Nested questions
    for list_name in ("tossups", "bonuses"):
        arr = data.get(list_name)
        if isinstance(arr, list):
            for i, q in enumerate(arr):
                if isinstance(q, dict):
                    for key in ("category", "subcategory"):
                        if key in q:
                            check_and_add(f"{list_name}[{i}].{key}", q.get(key))

    return diffs


def _uppercase_answers_in_doc(data: Dict[str, Any]) -> int:
    """Uppercase answer fields in-place.

    Applies to:
      - Top-level 'answer' if present.
      - Each question dict in 'tossups' and 'bonuses': field 'answer'.
      - If a question has an 'answers' list:
          * Uppercase string elements.
          * If elements are dicts with 'answer' as a string, uppercase it.

    Returns the number of fields changed.
    """
    changes = 0

    # Translation table for ASCII-only uppercasing (a-z -> A-Z)
    _ASCII_UPPER_TRANS = str.maketrans({c: c.upper() for c in string.ascii_lowercase})

    def ascii_only_upper(segment: str) -> str:
        return segment.translate(_ASCII_UPPER_TRANS)

    def uppercase_preserving_latex(s: str) -> str:
        """Uppercase only ASCII letters outside LaTeX blocks.

        Preserves content inside: $$...$$, $...$, \\( ... \\), \\[ ... \\].
        Leaves all non-ASCII characters (e.g., Greek β) untouched.
        """
        if not isinstance(s, str) or not s:
            return s
        pattern = re.compile(r"(\$\$.*?\$\$|\$.*?\$|\\\([^)]*?\\\)|\\\[[^]]*?\\\])", re.DOTALL)
        out: List[str] = []
        last = 0
        for m in pattern.finditer(s):
            # ASCII-only uppercase text before LaTeX block
            out.append(ascii_only_upper(s[last:m.start()]))
            # Append LaTeX block unchanged
            out.append(m.group(0))
            last = m.end()
        out.append(ascii_only_upper(s[last:]))
        return "".join(out)

    def upper_if_str(container: Dict[str, Any], key: str) -> int:
        c = 0
        val = container.get(key)
        if isinstance(val, str):
            up = uppercase_preserving_latex(val)
            if up != val:
                container[key] = up
                c += 1
        return c

    # Top-level
    changes += upper_if_str(data, "answer")

    # Nested questions
    for list_name in ("tossups", "bonuses"):
        arr = data.get(list_name)
        if isinstance(arr, list):
            for q in arr:
                if not isinstance(q, dict):
                    continue
                changes += upper_if_str(q, "answer")
                # Handle 'answers' array
                answers = q.get("answers")
                if isinstance(answers, list):
                    for i, elem in enumerate(answers):
                        if isinstance(elem, str):
                            up = uppercase_preserving_latex(elem)
                            if up != elem:
                                answers[i] = up
                                changes += 1
                        elif isinstance(elem, dict):
                            if isinstance(elem.get("answer"), str):
                                old = elem["answer"]
                                new = uppercase_preserving_latex(old)
                                if new != old:
                                    elem["answer"] = new
                                    changes += 1
    return changes


def _preview_answer_upper_count(data: Dict[str, Any]) -> int:
    """Return how many answer fields would change if uppercased, without mutation."""
    tmp = deepcopy(data)
    return _uppercase_answers_in_doc(tmp)


def _preview_answer_upper_diff(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """Return diffs for answer fields that would be uppercased.

    Each diff dict has: { path, from, to }
    Paths examples:
      - answer
      - tossups[12].answer
      - bonuses[3].answers[1]
      - tossups[7].answers[0].answer
    """
    diffs: List[Dict[str, str]] = []

    def add_diff(path: str, old: str, new: str):
        if old != new:
            diffs.append({"path": path, "from": old, "to": new})

    _ASCII_UPPER_TRANS = str.maketrans({c: c.upper() for c in string.ascii_lowercase})

    def ascii_only_upper(segment: str) -> str:
        return segment.translate(_ASCII_UPPER_TRANS)

    def uppercase_preserving_latex(s: str) -> str:
        if not isinstance(s, str) or not s:
            return s
        pattern = re.compile(r"(\$\$.*?\$\$|\$.*?\$|\\\([^)]*?\\\)|\\\[[^]]*?\\\])", re.DOTALL)
        out: List[str] = []
        last = 0
        for m in pattern.finditer(s):
            out.append(ascii_only_upper(s[last:m.start()]))
            out.append(m.group(0))
            last = m.end()
        out.append(ascii_only_upper(s[last:]))
        return "".join(out)

    # Top-level
    if isinstance(data.get("answer"), str):
        old = data["answer"]
        add_diff("answer", old, uppercase_preserving_latex(old))

    # Nested
    for list_name in ("tossups", "bonuses"):
        arr = data.get(list_name)
        if isinstance(arr, list):
            for i, q in enumerate(arr):
                if not isinstance(q, dict):
                    continue
                if isinstance(q.get("answer"), str):
                    old = q["answer"]
                    add_diff(f"{list_name}[{i}].answer", old, uppercase_preserving_latex(old))
                answers = q.get("answers")
                if isinstance(answers, list):
                    for j, elem in enumerate(answers):
                        if isinstance(elem, str):
                            add_diff(f"{list_name}[{i}].answers[{j}]", elem, uppercase_preserving_latex(elem))
                        elif isinstance(elem, dict) and isinstance(elem.get("answer"), str):
                            old = elem["answer"]
                            add_diff(f"{list_name}[{i}].answers[{j}].answer", old, uppercase_preserving_latex(old))

    # Keep only actual changes
    return [d for d in diffs if d["from"] != d["to"]]


def init_firestore(project_id: str):
    try:
        firebase_admin.get_app()
    except ValueError:
        cred = firebase_admin.credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": project_id})
    return firestore_admin.client()


def normalize_round_id(round_id: str, removes: List[str] | None = None, replacements: Dict[str, str] | None = None) -> str:
    """Normalize a round identifier string.

        Steps:
            1. Replace any round-robin variants with 'RR'.
            2. Replace any double-elimination variants with 'DE'.
            3. Collapse whitespace sequences to single spaces.
            4. Remove a single space after 'RR' (and 'DE') when followed by an alphanumeric token (digits/letters).
            5. Remove solitary 'R' prefix before digits (but not 'RR').
            6. Remove any user-specified substrings provided via --remove (case-insensitive, literal match, repeated until gone).
            7. Apply any user-specified replacements (case-insensitive) of the form SRC=DEST (performed after removals, before final whitespace collapse).
            8. Collapse whitespace again and strip leading/trailing space.
    """

    new_id = ROUND_ROBIN_PATTERN.sub("RR", round_id)
    new_id = DOUBLE_ELIM_PATTERN.sub("DE", new_id)
    # Collapse multiple spaces early so the RR space removal regex is simpler
    new_id = re.sub(r"\s+", " ", new_id)
    # Remove space after RR when followed by alphanum (e.g., RR 1 -> RR1, RR A -> RRA)
    new_id = re.sub(r"\bRR ([0-9A-Za-z])", r"RR\1", new_id)
    # Remove space after DE when followed by alphanum (e.g., DE 1 -> DE1, DE A -> DEA)
    new_id = re.sub(r"\bDE ([0-9A-Za-z])", r"DE\1", new_id)
    # Remove solitary 'R' prefix before digits (avoid touching 'RR') in token contexts
    # Patterns: start of string R\d+, or space R\d+, or parentheses/brackets before R
    # Use negative lookahead to ensure not 'RR'
    new_id = re.sub(r"(?<!R)\bR(\d+)\b", r"\1", new_id)
    # Apply user provided removals (case-insensitive) first
    # Apply user provided removals (case-insensitive)
    if removes:
        for raw in removes:
            if not raw:
                continue
            # Escape for regex, perform global, case-insensitive removal repeatedly until gone
            pattern = re.compile(re.escape(raw), re.IGNORECASE)
            while True:
                new_id_new = pattern.sub("", new_id)
                if new_id_new == new_id:
                    break
                new_id = new_id_new
        new_id = re.sub(r"\s+", " ", new_id)
    # Apply replacements (SRC=DEST, case-insensitive, literal, global). Longer SRC first to avoid partial overlaps.
    if replacements:
        # Sort keys by length desc for deterministic handling of overlaps
        for src in sorted(replacements.keys(), key=len, reverse=True):
            dest = replacements[src]
            pattern = re.compile(re.escape(src), re.IGNORECASE)
            new_id = pattern.sub(dest, new_id)
        new_id = re.sub(r"\s+", " ", new_id)
    new_id = new_id.strip()
    return new_id


def _count_internal_round_mismatches(data: Dict[str, Any], expected_round: str) -> int:
    """Count how many internal 'round' references differ from expected_round.

    Checks top-level 'round' plus each dict in tossups/bonuses lists.
    """
    mismatches = 0
    if data.get("round") != expected_round:
        mismatches += 1
    for list_name in ("tossups", "bonuses"):
        arr = data.get(list_name)
        if isinstance(arr, list):
            for q in arr:
                if isinstance(q, dict) and q.get("round") != expected_round:
                    mismatches += 1
    return mismatches


def _fix_internal_round_references(data: Dict[str, Any], expected_round: str) -> int:
    """Mutate data in-place to set all 'round' fields to expected_round.

    Returns number of individual field updates performed.
    """
    changes = 0
    if data.get("round") != expected_round:
        data["round"] = expected_round
        changes += 1
    for list_name in ("tossups", "bonuses"):
        arr = data.get(list_name)
        if isinstance(arr, list):
            for q in arr:
                if isinstance(q, dict) and q.get("round") != expected_round:
                    q["round"] = expected_round
                    changes += 1
    return changes


def plan_changes(db, tournament: str, subcollection: str, removes: List[str], replacements: Dict[str, str], *, uppercase_answers: bool = True):
    """Inspect round docs and plan renames and/or internal fixes.

        Returns tuple: (renames, internal_updates, category_updates)
      renames: list of dicts {old_id, new_id, internal_mismatches}
      internal_updates: list of dicts {doc_id, internal_mismatches}
            category_updates: list of dicts {doc_id, category_changes, answer_changes}
    """
    base = db.collection("tournaments").document(tournament).collection(subcollection)
    renames: List[Dict[str, Any]] = []
    internal_updates: List[Dict[str, Any]] = []
    category_updates: List[Dict[str, Any]] = []
    for snap in base.stream():
        old_id = snap.id
        data = snap.to_dict() or {}
        new_id = normalize_round_id(old_id, removes, replacements)
        # Determine expected_round for internal consistency (use new_id even if rename)
        expected_round = new_id
        mismatches = _count_internal_round_mismatches(data, expected_round)
        cat_changes = _preview_category_clean_count(data)
        cat_diffs = _preview_category_clean_diff(data) if cat_changes else []
        ans_changes = _preview_answer_upper_count(data) if uppercase_answers else 0
        ans_diffs = _preview_answer_upper_diff(data) if uppercase_answers and ans_changes else []
        if new_id != old_id:
            renames.append({
                "old_id": old_id,
                "new_id": new_id,
                "internal_mismatches": mismatches,
                "category_diffs": cat_diffs,
                "answer_diffs": ans_diffs,
            })
        else:
            if mismatches:
                internal_updates.append({
                    "doc_id": old_id,
                    "internal_mismatches": mismatches,
                    "category_diffs": cat_diffs,
                    "answer_diffs": ans_diffs,
                })
            elif cat_changes or ans_changes:
                category_updates.append({
                    "doc_id": old_id,
                    "category_changes": cat_changes,
                    "answer_changes": ans_changes,
                    "category_diffs": cat_diffs,
                    "answer_diffs": ans_diffs,
                })
    return renames, internal_updates, category_updates


def apply_internal_updates(
    db,
    tournament: str,
    subcollection: str,
    updates: List[Dict[str, Any]],
    *,
    execute: bool,
    uppercase_answers: bool = True,
):
    base = db.collection("tournaments").document(tournament).collection(subcollection)
    fixed = 0
    for item in updates:
        doc_id = item["doc_id"]
        ref = base.document(doc_id)
        snap = ref.get()
        if not snap.exists:
            eprint(f"[WARN] Missing doc during internal update: {doc_id}")
            continue
        data = snap.to_dict() or {}
        expected_round = doc_id  # doc id is already normalized
        round_changes = _fix_internal_round_references(data, expected_round)
        cat_changes = _clean_categories_in_doc(data)
        ans_changes = _uppercase_answers_in_doc(data) if uppercase_answers else 0
        total_changes = round_changes + cat_changes + ans_changes
        if total_changes:
            details = []
            if round_changes:
                details.append(f"round={round_changes}")
            if cat_changes:
                details.append(f"categories={cat_changes}")
            if ans_changes:
                details.append(f"answers={ans_changes}")
            eprint(f"[FIX-DOC] {doc_id}: updated {'; '.join(details)}")
            if execute:
                ref.set(data, merge=True)
                fixed += 1
    return fixed


def apply_renames(
    db,
    tournament: str,
    subcollection: str,
    renames: List[Dict[str, Any]],
    *,
    execute: bool,
    keep_original: bool,
    force: bool,
    uppercase_answers: bool = True,
):
    base = db.collection("tournaments").document(tournament).collection(subcollection)
    performed = 0
    skipped = 0
    for item in renames:
        old_id = item["old_id"]
        new_id = item["new_id"]
        internal_mismatches = item.get("internal_mismatches", 0)
        old_ref = base.document(old_id)
        new_ref = base.document(new_id)
        old_snap = old_ref.get()
        if not old_snap.exists:
            eprint(f"[WARN] Original doc missing: {old_id}; skipping")
            skipped += 1
            continue
        if new_ref.get().exists and not force:
            eprint(f"[SKIP] Target already exists (use --force to overwrite): {new_id}")
            skipped += 1
            continue
        data = old_snap.to_dict() or {}
        # Fix internals to new id before writing
        changed_internal = _fix_internal_round_references(data, new_id)
        # Compute diffs before mutate? We already mutated for round; categories we can preview per original
        cat_diffs = _preview_category_clean_diff(data)
        ans_diffs = _preview_answer_upper_diff(data) if uppercase_answers else []
        cat_changes = _clean_categories_in_doc(data)
        ans_changes = _uppercase_answers_in_doc(data) if uppercase_answers else 0
        status_bits = []
        if changed_internal:
            status_bits.append(f"fixed {changed_internal} internal refs")
        if cat_changes:
            status_bits.append(f"cleaned {cat_changes} category fields")
        if ans_changes:
            status_bits.append(f"uppercased {ans_changes} answer fields")
        status_details = f" ({'; '.join(status_bits)})" if status_bits else ""
        eprint(f"[RENAME] {old_id} -> {new_id}{status_details}")
        if cat_diffs:
            for d in cat_diffs:
                eprint(f"         - {d['path']}: '{d['from']}' -> '{d['to']}'")
        if ans_diffs:
            for d in ans_diffs:
                eprint(f"         - {d['path']}: '{d['from']}' -> '{d['to']}'")
        if not execute:
            continue
        new_ref.set(data, merge=True)
        if not keep_original:
            old_ref.delete()
        performed += 1
    return performed, skipped


def apply_category_updates(
    db,
    tournament: str,
    subcollection: str,
    updates: List[Dict[str, Any]],
    *,
    execute: bool,
    uppercase_answers: bool = True,
):
    """Apply category-only cleanups for docs that need no round changes."""
    base = db.collection("tournaments").document(tournament).collection(subcollection)
    fixed = 0
    for item in updates:
        doc_id = item["doc_id"]
        ref = base.document(doc_id)
        snap = ref.get()
        if not snap.exists:
            eprint(f"[WARN] Missing doc during category update: {doc_id}")
            continue
        data = snap.to_dict() or {}
        cat_diffs = _preview_category_clean_diff(data)
        ans_diffs = _preview_answer_upper_diff(data) if uppercase_answers else []
        cat_changes = _clean_categories_in_doc(data)
        ans_changes = _uppercase_answers_in_doc(data) if uppercase_answers else 0
        if cat_changes or ans_changes:
            bits = []
            if cat_changes:
                bits.append(f"categories={cat_changes}")
            if ans_changes:
                bits.append(f"answers={ans_changes}")
            eprint(f"[FIX-METADATA] {doc_id}: cleaned {'; '.join(bits)}")
            for d in cat_diffs:
                eprint(f"    - {d['path']}: '{d['from']}' -> '{d['to']}'")
            for d in ans_diffs:
                eprint(f"    - {d['path']}: '{d['from']}' -> '{d['to']}'")
            if execute:
                ref.set(data, merge=True)
                fixed += 1
    return fixed


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Rename Firestore round documents replacing 'round robin' with 'RR'.")
    p.add_argument("--project-id", required=True, help="GCP project id")
    p.add_argument("--tournament", default="tjsbt", help="Tournament id (default: tjsbt)")
    p.add_argument("--round-subcollection", default="rounds", help="Rounds subcollection name (default: rounds)")
    p.add_argument("--execute", action="store_true", help="Actually perform writes/deletes (otherwise dry-run)")
    p.add_argument("--keep-original", action="store_true", help="Keep old documents instead of deleting after copy")
    p.add_argument("--force", action="store_true", help="Overwrite target doc if it already exists")
    p.add_argument("--rename-tournament", metavar="NEW_ID", help="Copy all rounds to a new tournament id (and optionally delete originals unless --keep-original-tournament). Applied after round id normalization.")
    p.add_argument("--keep-original-tournament", action="store_true", help="When used with --rename-tournament, retain the source tournament's documents instead of deleting them.")
    p.add_argument(
        "--remove",
        action="append",
        default=[],
        metavar="SUBSTR",
        help="Substring to remove from round ids (case-insensitive). Can be repeated.",
    )
    p.add_argument(
        "--replace",
        action="append",
        default=[],
        metavar="SRC=DEST",
        help="Literal, case-insensitive replacement applied after removals. Can be repeated. Example: --replace 'Qualifiers=Q' --replace 'Playoff=PO'",
    )
    p.add_argument(
        "--no-uppercase-answers",
        action="store_true",
        help="Disable uppercasing any answer fields and suppress answer diffs in planning",
    )
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    db = init_firestore(args.project_id)
    eprint(f"[INFO] Listing rounds for tournament {args.tournament}")
    # Parse replacements into dict (skip malformed entries without '=')
    replacements: Dict[str, str] = {}
    for rep in args.replace:
        if not rep or '=' not in rep:
            eprint(f"[WARN] Ignoring malformed --replace token: {rep}")
            continue
        src, dest = rep.split('=', 1)
        src = src.strip()
        dest = dest.strip()
        if not src:
            eprint(f"[WARN] Empty source in --replace token: {rep}")
            continue
        replacements[src] = dest
    renames, internal_updates, category_updates = plan_changes(
        db,
        args.tournament,
        args.round_subcollection,
        args.remove,
        replacements,
        uppercase_answers=(not args.no_uppercase_answers),
    )
    if not renames and not internal_updates and not category_updates:
        eprint("[INFO] No round-id renames or internal/category fixes required (still checking tournament-level actions).")
    if renames:
        eprint("[PLAN - RENAMES]")
        for item in renames:
            extra = f" (internal mismatches: {item['internal_mismatches']})" if item.get("internal_mismatches") else ""
            eprint(f"  {item['old_id']} -> {item['new_id']}{extra}")
            diffs = item.get("category_diffs") or []
            for d in diffs:
                eprint(f"    - {d['path']}: '{d['from']}' -> '{d['to']}'")
            ans_diffs = item.get("answer_diffs") or []
            for d in ans_diffs:
                eprint(f"    - {d['path']}: '{d['from']}' -> '{d['to']}'")
    if internal_updates:
        eprint("[PLAN - INTERNAL FIXES]")
        for item in internal_updates:
            eprint(f"  {item['doc_id']} (mismatched embedded 'round' refs: {item['internal_mismatches']})")
            diffs = item.get("category_diffs") or []
            for d in diffs:
                eprint(f"    - {d['path']}: '{d['from']}' -> '{d['to']}'")
            ans_diffs = item.get("answer_diffs") or []
            for d in ans_diffs:
                eprint(f"    - {d['path']}: '{d['from']}' -> '{d['to']}'")
    if category_updates:
        eprint("[PLAN - CATEGORY/ANSWER CLEANING]")
        for item in category_updates:
            eprint(
                f"  {item['doc_id']} (category fields to clean: {item.get('category_changes', 0)}; answer fields to upper: {item.get('answer_changes', 0)})"
            )
            diffs = item.get("category_diffs") or []
            for d in diffs:
                eprint(f"    - {d['path']}: '{d['from']}' -> '{d['to']}'")
            ans_diffs = item.get("answer_diffs") or []
            for d in ans_diffs:
                eprint(f"    - {d['path']}: '{d['from']}' -> '{d['to']}'")

    renamed = skipped = fixed_internal = fixed_categories = 0
    if renames:
        renamed, skipped = apply_renames(
            db,
            args.tournament,
            args.round_subcollection,
            renames,
            execute=args.execute,
            keep_original=args.keep_original,
            force=args.force,
            uppercase_answers=(not args.no_uppercase_answers),
        )
    if internal_updates:
        fixed_internal = apply_internal_updates(
            db,
            args.tournament,
            args.round_subcollection,
            internal_updates,
            execute=args.execute,
            uppercase_answers=(not args.no_uppercase_answers),
        )
    if category_updates:
        fixed_categories = apply_category_updates(
            db,
            args.tournament,
            args.round_subcollection,
            category_updates,
            execute=args.execute,
            uppercase_answers=(not args.no_uppercase_answers),
        )

    # Tournament-level rename (copy) feature
    if args.rename_tournament:
        new_tid = args.rename_tournament.strip()
        if not new_tid:
            eprint("[ERROR] --rename-tournament provided but empty after stripping.")
        else:
            eprint(f"[INFO] Planning tournament rename: {args.tournament} -> {new_tid}")
            src_base = db.collection("tournaments").document(args.tournament).collection(args.round_subcollection)
            dst_base = db.collection("tournaments").document(new_tid).collection(args.round_subcollection)
            moved = 0
            skipped_existing = 0
            for snap in src_base.stream():
                rid = snap.id
                data = snap.to_dict() or {}
                # Update internal 'tournament' references at top-level and in questions
                def fix_tournament_refs(doc: Dict[str, Any]):
                    changed = 0
                    if doc.get("tournament") != new_tid:
                        doc["tournament"] = new_tid
                        changed += 1
                    for list_name in ("tossups", "bonuses"):
                        arr = doc.get(list_name)
                        if isinstance(arr, list):
                            for q in arr:
                                if isinstance(q, dict) and q.get("tournament") != new_tid:
                                    q["tournament"] = new_tid
                                    changed += 1
                    return changed
                _ = fix_tournament_refs(data)
                dst_ref = dst_base.document(rid)
                if not args.force and dst_ref.get().exists:
                    skipped_existing += 1
                    continue
                if args.execute:
                    dst_ref.set(data, merge=True)
                    if not args.keep_original_tournament:
                        # Delete original only if we fully migrated (avoid partial loss if write failed)
                        try:
                            src_base.document(rid).delete()
                        except Exception as ex:  # pragma: no cover
                            eprint(f"[WARN] Failed to delete source round {rid}: {ex}")
                moved += 1
            eprint(f"[TOURNAMENT-RENAME] Copied rounds: {moved} | Skipped (exists): {skipped_existing}{'' if args.execute else ' (dry-run)'}")
            if args.execute and not args.keep_original_tournament:
                eprint(f"[TOURNAMENT-RENAME] Source tournament '{args.tournament}' rounds removed after copy.")

    eprint("========== Summary ==========")
    eprint(
        f"Rename candidates: {len(renames)} | Internal-fix-only candidates: {len(internal_updates)} | Category-only candidates: {len(category_updates)}"
    )
    if args.execute:
        eprint(f"Renamed docs: {renamed}")
        eprint(f"Internal-only fixed docs: {fixed_internal}")
        eprint(f"Category-only fixed docs: {fixed_categories}")
    else:
        eprint("(dry-run) Use --execute to apply changes")
    eprint(f"Skipped renames: {skipped}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())

