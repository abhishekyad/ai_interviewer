
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from pydantic import BaseModel
import os
from supabase import create_client, Client
import tempfile
from dotenv import load_dotenv
import requests

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supa: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# Session memory
session_data = {
    "resume": "",
    "job_description": "",
    "chat_history": []
}

class ChatInput(BaseModel):
    question: str
    history: List[Dict[str, str]]

class FeedbackInput(BaseModel):
    history: List[Dict[str, str]]


def call_openrouter(messages):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    body = {"model": "openai/gpt-3.5-turbo",
        "messages": messages
    }
    res = requests.post("https://openrouter.ai/api/v1/chat/completions", json=body, headers=headers)
    print("Status code:", res.status_code)
    print("Raw response:", res.text)

    res.raise_for_status() 
    try:
        return res.json()['choices'][0]['message']['content']
    except Exception as e:
        print("❌ JSON decode error:", str(e))
        return "Failed to get a valid response from OpenRouter."


@app.post("/upload")
def upload_files(resume: UploadFile = File(...), job_description: UploadFile = File(...)):
    def read_file(file):
        contents = file.file.read().decode("utf-8") if file.content_type == "text/plain" else ""
        return contents

    session_data["resume"] = read_file(resume)
    session_data["job_description"] = read_file(job_description)
    session_data["chat_history"] = []
    return {"success": True}

@app.post("/start_interview")
def start_interview():
    prompt = f"""
    You're an AI interviewer. Start an interview for a candidate based on the resume below and job description. Ask one relevant technical or behavioral question.

    Resume:
    {session_data['resume']}

    Job Description:
    {session_data['job_description']}
    """
    messages = [{"role": "system", "content": prompt}]
    question = call_openrouter(messages)
    session_data['chat_history'].append({"role": "assistant", "content": question})
    return {"question": question}

@app.post("/interview")
def continue_interview(input: ChatInput):
    session_data['chat_history'] = input.history
    session_data['chat_history'].append({"role": "user", "content": input.question})

    messages = [
        {"role": "system", "content": "Continue the interview. Ask one follow-up question or new question."},
        *session_data['chat_history']
    ]
    reply = call_openrouter(messages)
    session_data['chat_history'].append({"role": "assistant", "content": reply})
    return {"reply": reply}

@app.post("/end_interview")
def end_interview(data: FeedbackInput):
    session_data['chat_history'] = data.history
    feedback_prompt = f"""
    Provide constructive feedback for the following interview based on the candidate's responses.

    Resume:
    {session_data['resume']}

    Job Description:
    {session_data['job_description']}

    Interview Transcript:
    {session_data['chat_history']}
    """
    messages = [{"role": "system", "content": feedback_prompt}]
    feedback = call_openrouter(messages)

    supa.table("interviews").insert({
        "transcript": str(session_data['chat_history']),
        "resume": session_data['resume'],
        "job_description": session_data['job_description'],
        "feedback": feedback
    }).execute()

    return {"feedback": feedback}
