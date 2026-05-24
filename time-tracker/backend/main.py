"""
FocusFlow – FastAPI Backend
Run with: uvicorn main:app --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import json
import os

app = FastAPI(title="FocusFlow API", version="1.0.0")

# Allow Chrome extension to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Data file (simple JSON storage) ──────────────────────────
DATA_FILE = "sessions.json"

def load_sessions() -> list:
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_sessions(sessions: list):
    with open(DATA_FILE, "w") as f:
        json.dump(sessions, f, indent=2)

# ── Models ────────────────────────────────────────────────────
class Session(BaseModel):
    url: str
    domain: str
    category: str  # productive | unproductive | neutral
    start: str
    end: str
    duration: int  # seconds

class BulkSessions(BaseModel):
    sessions: List[Session]

# ── Classification helpers ─────────────────────────────────────
PRODUCTIVE_DOMAINS = [
    "github.com", "stackoverflow.com", "leetcode.com", "codepen.io",
    "developer.mozilla.org", "docs.python.org", "medium.com", "notion.so",
    "figma.com", "trello.com", "coursera.org", "udemy.com", "edx.org",
    "kaggle.com", "huggingface.co", "arxiv.org", "claude.ai", "docs.google.com"
]
UNPRODUCTIVE_DOMAINS = [
    "facebook.com", "instagram.com", "twitter.com", "x.com",
    "tiktok.com", "snapchat.com", "reddit.com", "youtube.com",
    "netflix.com", "twitch.tv", "9gag.com", "buzzfeed.com",
    "pinterest.com", "discord.com"
]

def classify(domain: str) -> str:
    if any(d in domain for d in PRODUCTIVE_DOMAINS):
        return "productive"
    if any(d in domain for d in UNPRODUCTIVE_DOMAINS):
        return "unproductive"
    return "neutral"

# ── Routes ────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "FocusFlow API is running", "docs": "/docs"}


@app.post("/api/sessions")
def add_session(session: Session):
    """Add a single browsing session."""
    sessions = load_sessions()
    entry = session.dict()
    # Re-classify server-side just in case
    entry["category"] = classify(session.domain)
    sessions.append(entry)
    save_sessions(sessions)
    return {"status": "saved", "id": len(sessions) - 1}


@app.post("/api/sessions/bulk")
def bulk_sync(data: BulkSessions):
    """Replace all sessions with a bulk upload from the extension."""
    sessions = [s.dict() for s in data.sessions]
    for s in sessions:
        s["category"] = classify(s["domain"])
    save_sessions(sessions)
    return {"status": "synced", "count": len(sessions)}


@app.get("/api/sessions")
def get_sessions(date: Optional[str] = None):
    """Get all sessions, optionally filtered by date (YYYY-MM-DD)."""
    sessions = load_sessions()
    if date:
        sessions = [s for s in sessions if s["start"].startswith(date)]
    return {"sessions": sessions, "count": len(sessions)}


@app.get("/api/analytics/today")
def today_analytics():
    """Aggregated stats for today."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    sessions = [s for s in load_sessions() if s["start"].startswith(today)]

    total = sum(s["duration"] for s in sessions)
    by_category = {"productive": 0, "unproductive": 0, "neutral": 0}
    domain_map = {}

    for s in sessions:
        by_category[s["category"]] = by_category.get(s["category"], 0) + s["duration"]
        domain_map[s["domain"]] = domain_map.get(s["domain"], 0) + s["duration"]

    top_sites = sorted(domain_map.items(), key=lambda x: -x[1])[:10]
    productivity_pct = round((by_category["productive"] / total * 100) if total else 0, 1)

    return {
        "date": today,
        "total_seconds": total,
        "by_category": by_category,
        "productivity_percentage": productivity_pct,
        "top_sites": [{"domain": d, "seconds": s, "category": classify(d)} for d, s in top_sites],
        "unique_domains": len(domain_map)
    }


@app.get("/api/analytics/weekly")
def weekly_analytics():
    """Aggregated stats for the past 7 days."""
    sessions = load_sessions()
    result = []

    for i in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        day_sessions = [s for s in sessions if s["start"].startswith(day)]
        total = sum(s["duration"] for s in day_sessions)
        prod  = sum(s["duration"] for s in day_sessions if s["category"] == "productive")
        unprod = sum(s["duration"] for s in day_sessions if s["category"] == "unproductive")

        result.append({
            "date": day,
            "total_seconds": total,
            "productive_seconds": prod,
            "unproductive_seconds": unprod,
            "productivity_pct": round((prod / total * 100) if total else 0, 1)
        })

    return {"weekly": result}


@app.get("/api/analytics/report")
def weekly_report():
    """Formatted weekly productivity report text."""
    data = weekly_analytics()["weekly"]
    total_w = sum(d["total_seconds"] for d in data)
    prod_w  = sum(d["productive_seconds"] for d in data)

    lines = [
        "📊 FocusFlow Weekly Report",
        "=" * 30,
        f"Total browsing time : {total_w // 3600}h {(total_w % 3600) // 60}m",
        f"Productive time     : {prod_w // 3600}h {(prod_w % 3600) // 60}m",
        f"Productivity score  : {round(prod_w/total_w*100 if total_w else 0)}%",
        "",
        "Daily breakdown:"
    ]
    for d in data:
        mins = d["total_seconds"] // 60
        lines.append(f"  {d['date']}  {mins}m  ({d['productivity_pct']}% productive)")

    return {"report": "\n".join(lines)}


@app.delete("/api/sessions")
def clear_sessions():
    """Clear all stored sessions."""
    save_sessions([])
    return {"status": "cleared"}


@app.post("/api/classify")
def classify_domain(domain: str):
    """Classify a single domain."""
    return {"domain": domain, "category": classify(domain)}
