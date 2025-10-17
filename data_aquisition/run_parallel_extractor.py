
import os
import time
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

# List of (tournament, directory) pairs to process sequentially.
tournaments_and_dirs = [
    ('mosfet-2024','/Users/filipr/Desktop/scibowl/data_aquisition/database/extra')
]

# Command template updated for new ingest_scibowl interface (per-round schema, requires --tournament)
command_template = (
    'python3 /Users/filipr/Desktop/scibowl/data_aquisition/ingest_scibowl.py {path} '
    '--project-id scibowl-analytics --model gemini-2.5-pro '
    '--tournament {tournament} '
    '--prompt-file /Users/filipr/Desktop/scibowl/data_aquisition/prompts/extract_scibowl.tmpl'
)

SUPPORTED_EXTS = {'.pdf', '.docx'}

def run_command(path, tournament):
    command = command_template.format(path=path, tournament=tournament)
    start = time.time()
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    dur = time.time() - start
    return path, result.returncode, dur, result.stdout, result.stderr

def process_tournament_dir(tournament, directory, batch_size=20, inter_launch_delay=4, inter_batch_delay=10):
    print(f"\nProcessing tournament '{tournament}' in directory '{directory}'\n")
    try:
        entries = os.listdir(directory)
    except FileNotFoundError:
        print(f"[ERROR] Directory not found: {directory}")
        return
    paths = [
        os.path.join(directory, f) for f in entries
        if f != '.DS_Store' and os.path.splitext(f)[1].lower() in SUPPORTED_EXTS
    ]
    if not paths:
        print(f"[WARN] No supported files found in {directory}")
        return
    print(f"Found {len(paths)} candidate files (.pdf/.docx)")
    for i in range(0, len(paths), batch_size):
        batch = paths[i:i+batch_size]
        print(f"\n[Batch {i//batch_size + 1}] Launching {len(batch)} file(s)")
        with ThreadPoolExecutor(max_workers=batch_size) as executor:
            futures = []
            for idx, path in enumerate(batch):
                futures.append(executor.submit(run_command, path, tournament))
                if idx < len(batch) - 1 and inter_launch_delay:
                    time.sleep(inter_launch_delay)
            for future in as_completed(futures):
                path, code, dur, stdout, stderr = future.result()
                print(f"----- {path} (exit={code}, {dur:.1f}s) -----")
                if stdout.strip():
                    print(f"STDOUT:\n{stdout}")
                if stderr.strip():
                    print(f"STDERR:\n{stderr}")
        if i + batch_size < len(paths) and inter_batch_delay:
            print(f'Waiting {inter_batch_delay} seconds before next batch...')
            time.sleep(inter_batch_delay)

if __name__ == "__main__":
    for tournament, directory in tournaments_and_dirs:
        process_tournament_dir(tournament, directory)