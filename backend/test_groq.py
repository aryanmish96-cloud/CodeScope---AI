import requests
import json
import time

BASE = "http://127.0.0.1:8000"

# 1. Health check
print("=== Health Check ===")
r = requests.get(f"{BASE}/health")
print(f"Status: {r.status_code} | Body: {r.json()}")

# 2. Analyze a small repo
print("\n=== Analyze ===")
t0 = time.time()
r = requests.post(f"{BASE}/analyze", json={"repo_url": "https://github.com/expressjs/express"})
print(f"Status: {r.status_code} | Time: {time.time()-t0:.1f}s")
if r.status_code != 200:
    print("ERROR:", r.text)
    exit(1)
data = r.json()
sid = data["session_id"]
print(f"Session: {sid}")
print(f"Repo: {data['repo_name']} | Files: {data['stats']['file_count']} | Lines: {data['stats']['total_lines']}")

# 3. Summarize (AI call via Groq)
print("\n=== Summarize (Groq AI) ===")
t0 = time.time()
r = requests.post(f"{BASE}/summarize", json={"repo_url": "", "session_id": sid})
print(f"Status: {r.status_code} | Time: {time.time()-t0:.1f}s")
if r.status_code == 200:
    body = r.json()
    print(f"Elevator pitch: {body.get('elevator_pitch','N/A')}")
    print(f"Confidence: {body.get('confidence','N/A')} | Latency: {body.get('latency_ms','N/A')}ms")
else:
    print("ERROR:", r.text)

# 4. Chat (AI call via Groq)
print("\n=== Chat (Groq AI) ===")
t0 = time.time()
r = requests.post(f"{BASE}/chat", json={"session_id": sid, "question": "What is the main purpose of this project?", "history": []})
print(f"Status: {r.status_code} | Time: {time.time()-t0:.1f}s")
if r.status_code == 200:
    body = r.json()
    print(f"Answer: {body.get('answer','N/A')[:200]}")
else:
    print("ERROR:", r.text)

print("\n=== ALL TESTS PASSED ===")
