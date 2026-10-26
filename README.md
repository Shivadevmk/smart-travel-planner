# Wayfarer — Smart Travel Planner

A local-first trip planner built with React, Flask, and SQLite. Enter your dates, destination, budget, and interests to get a suggested day-by-day itinerary, sample cost estimates, stay ideas, and external search links.

> **Planning tool only:** prices and itineraries are sample estimates, not live schedules, quotes, or availability. External links open search pages. The app does not make reservations or bookings.

## Features

- Responsive trip-planning form with worldwide custom destination entry.
- Built-in sample data for Paris, Tokyo, New York, Rome, Barcelona, Bali, London, Sydney, Cape Town, and Mexico City.
- Rule-based morning, afternoon, and evening itinerary suggestions, tailored to selected interests.
- Sample USD estimates for transport, accommodation, meals, and listed activities.
- Choose USD or INR for the trip budget and estimated costs. INR uses a clearly labelled fixed sample conversion, not a live exchange rate.
- Examople: Hyderabad–Goa includes illustrative train/bus/flight fare ranges, stay categories, and optional local rental estimates. These are not live schedules, prices, or availability.
- Map directions and external transport, hotel, and attraction search links.
- Save and revisit generated trip plans in a local SQLite database.
- Unknown destinations are accepted and clearly marked as using general sample estimates and suggestions.

## Requirements

- Python 3.9 or newer
- Node.js 18 or newer (npm included)

## Run on Windows

Open two PowerShell terminals in the project folder.

### 1. Start the Flask API

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

If PowerShell prevents virtual-environment activation, run `python -m pip install -r requirements.txt` using your Python installation and then `python app.py`.

The API runs at `http://127.0.0.1:5000`. The SQLite database is created automatically at `backend/travel_planner.db`.

### 2. Start the React frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

To use a different API address, create `frontend/.env.local` with:

```env
VITE_API_URL=http://127.0.0.1:5000/api
```

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check that the API is running |
| `GET` | `/api/destinations` | List built-in destination data |
| `POST` | `/api/plan` | Generate a plan from trip details |
| `POST` | `/api/trips` | Save a generated plan |
| `GET` | `/api/trips` | List saved plans |
| `GET` | `/api/trips/<id>` | Load a saved plan |

`POST /api/plan` expects JSON with `origin`, `destination`, `start_date`, `end_date`, `budget`, `travelers`, optional `transport_mode`, and optional `interests`.
The planner accepts trips up to 60 nights and between 1 and 20 travellers.

## Notes and next steps

- All sample amounts are in USD and can be edited in `backend/data.py`.
- Itineraries are suggestions and do not check opening hours, travel times, or current conditions.
- Saved trips are stored locally and are not synced or shared.
- Live flight, lodging, and attraction data would require adding supported providers and their API credentials in a future version.
