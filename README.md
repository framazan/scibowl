# atombowl

atombowl is a (work‑in‑progress) platform related to Science Bowl style content and tooling. The repository combines a JavaScript/TypeScript + HTML/CSS frontend (and Firebase hosting/rules) with supporting Python utilities for data acquisition, preprocessing, and experimentation (e.g. rate‑limit tests). It uses Firebase (Realtime Database, Firestore, Storage, and Cloud Functions) as the backend infrastructure. It's currently deployed at [sciencebowl.org](https://sciencebowl.org/).

> Language composition: 78.7% JavaScript, 12.5% Python, 4.8% HTML, 2.4% CSS, 1.6% TypeScript.

---

## Table of Contents
1. [Features & Goals](#features)
2. [Repository Structure](#Repository Structure)
3. Firebase Integration
4. Backend / Cloud Functions
5. Python Utilities
6. Development Setup
7. Common Workflows
8. Testing & Debugging
9. Security & Sensitive Configuration
10. Future Enhancements

---
<a name="features"/>
## Features & Goals

Planned / existing components:
- Question data acquisition and normalization (Python scripts in `data_aquisition`).
- Web frontend served via Firebase Hosting (`web/`).
- Cloud Functions for server-side logic (`functions/`).
- Realtime Database / Firestore for structured storage (rules in `database.rules.json` and `firestore.rules`).
- Storage bucket access governed by `storage.rules`.
- Experimentation scripts (e.g. `rate_limit_test.py` for API rate / throughput investigation).

---

## Repository Structure

Top-level items (observed from current tree):

```
.firebaserc                # Firebase project aliases/config
.gitattributes             # Git attributes (e.g., text/lf normalization)
.gitignore                 # Ignore patterns for Git
.vscode/                   # Editor settings (recommended workspace configuration)
config_sensitive/          # (Placeholder) likely holds secrets or non-committed configs
data_aquisition/           # Python scripts for ingesting / cleaning question data
database.rules.json        # Firebase Realtime Database security rules
firebase.json              # Firebase project configuration (hosting, functions, etc.)
firestore.rules            # Firestore security rules
functions/                 # Firebase Cloud Functions source (Node.js / TS)
package.json               # Node project manifest (dependencies & scripts)
package-lock.json          # Locked dependency graph for Node modules
rate_limit_test.py         # Python script for rate limit / performance testing
requirements.txt           # Python dependencies list
storage.rules              # Firebase Storage security rules
web/                       # Frontend assets (HTML/CSS/JS)
```

---

## 3. Firebase Integration

Key Firebase configuration / rule files:

- `.firebaserc`: Declares project ID(s) and aliases.
- `firebase.json`: Specifies configuration blocks for:
  - Hosting (public directory, rewrites, headers, etc.)
  - Functions deployment triggers/config
  - Emulators (if configured)
- `database.rules.json`: Security and validation logic for the Realtime Database.
- `firestore.rules`: Access control (read/write) for Firestore collections/documents.
- `storage.rules`: Governs Firebase Storage bucket access (uploads/downloads).

You should review and audit rule files before production deployment to ensure:
- Principle of least privilege.
- Proper validation of document shapes.
- Avoidance of broad `allow read, write: if true;` patterns.

---

## 4. Backend / Cloud Functions (`functions/`)

Although file contents were not retrieved in the earlier inspection, this directory typically contains:
- `package.json` (local to functions) describing Cloud Function dependencies.
- Source files in JavaScript or TypeScript (potentially with a `tsconfig.json`).
- Initialization of Firebase Admin SDK for privileged operations.
- HTTP callable functions or Firestore/Realtime DB triggers for:
  - Question ingestion / transformation
  - Stats aggregation
  - Scheduled maintenance tasks

Recommended conventions (if not already present):
- `functions/src/index.ts` or `index.js` as the deployment entry point.
- Separate modules for domain logic (e.g., `questions.ts`, `stats.ts`).
- Use environment variables or Firebase config instead of hard-coding secrets.

---

## 5. Python Utilities

Directories:
- `data_aquisition/`: Scripts for pulling raw question data (APIs, scraping, CSV/JSON ingestion), cleaning syntax, tagging categories, difficulty normalization, etc.
- `rate_limit_test.py`: Likely used to probe an external API or internal endpoint performance; adjust concurrency and request pacing.

Dependencies are listed in `requirements.txt`. (Exact package list was not retrieved; you can open the file to confirm.) Typical tasks:
- Run ETL/transforms locally.
- Export cleaned datasets for frontend consumption or seeding Firestore/Realtime Database.
- Benchmark endpoints (latency / throughput).

---

## 6. Development Setup

### Prerequisites
- Node.js (LTS recommended).
- Python 3.10+ (match whatever is assumed in the scripts).
- Firebase CLI installed globally: `npm install -g firebase-tools`.
- A configured Firebase project (matching `.firebaserc` project alias).

### Node / Functions / Frontend
```bash
# Install root-level dependencies
npm install

# (If functions has its own package.json, cd into functions and install)
cd functions
npm install
cd ..

# Login & initialize (if not already)
firebase login
firebase use <project-alias>

# Emulate locally
firebase emulators:start
```

### Python Environment
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Data Acquisition
Inside `data_aquisition/`:
```bash
python fetch_questions.py          # Example name (adjust to real script)
python normalize_questions.py      # Example pipeline step
```

---

## 7. Common Workflows

- Update security rules:
  - Edit `firestore.rules` / `database.rules.json` / `storage.rules`
  - Test via emulator: `firebase emulators:start --only firestore,database,storage`
  - Deploy: `firebase deploy --only firestore:rules,database,rules,storage`

- Deploy hosting + functions:
  ```bash
  firebase deploy --only hosting,functions
  ```

- Refresh datasets:
  - Run acquisition / cleaning Python scripts.
  - Export JSON and upload to Firestore via admin function or script.

---

## 8. Testing & Debugging

Recommended (if not yet present):
- Add unit tests for Cloud Functions (`jest` or `vitest`).
- Use Firebase emulators for local integration tests (auth, firestore, database, storage).
- For Python scripts, integrate `pytest` and possibly `ruff` or `flake8` for linting.

Performance:
- Use `rate_limit_test.py` to monitor throughput when scaling queries or ingestion.

---

## 9. Security & Sensitive Configuration

`config_sensitive/` suggests a place for secrets or non-committed config. Ensure:
- No plaintext API keys in version control.
- Use Firebase Functions environment config:
  ```bash
  firebase functions:config:set service.api_key="XXXXX"
  ```
  and access via `functions.config().service.api_key`.

Version control hygiene:
- Confirm `.gitignore` excludes local datasets, env files (`.env`), and large raw dumps.

---

## 10. Future Enhancements

Potential improvements:
- Add CI (GitHub Actions) for lint/test/deploy previews.
- Introduce TypeScript to all Cloud Functions (if partially JS now).
- Provide schema documentation for Firestore collections and Realtime Database paths.
- Add a questions ingestion pipeline README section with data provenance.
- Implement caching / indexing for fast querying of categories or difficulty levels.
- Accessibility & responsive improvements for `web/` UI.
- Add sample dataset and import script for onboarding contributors.

---

## Contributing

1. Fork & clone.
2. Create a feature branch.
3. Run emulators and verify changes locally.
4. Submit PR with description (include rule changes rationale if applicable).

---

## License

(Choose a license if not yet selected—MIT, Apache 2.0, etc.)

---

## Disclaimer

Some file contents (e.g., package.json scripts, requirements.txt dependencies, rule specifics) were not retrieved in the inspection snapshot. Update sections above with concrete details once reviewed.

---

## Quick Start Summary

```bash
# Clone
git clone https://github.com/framazan/scibowl.git
cd scibowl

# Install Node deps
npm install

# Python environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Firebase emulators
firebase login
firebase emulators:start

# (Modify / deploy functions & hosting)
firebase deploy --only functions,hosting
```
