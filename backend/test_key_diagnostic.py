import os
from dotenv import load_dotenv
from groq import Groq

# Load .env from the backend directory
load_dotenv(dotenv_path='c:\\Users\\aryan\\OneDrive\\Desktop\\UDBHAV\\backend\\.env')

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("❌ Error: GROQ_API_KEY not found in .env")
    exit(1)

print(f"Attempting to connect with key: {api_key[:10]}...{api_key[-4:]}")

try:
    client = Groq(api_key=api_key)
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": "Say hello!",
            }
        ],
        model="llama-3.3-70b-versatile",
    )
    print("✅ Success! Response from Groq:")
    print(chat_completion.choices[0].message.content)
except Exception as e:
    print(f"❌ Failed to connect to Groq API.")
    print(f"Error details: {str(e)}")
