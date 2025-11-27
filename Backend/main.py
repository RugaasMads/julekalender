from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import json


app = FastAPI()

@app.get("/")
def root():
    return {"status": "ok", "message": "Julekalender API kjører 🎄"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = Path("data.json")

def get_oslo_datetime():
    return datetime.now(ZoneInfo("Europe/Oslo"))

def load_data():
    if not DATA_PATH.exists():
        raise HTTPException(status_code=500, detail="data.json mangler.")
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))

@app.get("/day/{day_number}")
def get_day(day_number: int):
    now = get_oslo_datetime()

    # 📌 Sjekk: Vi er ikke i desember → stopp
    if now.month != 11:
        raise HTTPException(
            status_code=403,
            detail="Kalenderen er kun aktiv i desember."
        )

    # 📌 Sjekk: Ikke åpne dager etter dagens dato
    if day_number > now.day:
        raise HTTPException(
            status_code=403,
            detail="For tidlig å åpne denne luken."
        )

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