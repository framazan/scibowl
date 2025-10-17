# Science Bowl Ingestion

A Python script to parse Science Bowl questions from PDFs/DOCX using a Gemini/Gemma model and upload them to Firestore.

## Prerequisites
- Python 3.10+
- For Gemini via google-generativeai: set `GOOGLE_API_KEY` as an environment variable.
- Firestore access via Application Default Credentials:
  - `gcloud auth application-default login`, or
  - set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON with Firestore write access.
  
Optional (Vertex AI for Gemma or Gemini on Vertex):
- Enable Vertex AI in your GCP project.
- Grant permissions to your ADC/service account.

## Install
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Usage
```bash
# Using Gemini API directly (requires GOOGLE_API_KEY)
python ingest_scibowl.py <input_dir> \
  --project-id <GCP_PROJECT_ID> \
  --collection questions \
  --model gemini-1.5-flash \
  --save-json out.json \
  --dry-run
```
- Remove `--dry-run` to upload to Firestore.
- `--save-json` is optional, writes a local JSON of parsed questions.
- Supported inputs: `.pdf`, `.docx`.

### Vertex AI provider (for Gemma models like "gemma-***" or Gemini on Vertex)
```bash
# Requires ADC (e.g., gcloud auth application-default login) and Vertex AI enabled
python ingest_scibowl.py <input_dir> \
  --project-id <GCP_PROJECT_ID> \
  --collection questions \
  --provider vertex \
  --vertex-project <GCP_PROJECT_ID> \
  --vertex-location us-central1 \
  --model gemma-2-27b-it \
  --dry-run
```

## Notes
- If you specifically need Gemma (e.g., a future "gemma 3") on Vertex AI, swap the `ModelClient` to a Vertex variant and ensure your project has Vertex AI set up.
- Firestore doc IDs are derived from `<source_file>-<id>`; sanitized and truncated for safety.
