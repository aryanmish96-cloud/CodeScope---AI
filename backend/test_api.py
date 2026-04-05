import os
from dotenv import load_dotenv
import anthropic

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

try:
    response = client.messages.create(
        model='claude-3-5-sonnet-20241022',
        max_tokens=2,
        messages=[{'role': 'user', 'content': 'hi'}]
    )
    print("Success")
except Exception as e:
    print("Error:", e)
