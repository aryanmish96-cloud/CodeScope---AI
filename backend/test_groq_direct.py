import os
import json
import traceback
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from ai_engine import _get_client, MODEL_NAME

client = _get_client()

with open("groq_error.txt", "w") as f:
    try:
        print("Testing basic generation...")
        res = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": "Hello"}],
        )
        f.write("Basic generation success.\n")
        
        print("Testing large prompt...")
        large_prompt = "a " * 10000 # 10000 words
        res = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": large_prompt}],
        )
        f.write("Large prompt success.\n")
    except Exception as e:
        traceback.print_exc(file=f)
        f.write(f"\nError: {str(e)}")
