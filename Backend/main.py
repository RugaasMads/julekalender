from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pathlib import Path
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = Path("data.json")

def load_data():
    if not DATA_PATH.exists():
        raise HTTPException(status_code=500, detail="data.json mangler.")
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))

@app.get("/day/{day_number}")
def get_day(day_number: int):
    today = datetime.now().day
    if day_number > today:
        raise HTTPException(status_code=403, detail="For tidlig å åpne denne luken.")

    data = load_data()
    item = next((x for x in data if x["day"] == day_number), None)

    if not item:
        raise HTTPException(status_code=404, detail="Fant ikke innhold.")

    return item

@app.post("/day/{day_number}/answer")
async def submit_answer(day_number: int, request: Request):
    body = await request.json()
    chosen = body.get("answer")

    data = load_data()
    item = next((x for x in data if x["day"] == day_number), None)

    if not item or "correct_option" not in item:
        raise HTTPException(status_code=404, detail="Denne dagen har ikke flervalgsspørsmål.")

    correct = item["correct_option"]

    return {
        "correct": chosen == correct,
        "content": item["content"] if chosen == correct else None,
        "message": "Riktig!" if chosen == correct else "Feil svar."
    }