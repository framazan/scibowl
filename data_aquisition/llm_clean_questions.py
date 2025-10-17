import json
import ollama
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

INPUT_FILE = 'questions.json'
OUTPUT_FILE = 'questions_cleaned.json'
MODEL = 'llama2'  # You can change to 'mistral' or 'phi3' if desired
MAX_WORKERS = 5   # Adjust based on your system and Ollama's capacity

PROMPT = (
    "Clean up the following question for clarity. "
    "Add spaces between words, remove extraneous symbols (like newlines, slashes, etc.), and fix formatting, especially for math/physics questions. "
    "Do not change the meaning. Only return the cleaned question. You are not to add words or delete words. Leave the pronunciation guides intact.\n\n"
    "Question: {question}"
)

def clean_question(question):
    prompt = PROMPT.format(question=question)
    response = ollama.chat(model=MODEL, messages=[{'role': 'user', 'content': prompt}])
    return response['message']['content'].strip()

def process_question(i, q):
    try:
        if 'question' in q:
            q['question'] = clean_question(q['question'])
        q['flag'] = 'cleaned'  # Add label to each cleaned question
        return (i, q)
    except Exception as e:
        print(f"Error cleaning question {i+1}: {e}")
        return (i, q)

def print_progress(count, total, bar_len=40):
    filled_len = int(round(bar_len * count / float(total)))
    bar = '=' * filled_len + '-' * (bar_len - filled_len)
    print(f'\rProgress: [{bar}] {count}/{total}', end='', flush=True)

with open(INPUT_FILE, 'r') as f:
    questions = json.load(f)

# Remove questions with category 'biology'
questions = [q for q in questions if q.get('category', '').lower() != 'biology']
questions = [q for q in questions if q.get('category', '').lower() != 'earth and space']

# Use only the first 5 questions
questions = questions[:5]

results = [None] * len(questions)
completed = 0
total = len(questions)

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = [executor.submit(process_question, i, q) for i, q in enumerate(questions)]
    for future in as_completed(futures):
        i, cleaned_q = future.result()
        results[i] = cleaned_q
        completed += 1
        print_progress(completed, total)

print()  # Newline after progress bar

with open(OUTPUT_FILE, 'w') as f:
    json.dump(results, f, indent=2)

print(f"All questions cleaned. Output written to {OUTPUT_FILE}.")
