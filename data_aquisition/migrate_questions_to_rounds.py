"""Migration: per-question docs -> per-round docs.

Usage examples:

  python migrate_questions_to_rounds.py \
	--project-id YOUR_PROJECT \
	--source-mode collections \
	--dry-run

  python migrate_questions_to_rounds.py \
	--project-id YOUR_PROJECT \
	--tournament-list bash-2024,aves-2024 \
	--export-dir backups/pre_migration \
	--force

  python migrate_questions_to_rounds.py \
	--project-id YOUR_PROJECT \
	--delete-old --confirm-delete-old yes

Schema written:
  tournaments/<tournamentId>/rounds/<roundId>
	{
	  tournament: str,
	  round: str,              # original round id token
	  questionCount: int,      # tossups + bonuses
	  tossups: [...],          # list of question objects (type == tossup)
	  bonuses: [...],          # list of question objects (type == bonus)
	  categoriesAgg: { CAT: count },
	  migratedAt: timestamp,
	  sourceCounts: { tossup: int, bonus: int }
	}

Idempotent: Will skip existing round docs unless --force.
Safety: Use --export-dir to dump original flat docs for rollback.
Deletion: Requires BOTH --delete-old and --confirm-delete-old yes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Iterable, Tuple

import firebase_admin
from firebase_admin import firestore as firestore_admin
from google.cloud.firestore import SERVER_TIMESTAMP


def eprint(*a, **k):
	print(*a, file=sys.stderr, **k)


@dataclass
class FlatQuestion:
	id: str
	data: dict

	@property
	def tournament(self):
		return self.data.get("tournament")

	@property
	def round(self):
		r = self.data.get("round")
		if r is None:
			return "unknown"
		return str(r).strip() or "unknown"

	@property
	def qtype(self):
		return (self.data.get("question_type") or "").lower()

	@property
	def number(self):
		# not all are strictly numeric; fallback ordering defined later
		return self.data.get("question_number")


def init_firestore(project_id: str):
	try:
		firebase_admin.get_app()
	except ValueError:
		cred = firebase_admin.credentials.ApplicationDefault()
		firebase_admin.initialize_app(cred, {"projectId": project_id})
	return firestore_admin.client()


def parse_args(argv=None):
	p = argparse.ArgumentParser(description="Migrate per-question Firestore docs into per-round documents.")
	p.add_argument("--project-id", required=True, help="GCP project id")
	p.add_argument("--source-mode", choices=["collections", "flat"], default="collections", help="How to read source questions. 'collections': one collection per tournament (names from meta/tournaments). 'flat': single collection named by --flat-collection.")
	p.add_argument("--flat-collection", default="questions", help="Collection name if --source-mode=flat")
	p.add_argument("--tournament-list", default=None, help="Comma separated explicit tournaments to migrate (override discovery)")
	p.add_argument("--export-dir", default=None, help="If set, export raw flat questions JSON per tournament here before writing.")
	p.add_argument("--dry-run", action="store_true", help="Plan only; no writes/deletes")
	p.add_argument("--force", action="store_true", help="Rewrite existing round docs even if present")
	p.add_argument("--delete-old", action="store_true", help="Delete old per-question docs after successful migration of each tournament")
	p.add_argument("--confirm-delete-old", default="no", help="Must be 'yes' to allow deletion when --delete-old is set")
	p.add_argument("--max-batch", type=int, default=450, help="Max ops per batch commit")
	p.add_argument("--sleep-between", type=float, default=0.0, help="Sleep seconds between batch commits (throttle)")
	p.add_argument("--round-subcollection", default="rounds", help="Name of rounds subcollection under tournaments/<id>")
	p.add_argument("--update-meta", action="store_true", help="Update meta/roundCounts doc with counts per tournament")
	return p.parse_args(argv)


def discover_tournaments(db, args) -> List[str]:
	if args.tournament_list:
		return [t.strip() for t in args.tournament_list.split(',') if t.strip()]
	if args.source_mode == "collections":
		meta = db.document("meta", "tournaments").get()
		if not meta.exists:
			raise RuntimeError("meta/tournaments document not found; cannot discover collections")
		data = meta.to_dict() or {}
		lst = data.get("list") or []
		return [c for c in lst if isinstance(c, str) and c.strip()]
	# flat mode: derive tournaments by scanning flat collection distinct values (costly; acceptable for migration) - warn user
	eprint("[INFO] Discovering tournaments by scanning flat collection; consider providing --tournament-list for speed.")
	flat_col = db.collection(args.flat_collection)
	tournaments = set()
	for doc in flat_col.stream():
		t = doc.to_dict().get("tournament")
		if t: tournaments.add(str(t))
	return sorted(tournaments)


def load_flat_questions_for_tournament(db, args, tournament: str) -> List[FlatQuestion]:
	out = []
	if args.source_mode == "collections":
		col_ref = db.collection(tournament)
		for snap in col_ref.stream():
			data = snap.to_dict() or {}
			# Normalize tournament field if missing
			if not data.get("tournament"):
				data["tournament"] = tournament
			out.append(FlatQuestion(id=snap.id, data=data))
	else:
		col_ref = db.collection(args.flat_collection)
		q = col_ref.where("tournament", "==", tournament)
		for snap in q.stream():
			data = snap.to_dict() or {}
			out.append(FlatQuestion(id=snap.id, data=data))
	return out


def export_questions(tournament: str, questions: List[FlatQuestion], export_dir: Path):
	export_dir.mkdir(parents=True, exist_ok=True)
	path = export_dir / f"{tournament}.json"
	with path.open("w", encoding="utf-8") as f:
		json.dump([q.data for q in questions], f, ensure_ascii=False, indent=2)
	eprint(f"[EXPORT] Wrote {len(questions)} flat questions to {path}")


def group_by_round(questions: List[FlatQuestion]):
	grouped: Dict[str, List[FlatQuestion]] = {}
	for q in questions:
		grouped.setdefault(q.round, []).append(q)
	return grouped


def build_round_doc(round_id: str, tournament: str, qs: List[FlatQuestion]):
	tossups = []
	bonuses = []
	for fq in qs:
		# Preserve original data but ensure minimal normalized fields
		d = dict(fq.data)
		d.setdefault("tournament", tournament)
		d.setdefault("round", round_id)
		# Preserve original Firestore document id so legacy references (saved user rounds, exclusions) still resolve.
		if "_origId" not in d and "origId" not in d:
			d["_origId"] = fq.id
		# category normalization (uppercase)
		cat = d.get("category")
		if isinstance(cat, str):
			d["category"] = cat.strip().upper()
		# Enforce question_type casing
		qtype = (d.get("question_type") or "").lower()
		if qtype == "tossup":
			tossups.append(d)
		elif qtype == "bonus":
			bonuses.append(d)
		else:
			# Unknown types ignored but logged.
			eprint(f"[WARN] Skipping doc {fq.id} with unknown question_type='{d.get('question_type')}'")
	# Sort by question_number if numeric
	def sort_key(d):
		num = d.get("question_number")
		try:
			return int(num)
		except Exception:
			return 10**9  # push non-numeric to end
	tossups.sort(key=sort_key)
	bonuses.sort(key=sort_key)
	categories_agg = {}
	for d in tossups + bonuses:
		c = d.get("category")
		if c:
			categories_agg[c] = categories_agg.get(c, 0) + 1
	return {
		"tournament": tournament,
		"round": round_id,
		"questionCount": len(tossups) + len(bonuses),
		"tossups": tossups,
		"bonuses": bonuses,
		"categoriesAgg": categories_agg,
		"sourceCounts": {"tossup": len(tossups), "bonus": len(bonuses)},
	"migratedAt": SERVER_TIMESTAMP,
	}


def write_round_docs(db, tournament: str, round_docs: Dict[str, dict], *, force: bool, dry_run: bool, subcollection: str, max_batch: int, sleep_between: float):
	base = db.collection("tournaments").document(tournament).collection(subcollection)
	# Pre-check existing
	existing = {}
	for snap in base.stream():
		existing[snap.id] = snap.to_dict() or {}
	to_write = []
	for rid, data in round_docs.items():
		if rid in existing and not force:
			# Skip if same count (basic idempotency check)
			prev = existing[rid]
			if prev.get("questionCount") == data.get("questionCount"):
				continue
		to_write.append((rid, data))
	if not to_write:
		eprint(f"[SKIP] Tournament {tournament}: nothing to write (all up-to-date)")
		return 0
	if dry_run:
		eprint(f"[DRY] Would write {len(to_write)} round docs for {tournament}")
		return len(to_write)
	batch = db.batch()
	ops = 0
	committed = 0
	def commit():
		nonlocal batch, ops, committed
		if ops == 0: return
		batch.commit()
		committed += ops
		batch = db.batch()
		ops = 0
		if sleep_between: time.sleep(sleep_between)
	for rid, data in to_write:
		ref = base.document(rid)
		batch.set(ref, data, merge=True)
		ops += 1
		if ops >= max_batch:
			commit()
	commit()
	eprint(f"[WRITE] Tournament {tournament}: wrote {committed} round docs")
	return committed


def delete_old_questions(db, args, tournament: str, questions: List[FlatQuestion]):
	if not args.delete_old:
		return 0
	if args.confirm_delete_old.lower() != "yes":
		eprint("[WARN] --delete-old specified but --confirm-delete-old yes not provided; skipping deletions.")
		return 0
	if args.dry_run:
		eprint(f"[DRY] Would delete {len(questions)} old question docs for {tournament}")
		return len(questions)
	batch = db.batch()
	ops = 0
	deleted = 0
	def commit():
		nonlocal batch, ops, deleted
		if ops == 0: return
		batch.commit()
		deleted += ops
		batch = db.batch()
		ops = 0
		if args.sleep_between: time.sleep(args.sleep_between)
	if args.source_mode == "collections":
		col = db.collection(tournament)
		for fq in questions:
			batch.delete(col.document(fq.id))
			ops += 1
			if ops >= args.max_batch:
				commit()
	else:
		col = db.collection(args.flat_collection)
		for fq in questions:
			batch.delete(col.document(fq.id))
			ops += 1
			if ops >= args.max_batch:
				commit()
	commit()
	eprint(f"[DELETE] Tournament {tournament}: deleted {deleted} old docs")
	return deleted


def update_meta_round_counts(db, all_counts: Dict[str, int], *, dry_run: bool):
	meta_ref = db.document("meta", "roundCounts")
	if dry_run:
		eprint(f"[DRY] Would update meta/roundCounts with {len(all_counts)} tournaments")
		return
	meta_ref.set({"counts": all_counts, "updatedAt": SERVER_TIMESTAMP}, merge=True)
	eprint(f"[META] Updated meta/roundCounts")


def migrate(args):
	db = init_firestore(args.project_id)
	tournaments = discover_tournaments(db, args)
	if not tournaments:
		eprint("No tournaments discovered; exiting")
		return 0
	eprint(f"[INFO] Migrating tournaments: {', '.join(tournaments)}")
	export_dir = Path(args.export_dir).expanduser().resolve() if args.export_dir else None
	total_round_docs = 0
	total_deleted = 0
	round_counts_meta = {}
	for t in tournaments:
		eprint(f"[TOURNAMENT] {t}")
		questions = load_flat_questions_for_tournament(db, args, t)
		eprint(f"  Loaded {len(questions)} question docs")
		if export_dir:
			export_questions(t, questions, export_dir)
		grouped = group_by_round(questions)
		round_docs = {}
		for round_id, qs in grouped.items():
			round_docs[round_id] = build_round_doc(round_id, t, qs)
		written = write_round_docs(
			db,
			tournament=t,
			round_docs=round_docs,
			force=args.force,
			dry_run=args.dry_run,
			subcollection=args.round_subcollection,
			max_batch=args.max_batch,
			sleep_between=args.sleep_between,
		)
		total_round_docs += written
		round_counts_meta[t] = len(round_docs)
		if args.delete_old:
			deleted = delete_old_questions(db, args, t, questions)
			total_deleted += deleted
	if args.update_meta:
		update_meta_round_counts(db, round_counts_meta, dry_run=args.dry_run)
	eprint("========== Summary ==========")
	eprint(f"Round docs written (or would write): {total_round_docs}")
	if args.delete_old:
		eprint(f"Old question docs deleted (or would delete): {total_deleted}")
	return 0


def main(argv=None):
	args = parse_args(argv)
	try:
		return migrate(args)
	except Exception as e:
		eprint(f"[ERROR] Migration failed: {e}")
		return 1


if __name__ == "__main__":
	sys.exit(main())

