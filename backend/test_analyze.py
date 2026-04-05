import requests
import json
import time

t0 = time.time()
res = requests.post(
    "http://127.0.0.1:8000/api/analyze",
    json={"repo_url": "https://github.com/pallets/flask"},
)
print("Status:", res.status_code)
# print("Response:", res.json())
print("Time:", time.time() - t0, "seconds")
