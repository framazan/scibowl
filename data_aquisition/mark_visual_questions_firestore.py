"""Utility: Mark selected questions as visual in a given tournament round.

This script updates round documents at:
  tournaments/<tournamentId>/rounds/<roundId>

Sets the field 'visual' = 'true' (string) on the specified question numbers
in the chosen list(s): bonuses, tossups, or both. You can also delete/unset
the 'visual' attribute for those questions with --delete-visual.

Why string 'true'? The frontend treats either a boolean true on
'is_visual_bonus' or a string 'true' in 'visual' as a positive signal:
  String(b.visual || '').toLowerCase() === 'true'

Usage examples:
  python mark_visual_questions_firestore.py \
    --project-id YOUR_PROJECT \
    --tournament tjsbt \
    --round RR3 \
    --type bonus \
    --numbers 5,12,18 \
    --execute

Delete the attribute instead of setting it:
    python mark_visual_questions_firestore.py \
        --project-id YOUR_PROJECT \
        --tournament tjsbt \
        --round RR3 \
        --type both \
        --numbers 1-5 \
        --delete-visual \
        --execute

Dry-run by default; pass --execute to write changes.
"""

from __future__ import annotations

import argparse
import sys
from typing import Dict, List, Optional, Set, Tuple

import firebase_admin
from firebase_admin import firestore as firestore_admin


def eprint(*a, **k):
    print(*a, file=sys.stderr, **k)


def init_firestore(project_id: str):
    """Initialize firebase_admin and return a Firestore client."""
    try:
        firebase_admin.get_app()
    except ValueError:
        cred = firebase_admin.credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": project_id})
    return firestore_admin.client()


def parse_numbers(spec: str) -> Tuple[Set[int], Set[str]]:
    """Parse a comma-separated list of numbers and ranges like "1,3-5,9".

    Returns a tuple of two sets: (as_ints, as_strs) for flexible matching.
    """
    ints: Set[int] = set()
    strs: Set[str] = set()
    if not spec:
        return ints, strs
    for token in spec.split(','):
        t = token.strip()
        if not t:
            continue
        if '-' in t:
            a, b = t.split('-', 1)
            try:
                start = int(a.strip())
                end = int(b.strip())
                if start > end:
                    start, end = end, start
                for n in range(start, end + 1):
                    ints.add(n)
                    strs.add(str(n))
            except ValueError:
                # Fallback: treat as literal if not numeric
                strs.add(t)
        else:
            try:
                n = int(t)
                ints.add(n)
                strs.add(str(n))
            except ValueError:
                strs.add(t)
    return ints, strs


def number_matches(qnum, targets_int: Set[int], targets_str: Set[str]) -> bool:
    """Return True if qnum matches provided targets.

    Accepts ints and numeric strings interchangeably.
    """
    if qnum is None:
        return False
    # Try numeric compare first
    try:
        qi = int(qnum)
        if qi in targets_int:
            return True
    except Exception:
        pass
    # Fallback string compare
    return str(qnum).strip() in targets_str


def update_round_questions(
    db,
    *,
    tournament: str,
    round_id: str,
    subcollection: str,
    which: str,
    targets_int: Set[int],
    targets_str: Set[str],
    value: Optional[str],
    execute: bool,
):
    """Update the specified questions within a round doc.

    which: 'bonus' | 'tossup' | 'both'
    value: written to the 'visual' field on matching questions (string). If None,
      the 'visual' field will be deleted from matching questions.
    """
    ref = db.collection("tournaments").document(tournament).collection(subcollection).document(round_id)
    snap = ref.get()
    if not snap.exists:
        eprint(f"[ERROR] Round doc not found: tournaments/{tournament}/{subcollection}/{round_id}")
        return 0
    data = snap.to_dict() or {}

    total_changes = 0
    update_payload: Dict[str, List[dict]] = {}

    def process_list(list_name: str):
        nonlocal total_changes
        arr = data.get(list_name)
        if not isinstance(arr, list):
            return
        changed = False
        new_arr = []
        for q in arr:
            if isinstance(q, dict) and number_matches(q.get("question_number"), targets_int, targets_str):
                if value is None:
                    # delete/unset the field if present
                    if "visual" in q:
                        q = dict(q)  # shallow copy to avoid mutating original
                        q.pop("visual", None)
                        changed = True
                        total_changes += 1
                else:
                    if q.get("visual") != value:
                        q = dict(q)  # shallow copy to avoid mutating original
                        q["visual"] = value
                        changed = True
                        total_changes += 1
            new_arr.append(q)
        if changed:
            update_payload[list_name] = new_arr

    if which in ("bonus", "both"):
        process_list("bonuses")
    if which in ("tossup", "both"):
        process_list("tossups")

    if not update_payload:
        eprint("[INFO] No matching questions to update (nothing changed)")
        return 0

    if execute:
        # Use update to write only touched arrays
        ref.update(update_payload)
        eprint(f"[WRITE] Updated {len(update_payload)} field(s): {', '.join(update_payload.keys())}")
    else:
        eprint(f"[DRY] Would update {len(update_payload)} field(s): {', '.join(update_payload.keys())}")
    if value is None:
        eprint(f"[DETAIL] Questions with 'visual' cleared: {total_changes}")
    else:
        eprint(f"[DETAIL] Questions set visual='{value}': {total_changes}")
    return total_changes


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Mark specific questions as visual='true' in a tournament round (dry-run by default)")
    p.add_argument("--project-id", required=True, help="GCP project id")
    p.add_argument("--tournament", default="tjsbt", help="Tournament id (default: tjsbt)")
    p.add_argument("--round", required=True, help="Round id (document id under rounds subcollection)")
    p.add_argument("--round-subcollection", default="rounds", help="Rounds subcollection name (default: rounds)")
    p.add_argument("--type", choices=["bonus", "tossup", "both"], default="bonus", help="Which list to update (default: bonus)")
    p.add_argument("--numbers", required=True, help="Comma-separated question numbers, supports ranges. Example: 5,12,18-20")
    p.add_argument("--value", default="true", help="String value to write to the 'visual' field (default: 'true')")
    p.add_argument("--delete-visual", action="store_true", help="Delete/unset the 'visual' attribute on matching questions instead of setting a value")
    p.add_argument("--execute", action="store_true", help="Apply changes (otherwise dry-run)")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    targets_int, targets_str = parse_numbers(args.numbers)
    if not targets_int and not targets_str:
        eprint("[ERROR] No valid question numbers parsed from --numbers")
        return 2
    db = init_firestore(args.project_id)
    # Determine operation
    op_value: Optional[str]
    if args.delete_visual:
        op_value = None
        eprint(
            f"[INFO] Clearing 'visual' for tournament={args.tournament} round={args.round} type={args.type} numbers={args.numbers}"
        )
        if args.value and args.value != "true":
            eprint("[WARN] --delete-visual provided; ignoring --value")
    else:
        op_value = args.value
        eprint(
            f"[INFO] Marking visual='{args.value}' for tournament={args.tournament} round={args.round} type={args.type} numbers={args.numbers}"
        )
    changed = update_round_questions(
        db,
        tournament=args.tournament,
        round_id=args.round,
        subcollection=args.round_subcollection,
        which=args.type,
        targets_int=targets_int,
        targets_str=targets_str,
        value=op_value,
        execute=args.execute,
    )
    if not args.execute:
        eprint("(dry-run) Use --execute to apply changes")
    return 0 if changed >= 0 else 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
