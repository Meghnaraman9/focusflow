Company name: CODTECH IT SOLUTIONS 
Name: Dakoju Meghana
Intern ID: CTIS8959
Domain: Full stack web development
Duration: 4 weeks
Mentor: Neels Santhosh Kumar
# FocusFlow – Chrome Extension for Time Tracking & Productivity Analytics

## 📁 Project Structure

```
time-tracker/
├── extension/            ← Chrome Extension (load this folder in Chrome)
│   ├── manifest.json
│   ├── background.js     ← Service worker (tracks tabs)
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.js
│   ├── dashboard/
│   │   ├── dashboard.html
│   │   └── dashboard.js
│   └── icons/            ← Add icon16.png, icon48.png, icon128.png here
│
└── backend/              ← FastAPI backend
    ├── main.py
    └── requirements.txt
```

---

## 🚀 Setup

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

API runs at: http://localhost:8000
Swagger docs: http://localhost:8000/docs

### 2. Chrome Extension

1. Open Chrome → go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Select the `extension/` folder
5. Pin FocusFlow from the extensions toolbar

### 3. Icons (Required)

Add PNG icons to `extension/icons/`:
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

You can use any icon or create a simple colored square PNG.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/sessions` | Save a single session |
| POST | `/api/sessions/bulk` | Bulk sync all sessions |
| GET | `/api/sessions?date=YYYY-MM-DD` | Get sessions |
| GET | `/api/analytics/today` | Today's stats |
| GET | `/api/analytics/weekly` | 7-day summary |
| GET | `/api/analytics/report` | Text report |
| DELETE | `/api/sessions` | Clear all data |
| POST | `/api/classify?domain=github.com` | Classify a domain |

---

## ✨ Features

- ✅ Tracks active tab time in real time
- ✅ Classifies sites: Productive / Unproductive / Neutral
- ✅ Popup with today's stats and top sites
- ✅ Full dashboard with hourly chart, donut chart, bar chart
- ✅ 7-day weekly view with trend line
- ✅ Session log with category badges
- ✅ Sync to FastAPI backend
- ✅ Customizable domain lists in Settings
- ✅ Weekly report notification

---

## 🛠 Tech Stack

- **Extension**: Manifest V3, Chrome Storage API, Service Worker
- **Frontend**: Vanilla HTML/CSS/JS + Chart.js
- **Backend**: Python, FastAPI, Uvicorn, Pydantic
- **Storage**: Local JSON file (sessions.json)
<img width="1920" height="1080" alt="Screenshot (660)" src="https://github.com/user-attachments/assets/fa342f45-f4cf-4ba5-a7d2-dbc2530b32ba" />
