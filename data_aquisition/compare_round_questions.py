"""Compare questions between two saved rounds for a specific user in Firestore, and optionally copy them to another user.

Usage (env vars method):
  export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
  python compare_round_questions.py \
      --user J29khCLs1CSxYFzJ2W3CGLjGYcw1 \
      --round-a qTVzIi7qFFASGng6Jdkv \
      --round-b pmTS0L7lHDNTKc1vXj0y

Or pass an explicit key file:
    python compare_round_questions.py --cred path/to/serviceAccount.json ...

To also copy both rounds to another user (destination UID) while comparing:
    python compare_round_questions.py \
            --user SRC_USER --round-a RA --round-b RB \
            --copy-to DEST_USER \
            [--preserve-ids] [--preserve-created-at]

Skip comparison and copy a single round only:
    python compare_round_questions.py \
            --copy-only --user SRC_USER --round ROUND_ID \
            --copy-to DEST_USER [--preserve-ids] [--preserve-created-at]

Copy ALL rounds from a user to another (preserving IDs and overwriting existing by default):
    python compare_round_questions.py \
            --copy-all --user SRC_USER --copy-to DEST_USER \
            [--preserve-created-at]  # createdAt not copied by default

Copy semantics:
    * By default new rounds are created with fresh random document IDs (Firestore auto IDs) and the original
        payload minus any 'createdAt' field (letting serverTimestamp populate if desired later).
    * If --preserve-created-at is passed and the source document has a 'createdAt' value shaped like a Firestore
        timestamp dict (seconds/nanos) it will be copied verbatim (NOT recommended if you rely on ordering by creation).
    * If --preserve-ids is passed we attempt to write to the same round document IDs under the destination user. If a
        document with that ID already exists for the destination user the tool will abort unless --force-overwrite is given.
    * Meta index (users/{uid}/meta/roundsIndex) is updated / merged for the destination user to include the new entries.
        We mimic the web logic: entries.{roundId} = { title, count, createdAt } (createdAt only if preserved).
    * We do not touch 'folders' metadata.
    * A summary of copied rounds and new IDs prints at the end.

The round schema (per web code) is:
  users/{uid}/rounds/{roundId} document containing fields:
    title: str
    questionType: 'both' | 'tossup' | 'bonus'
    count: int
    tournaments: list[str]
    categories: list[str]
    roundRanges: list[ {...} ]
    pairs: list[ { tossupId, bonusId, tossupMeta, bonusMeta } ]

We treat any non-null tossupId or bonusId as a question identifier. Intersection is
computed on the union of tossup and bonus IDs (they come from the master questions collection
and are globally unique across types per current design). If you need to distinguish, use
--separate to report intersections per type separately.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import List, Optional, Set, Dict, Any, Tuple

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:  # pragma: no cover
    print("firebase-admin is required. Install with: pip install firebase-admin", file=sys.stderr)
    sys.exit(1)

@dataclass
class RoundDoc:
    id: str
    raw: Dict[str, Any]
    tossup_ids: List[str]
    bonus_ids: List[str]

    @property
    def all_ids(self) -> Set[str]:
        return { *self.tossup_ids, *self.bonus_ids }


def init_firebase(cred_path: Optional[str]) -> None:
    if firebase_admin._apps:  # already initialized
        return
    if cred_path:
        cred = credentials.Certificate(cred_path)
    else:
        # If GOOGLE_APPLICATION_CREDENTIALS set, firebase_admin will pick it up via default()?
        # Not always; we emulate gcloud behaviour by using Application Default if no cert provided.
        # Try default credentials first; fallback to explicit error.
        try:
            cred = credentials.ApplicationDefault()
        except Exception as e:  # pragma: no cover
            raise SystemExit(f"Failed to load credentials (set GOOGLE_APPLICATION_CREDENTIALS or pass --cred): {e}")
    firebase_admin.initialize_app(cred)


def fetch_round(user_id: str, round_id: str) -> RoundDoc:
    db = firestore.client()
    ref = db.collection('users').document(user_id).collection('rounds').document(round_id)
    snap = ref.get()
    if not snap.exists:
        raise ValueError(f"Round {round_id} not found for user {user_id}")
    data = snap.to_dict() or {}
    pairs = data.get('pairs') or []
    tossup_ids = []
    bonus_ids = []
    for p in pairs:
        tid = p.get('tossupId')
        bid = p.get('bonusId')
        if tid:
            tossup_ids.append(tid)
        if bid:
            bonus_ids.append(bid)
    return RoundDoc(id=round_id, raw=data, tossup_ids=tossup_ids, bonus_ids=bonus_ids)


def fetch_all_rounds(user_id: str) -> List[RoundDoc]:
    """Fetch all round documents for a user.

    Returns a list of RoundDoc items. If the user has no rounds, returns [].
    """
    db = firestore.client()
    rounds = []
    col = db.collection('users').document(user_id).collection('rounds')
    for snap in col.stream():
        data = snap.to_dict() or {}
        pairs = data.get('pairs') or []
        tu_ids, bo_ids = [], []
        for p in pairs:
            tid = p.get('tossupId')
            bid = p.get('bonusId')
            if tid:
                tu_ids.append(tid)
            if bid:
                bo_ids.append(bid)
        rounds.append(RoundDoc(id=snap.id, raw=data, tossup_ids=tu_ids, bonus_ids=bo_ids))
    return rounds


def compare_rounds(a: RoundDoc, b: RoundDoc, separate: bool = False) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        'roundA': a.id,
        'roundB': b.id,
        'roundA_count': len(a.all_ids),
        'roundB_count': len(b.all_ids),
    }
    inter_all = sorted(a.all_ids & b.all_ids)
    result['intersection_all'] = inter_all
    result['intersection_all_count'] = len(inter_all)
    if separate:
        tu_inter = sorted(set(a.tossup_ids) & set(b.tossup_ids))
        bo_inter = sorted(set(a.bonus_ids) & set(b.bonus_ids))
        result['tossup_intersection'] = tu_inter
        result['tossup_intersection_count'] = len(tu_inter)
        result['bonus_intersection'] = bo_inter
        result['bonus_intersection_count'] = len(bo_inter)
    # Provide helpful difference lists (up to some cap) for debugging
    diff_a = sorted(a.all_ids - b.all_ids)
    diff_b = sorted(b.all_ids - a.all_ids)
    result['unique_to_roundA'] = diff_a
    result['unique_to_roundB'] = diff_b
    return result


def copy_round_to_user(src_round: RoundDoc, src_user: str, dest_user: str, preserve_id: bool = False, preserve_created_at: bool = False, force_overwrite: bool = False) -> Tuple[str, bool]:
    """Copy a single round document to another user.

    Returns (dest_round_id, created_new)
    created_new=False indicates we overwrote (only if force_overwrite True).
    """
    db = firestore.client()
    rounds_col = db.collection('users').document(dest_user).collection('rounds')
    src_data = dict(src_round.raw)
    # Remove Firestore internal fields if any stray
    for k in list(src_data.keys()):
        if k.startswith('_'):  # heuristic
            src_data.pop(k, None)
    if not preserve_created_at:
        src_data.pop('createdAt', None)
    # Determine destination doc ref
    created_new = True
    if preserve_id:
        dest_ref = rounds_col.document(src_round.id)
        existing = dest_ref.get()
        if existing.exists and not force_overwrite:
            raise RuntimeError(f"Destination already has round id {src_round.id}; use --force-overwrite to overwrite.")
        dest_ref.set(src_data)
        dest_id = src_round.id
        created_new = not existing.exists
    else:
        # add() gives new ID
        dest_ref = rounds_col.document()
        dest_ref.set(src_data)
        dest_id = dest_ref.id
    # Update meta index similar to web save: users/{uid}/meta/roundsIndex entries map
    idx_ref = db.collection('users').document(dest_user).collection('meta').document('roundsIndex')
    meta_entry = {
        'title': src_data.get('title'),
        'count': src_data.get('count'),
    }
    if preserve_created_at and 'createdAt' in src_round.raw:
        meta_entry['createdAt'] = src_round.raw['createdAt']
    idx_ref.set({ 'entries': { dest_id: meta_entry } }, merge=True)
    return dest_id, created_new


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description='Compare question IDs between two saved rounds for a user.')
    parser.add_argument('--user', required=True, help='User UID (parent document under users collection)')
    # Rounds: in compare mode, both --round-a and --round-b are required; in copy-only mode, use --round (or --round-a)
    parser.add_argument('--round-a', help='First round document ID (required unless --copy-only with --round specified)')
    parser.add_argument('--round-b', help='Second round document ID (required in compare mode)')
    parser.add_argument('--round', help='Single round document ID to copy when using --copy-only')
    parser.add_argument('--cred', help='Path to Firebase service account JSON (optional if GOOGLE_APPLICATION_CREDENTIALS set)')
    parser.add_argument('--separate', action='store_true', help='Show separate intersections for tossups and bonuses')
    parser.add_argument('--json', action='store_true', help='Output raw JSON instead of pretty text')
    # Copy options
    parser.add_argument('--copy-to', help='Destination user UID to copy BOTH rounds to (optional)')
    parser.add_argument('--copy-only', action='store_true', help='Skip comparison and copy a single round from --user to --copy-to (requires --round or --round-a)')
    parser.add_argument('--copy-all', action='store_true', help='Copy ALL rounds from --user to --copy-to. Preserves IDs and overwrites existing by default.')
    parser.add_argument('--preserve-ids', action='store_true', help='Use same round document IDs in destination user (fail if exists unless --force-overwrite)')
    parser.add_argument('--preserve-created-at', action='store_true', help='Copy source createdAt field verbatim instead of omitting it')
    parser.add_argument('--force-overwrite', action='store_true', help='Allow overwriting existing destination round docs when --preserve-ids is used')
    args = parser.parse_args(argv)

    init_firebase(args.cred)

    # Mode selection and validation
    if args.copy_all:
        if not args.copy_to:
            raise SystemExit("--copy-all requires --copy-to DEST_USER")
        # In copy-all mode, default to preserving IDs and overwriting existing, unless user explicitly provided flags.
        preserve_ids = True  # requirement: overwrite those with the same uid -> implies same doc IDs
        force_overwrite = True
        try:
            rounds = fetch_all_rounds(args.user)
        except Exception as e:
            print(f"Failed to fetch rounds for user {args.user}: {e}", file=sys.stderr)
            return 1
        if not rounds:
            print(f"No rounds found for user {args.user}. Nothing to copy.")
            return 0
        print(f"Found {len(rounds)} rounds for user {args.user}. Copying to {args.copy_to} ...")
        created = 0
        overwritten = 0
        failed = 0
        for rd in rounds:
            try:
                dest_id, created_new = copy_round_to_user(
                    rd,
                    src_user=args.user,
                    dest_user=args.copy_to,
                    preserve_id=preserve_ids,
                    preserve_created_at=args.preserve_created_at,
                    force_overwrite=force_overwrite,
                )
                if created_new:
                    created += 1
                    status = 'created'
                else:
                    overwritten += 1
                    status = 'overwritten'
                print(f"  {rd.id} -> {dest_id} ({status})")
            except Exception as e:
                failed += 1
                print(f"  FAILED to copy {rd.id}: {e}", file=sys.stderr)
        print(f"Copy-all summary: total={len(rounds)} created={created} overwritten={overwritten} failed={failed}")
        return 0
    elif args.copy_only:
        if not args.copy_to:
            raise SystemExit("--copy-only requires --copy-to DEST_USER")
        src_round_id = args.round or args.round_a
        if not src_round_id:
            raise SystemExit("--copy-only requires --round (or --round-a) to specify the source round id")
        # Fetch and copy single round
        rd = fetch_round(args.user, src_round_id)
        try:
            dest_id, created_new = copy_round_to_user(
                rd,
                src_user=args.user,
                dest_user=args.copy_to,
                preserve_id=args.preserve_ids,
                preserve_created_at=args.preserve_created_at,
                force_overwrite=args.force_overwrite,
            )
            status = 'created' if created_new else 'overwritten'
            print(f"Copied round {rd.id} from user {args.user} -> user {args.copy_to} as {dest_id} ({status})")
        except Exception as e:
            print(f"FAILED to copy round {src_round_id}: {e}", file=sys.stderr)
            return 1
        return 0
    else:
        # Compare mode: require two rounds
        if not args.round_a or not args.round_b:
            raise SystemExit("Compare mode requires --round-a and --round-b (or use --copy-only)")

        round_a = fetch_round(args.user, args.round_a)
        round_b = fetch_round(args.user, args.round_b)
        comparison = compare_rounds(round_a, round_b, separate=args.separate)

        if args.json:
            json.dump(comparison, sys.stdout, indent=2)
            print()
        else:
            print(f"Round A {comparison['roundA']} questions: {comparison['roundA_count']}")
            print(f"Round B {comparison['roundB']} questions: {comparison['roundB_count']}")
            print(f"Common questions (all): {comparison['intersection_all_count']}")
            for qid in comparison['intersection_all']:
                print(f"  * {qid}")
            if args.separate:
                print(f"Common tossups: {comparison.get('tossup_intersection_count')} | IDs: {', '.join(comparison.get('tossup_intersection', []))}")
                print(f"Common bonuses: {comparison.get('bonus_intersection_count')} | IDs: {', '.join(comparison.get('bonus_intersection', []))}")
            print(f"Unique to round A ({len(comparison['unique_to_roundA'])}): {', '.join(comparison['unique_to_roundA'])}")
            print(f"Unique to round B ({len(comparison['unique_to_roundB'])}): {', '.join(comparison['unique_to_roundB'])}")

        if args.copy_to:
            print(f"\nCopying rounds to destination user: {args.copy_to} ...")
            copied = []
            for rd in (round_a, round_b):
                try:
                    dest_id, created_new = copy_round_to_user(
                        rd,
                        src_user=args.user,
                        dest_user=args.copy_to,
                        preserve_id=args.preserve_ids,
                        preserve_created_at=args.preserve_created_at,
                        force_overwrite=args.force_overwrite,
                    )
                    copied.append((rd.id, dest_id, created_new))
                    status = 'created' if created_new else 'overwritten'
                    print(f"  Source {rd.id} -> Dest {dest_id} ({status})")
                except Exception as e:
                    print(f"  FAILED to copy {rd.id}: {e}", file=sys.stderr)
            # Summary
            success = [c for c in copied]
            if len(success) == 2:
                print("Copy complete: both rounds processed.")
            elif success:
                print(f"Copy partial: {len(success)}/2 rounds copied.")
            else:
                print("No rounds were copied (all failed).")
        return 0


if __name__ == '__main__':  # pragma: no cover
    raise SystemExit(main())
