import requests
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

API_URL = "https://vertex-gateway-7e74h6s4.uc.gateway.dev/checkAnswerMC"
API_KEY = "AIzaSyBxfXewuANeaSgDisu5U4cD1JF70VJuP_U"
APPCHECK_TOKEN = "eyJraWQiOiJVTjJhMmciLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxOjU3OTQ1NDg4NTAxMjp3ZWI6MjAxNTEwNGQ4ZjVlM2E2YTMwMjg4MSIsImF1ZCI6WyJwcm9qZWN0cy81Nzk0NTQ4ODUwMTIiLCJwcm9qZWN0cy9zY2lib3dsLWFuYWx5dGljcyJdLCJwcm92aWRlciI6InJlY2FwdGNoYV92MyIsImlzcyI6Imh0dHBzOi8vZmlyZWJhc2VhcHBjaGVjay5nb29nbGVhcGlzLmNvbS81Nzk0NTQ4ODUwMTIiLCJleHAiOjE3NjEzNzQ3MDAsImlhdCI6MTc2MTI4ODMwMCwianRpIjoidk5wVlRhdVg5dllfVkdmLV9NdFhwXzBPR01seVhvcGQyLUdlMmliUURBMCJ9.BH9fIDMc-Su3vQerLw9JrtS95rAqS14T05iD6n8BPkGJpN_UIy5LsL1Ot5Siet53MVmrJQAYKdJbIqYrFlS5JKFebpOFScYxZOcGA9iXIm7uwtIgLvHM5YfkhxtRB3eDae9QbOhKpCgSeI_V3FYpwG_f_Y_2RCo6FRZzEqlchL8zXBxogio5Qi44vqOrOnJjHms5mPjYkSNby5rQrL1z6UYnSFawvh_aM-j_3_Y0rCVTUGM1VX-AIe56a7z4HY8yzuidC1ZBzcNjt6eGnPYXcTCg1Io1pzEJjcP4gBxg1cy-CsN92kS-G0AyqGD-t5F-LMcRPveCH4BFm9WL0GSn-TG3jj7Q3dSBo-srPG4ZJ4UGBinVAZC7MefQetnwGWphwpHDZtQ9qpLjk4tI8L9Pr1A4NLXrH_2YhkpXqS59to7izQL_eiCXxiCLvLuqr7Fp_WGg260J2vZtkcCuAprtXp0LkjL3RhGCKl4goV2SSwI4Ws9fGhwlwKfEY5Stp6va"  # Replace with a real or debug token

N_REQUESTS = 220  # Try more than 200 to trigger quota
MAX_WORKERS = 32  # Number of parallel threads

payload = {
    "userAnswer": "the planet Jupiter",
    "correctAnswer": "A",
    "question": "Which of the following is the largest planet in the solar system?",
    "choices": [
        ["W", "Jupiter"],
        ["X", "Saturn"],
        ["Y", "Earth"],
        ["Z", "Mars"]
    ]
}

headers = {
    "Content-Type": "application/json",
    "X-Firebase-AppCheck": APPCHECK_TOKEN
}

def send_request(i):
    try:
        resp = requests.post(f"{API_URL}?key={API_KEY}", json=payload, headers=headers, timeout=10)
        return (i, resp.status_code, resp.text.strip())
    except Exception as e:
        return (i, "ERR", str(e))

start = time.time()
with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = [executor.submit(send_request, i) for i in range(N_REQUESTS)]
    results = []
    for future in as_completed(futures):
        results.append(future.result())

results.sort()
success = sum(1 for _, code, _ in results if code == 200)
fail = N_REQUESTS - success

for i, code, text in results:
    print(f"{i+1:03d}: Status {code} | {text}")

print(f"\nTotal: {N_REQUESTS}, Success: {success}, Fail: {fail}")
print(f"Elapsed: {time.time() - start:.2f} seconds")