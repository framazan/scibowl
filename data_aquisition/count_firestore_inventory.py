"""Utility: Count tournaments, rounds, tossups, and bonuses in Firestore.

Scans the database under:
  tournaments/<tournamentId>/rounds/<roundId>

For each round document, counts the number of items in the 'tossups' and
'bonuses' arrays (when present), and prints overall totals.

Usage:
  python count_firestore_inventory.py --project-id YOUR_PROJECT

Optional flags:
    --round-subcollection  Name of the rounds subcollection (default: rounds)
    --per-tournament       Print a compact per-tournament breakdown
"""

from __future__ import annotations

import argparse
import sys
from typing import Dict, Any, Set, List

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


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Count tournaments, rounds, tossups, and bonuses in Firestore")
    p.add_argument("--project-id", required=True, help="GCP project id")
    p.add_argument("--round-subcollection", default="rounds", help="Rounds subcollection name (default: rounds)")
    p.add_argument("--per-tournament", action="store_true", help="Print per-tournament breakdown as well")
    return p.parse_args(argv)


def count_inventory(db, *, subcollection: str, per_tournament: bool = False) -> Dict[str, Any]:
    """Count totals using collection group for comprehensive coverage.

    - Uses collection_group over the rounds subcollection to discover all rounds and
      associated tournaments (covers cases where parent tournament doc isn't present).
    - Also lists top-level tournaments to include tournaments with zero rounds so they
      are counted in the tournament total.
    """
    total_rounds = 0
    total_tossups = 0
    total_bonuses = 0

    per_t_counts: Dict[str, Dict[str, int]] = {}
    seen_tournaments: Set[str] = set()

    if per_tournament:
        eprint("[INFO] Computing per-tournament breakdown (collection group)...")

    # First pass: collection group over rounds to accumulate counts
    cg = db.collection_group(subcollection)
    for r_snap in cg.stream():
        # Resolve tournament id from document reference path
        parent_doc = r_snap.reference.parent.parent  # DocumentReference: <collection>/<docId>
        if parent_doc is None:
            continue
        # Only count rounds that live under tournaments/*/rounds/*
        parent_collection = parent_doc.parent.id if parent_doc.parent is not None else None
        if parent_collection != "tournaments":
            # Skip user-scoped or any other non-tournament rounds
            continue
        tid = parent_doc.id
        seen_tournaments.add(tid)
        bucket = per_t_counts.setdefault(tid, {"rounds": 0, "tossups": 0, "bonuses": 0})
        bucket["rounds"] += 1
        data: Dict[str, Any] = r_snap.to_dict() or {}
        tu = data.get("tossups")
        bo = data.get("bonuses")
        if isinstance(tu, list):
            bucket["tossups"] += len(tu)
        if isinstance(bo, list):
            bucket["bonuses"] += len(bo)

    # Second pass: add tournaments that have zero rounds (top-level listing)
    tournaments_ref = db.collection("tournaments")
    for t_snap in tournaments_ref.stream():
        tid = t_snap.id
        if tid not in per_t_counts:
            per_t_counts[tid] = {"rounds": 0, "tossups": 0, "bonuses": 0}

    # Aggregate totals
    total_tournaments = len(per_t_counts)
    for tid, counts in sorted(per_t_counts.items()):
        total_rounds += counts["rounds"]
        total_tossups += counts["tossups"]
        total_bonuses += counts["bonuses"]
        if per_tournament:
            print(f"{tid}: rounds={counts['rounds']}, tossups={counts['tossups']}, bonuses={counts['bonuses']}")

    # Retrieve meta/tournaments.list for publication tracking
    meta_missing: List[str] = []
    try:
        meta_snap = db.document("meta", "tournaments").get()
        meta_list = []
        if meta_snap.exists:
            meta_data = meta_snap.to_dict() or {}
            meta_list = [x for x in (meta_data.get("list") or []) if isinstance(x, str) and x]
        # Identify tournaments present in per_t_counts but not in meta.list
        meta_set = set(meta_list)
        for tid in per_t_counts.keys():
            if tid not in meta_set:
                meta_missing.append(tid)
    except Exception as ex:  # pragma: no cover
        eprint(f"[WARN] Failed to load meta/tournaments: {ex}")

    return {
        "tournaments": total_tournaments,
        "rounds": total_rounds,
        "tossups": total_tossups,
        "bonuses": total_bonuses,
        "meta_missing": sorted(meta_missing),
    }


def main(argv=None):
    args = parse_args(argv)
    db = init_firestore(args.project_id)
    eprint(f"[INFO] Scanning Firestore: tournaments/*/{args.round_subcollection}/*")
    totals = count_inventory(db, subcollection=args.round_subcollection, per_tournament=args.per_tournament)
    print("========== Totals ==========")
    print(f"Tournaments: {totals['tournaments']}")
    print(f"Rounds:      {totals['rounds']}")
    print(f"Tossups:     {totals['tossups']}")
    print(f"Bonuses:     {totals['bonuses']}")
    missing = totals.get("meta_missing") or []
    if missing:
        print("\nTournaments missing from meta.list:")
        for tid in missing:
            print(f"- {tid}")
    else:
        print("\nAll discovered tournaments are present in meta.list")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
