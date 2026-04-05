import os
import json
from dotenv import load_dotenv

# Ensure env is loaded
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from ai_engine import explain_file

print("Testing explain_file...")
res = explain_file(
    path="test.py",
    content="def hello():\n    print('world')\n",
    eli5=False,
    tech_stack=["Python"]
)
print("Result:")
print(json.dumps(res, indent=2))
