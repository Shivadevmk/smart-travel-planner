import json
import math
import os
import sqlite3
from contextlib import contextmanager
from datetime import date, timedelta
from urllib.parse import quote_plus

from flask import Flask, jsonify, request
from flask_cors import CORS

from data import DESTINATIONS, INTEREST_CATEGORIES

app = Flask(__name__)
CORS(app)

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "travel_planner.db")
TIME_SLOTS = ("morning", "afternoon", "evening")
USD_TO_INR_SAMPLE_RATE = 85
CURRENCY_RATES = {"USD": 1, "INR": USD_TO_INR_SAMPLE_RATE}
GENERIC_ATTRACTIONS = [
    {"name": "Explore the historic centre", "category": "culture", "cost": 0, "time": "morning"},
    {"name": "Visit a local museum or gallery", "category": "museum", "cost": 15, "time": "afternoon"},
    {"name": "Try a neighbourhood restaurant", "category": "food", "cost": 0, "time": "evening"},
    {"name": "Walk through a central park", "category": "outdoors", "cost": 0, "time": "morning"},
    {"name": "See a well-known city landmark", "category": "landmark", "cost": 10, "time": "afternoon"},
    {"name": "Find a local market or food street", "category": "food", "cost": 0, "time": "evening"},
]


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def database_connection():
    connection = get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database():
    with database_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS destinations (
                id TEXT PRIMARY KEY,
                city TEXT NOT NULL,
                country TEXT NOT NULL,
                data_json TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                destination TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                plan_json TEXT NOT NULL
            )
            """
        )
        connection.executemany(
            "INSERT OR REPLACE INTO destinations (id, city, country, data_json) VALUES (?, ?, ?, ?)",
            [
                (destination["id"], destination["city"], destination["country"], json.dumps(destination))
                for destination in DESTINATIONS
            ],
        )


def get_destinations():
    with database_connection() as connection:
        rows = connection.execute(
            "SELECT data_json FROM destinations ORDER BY city COLLATE NOCASE"
        ).fetchall()
    return [json.loads(row["data_json"]) for row in rows]


def build_plan(payload):
    required = ("origin", "destination", "start_date", "end_date", "budget", "travelers")
    missing = [field for field in required if payload.get(field) in (None, "")]
    if missing:
        raise ValueError("Please complete all required trip details.")

    origin = str(payload["origin"]).strip()
    destination_name = str(payload["destination"]).strip()
    if not origin or not destination_name:
        raise ValueError("Starting city and destination are required.")

    try:
        start_date = date.fromisoformat(str(payload["start_date"]))
        end_date = date.fromisoformat(str(payload["end_date"]))
        budget = float(payload["budget"])
        travelers = int(payload["travelers"])
    except (TypeError, ValueError):
        raise ValueError("Enter valid dates, a numeric budget, and a whole number of travellers.") from None

    if end_date <= start_date:
        raise ValueError("Return date must be after the departure date.")
    if budget <= 0 or not math.isfinite(budget):
        raise ValueError("Budget must be a positive amount.")
    if travelers < 1 or travelers > 20:
        raise ValueError("Travellers must be between 1 and 20.")

    currency = str(payload.get("currency", "USD")).upper()
    if currency not in CURRENCY_RATES:
        raise ValueError("Choose USD or INR as the trip currency.")
    exchange_rate = CURRENCY_RATES[currency]

    nights = (end_date - start_date).days
    if nights > 60:
        raise ValueError("Trips can be up to 60 nights in this planner.")

    known = next(
        (item for item in get_destinations() if item["city"].casefold() == destination_name.casefold()),
        None,
    )
    if known:
        city = known["city"]
        country = known["country"]
        source_currency = known.get("currency", "USD")
        attractions = known["attractions"]
        transport_per_person = known["transport_estimate_per_person"]
        hotel_per_night = known["hotel_estimate_per_night"]
        meal_per_person_day = known["meal_estimate_per_person_day"]
        data_coverage = "Destination data available"
    else:
        city = destination_name
        country = ""
        source_currency = "USD"
        attractions = GENERIC_ATTRACTIONS
        transport_per_person = 300
        hotel_per_night = 140
        meal_per_person_day = 45
        data_coverage = "General sample estimates; destination-specific data is not yet available"

    source_rate = CURRENCY_RATES[source_currency]
    conversion_factor = exchange_rate / source_rate
    transport_per_person *= conversion_factor
    hotel_per_night *= conversion_factor
    meal_per_person_day *= conversion_factor

    is_hyderabad_goa = (
        origin.casefold() in {"hyderabad", "hyderabad, india"} and city.casefold() == "goa"
    )
    has_route_transport_estimate = is_hyderabad_goa and known is not None
    if not has_route_transport_estimate:
        transport_per_person = None

    interests = payload.get("interests") or []
    if not isinstance(interests, list):
        raise ValueError("Interests must be provided as a list.")
    categories = set()
    for interest in interests:
        categories.update(INTEREST_CATEGORIES.get(str(interest).casefold(), set()))
    if categories:
        matching = [item for item in attractions if item["category"] in categories]
        if matching:
            attractions = matching + [item for item in attractions if item not in matching]

    itinerary = []
    for day_number in range(nights + 1):
        current_date = start_date + timedelta(days=day_number)
        day_activities = []
        for slot_index, slot in enumerate(TIME_SLOTS):
            attraction = attractions[(day_number * len(TIME_SLOTS) + slot_index) % len(attractions)]
            day_activities.append(
                {
                    "time": slot.title(),
                    "name": attraction["name"],
                    "category": attraction["category"],
                    "estimated_cost": round(attraction["cost"] * conversion_factor, 2),
                    "map_url": "https://www.google.com/maps/search/?api=1&query="
                    + quote_plus(f"{attraction['name']} {city}"),
                }
            )
        itinerary.append(
            {
                "date": current_date.isoformat(),
                "day": day_number + 1,
                "activities": day_activities,
            }
        )

    rooms = math.ceil(travelers / 2)
    transport_cost = (
        transport_per_person * travelers if transport_per_person is not None else None
    )
    stay_cost = hotel_per_night * nights * rooms
    meal_cost = meal_per_person_day * travelers * (nights + 1)
    activity_cost = sum(
        activity["estimated_cost"]
        for day in itinerary
        for activity in day["activities"]
    )
    search_destination = quote_plus(city)
    search_origin = quote_plus(origin)
    transport_mode = payload.get("transport_mode", "flight")
    transport_options = []
    hotel_options = []
    vehicle_options = []
    if is_hyderabad_goa and known:
        route_options = [
            {"mode": "train", "name": "Train", "minimum": 1200, "maximum": 3000, "unit": "return, per person"},
            {"mode": "bus", "name": "Bus", "minimum": 1800, "maximum": 4000, "unit": "return, per person"},
            {"mode": "flight", "name": "Flight", "minimum": 5000, "maximum": 12000, "unit": "return, per person"},
        ]
        transport_options = [
            {
                **option,
                "minimum": round(option["minimum"] * conversion_factor, 2),
                "maximum": round(option["maximum"] * conversion_factor, 2),
            }
            for option in route_options
        ]
        selected_option = next(
            (option for option in route_options if option["mode"] == transport_mode),
            None,
        )
        if selected_option:
            transport_cost = (
                (selected_option["minimum"] + selected_option["maximum"])
                / 2
                * conversion_factor
                * travelers
            )
        hotel_options = [
            {
                **option,
                "minimum": round(option["minimum"] * conversion_factor, 2),
                "maximum": round(option["maximum"] * conversion_factor, 2),
            }
            for option in known.get("hotel_options", [])
        ]
        vehicle_options = [
            {
                **option,
                "minimum_per_day": round(option["minimum_per_day"] * conversion_factor, 2),
                "maximum_per_day": round(option["maximum_per_day"] * conversion_factor, 2),
            }
            for option in known.get("vehicle_options", [])
        ]
    total_estimate = None
    remaining_budget = None
    if transport_cost is not None:
        total_estimate = transport_cost + stay_cost + meal_cost + activity_cost
        remaining_budget = budget - total_estimate
    if transport_mode == "car":
        transport_search = (
            "https://www.google.com/maps/dir/?api=1&origin="
            f"{search_origin}&destination={search_destination}&travelmode=driving"
        )
    elif transport_mode == "flight":
        transport_search = (
            f"https://www.google.com/travel/flights?q=flights+from+{search_origin}"
            f"+to+{search_destination}"
        )
    elif transport_mode in ("train", "bus"):
        transport_search = (
            f"https://www.google.com/search?q={transport_mode}+from+{search_origin}"
            f"+to+{search_destination}"
        )
    else:
        transport_search = (
            f"https://www.google.com/search?q=transport+from+{search_origin}"
            f"+to+{search_destination}"
        )

    return {
        "title": f"{city} getaway",
        "origin": origin,
        "destination": city,
        "country": country,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "nights": nights,
        "travelers": travelers,
        "budget": round(budget, 2),
        "interests": interests,
        "transport_mode": transport_mode,
        "data_coverage": data_coverage,
        "itinerary": itinerary,
        "costs": {
            "transport": round(transport_cost, 2) if transport_cost is not None else None,
            "accommodation": round(stay_cost, 2),
            "meals": round(meal_cost, 2),
            "activities": round(activity_cost, 2),
            "total": round(total_estimate, 2) if total_estimate is not None else None,
            "remaining": round(remaining_budget, 2) if remaining_budget is not None else None,
            "currency": currency,
        },
        "exchange_rate_note": (
            f"USD sample estimates use a fixed conversion of ₹{exchange_rate} per USD, not a live rate."
            if currency == "INR" and source_currency == "USD"
            else f"INR sample estimates use a fixed conversion of ₹{CURRENCY_RATES['INR']} per USD, not a live rate."
            if currency == "USD" and source_currency == "INR"
            else "Estimates are shown in their sample-data currency; no conversion was needed."
        ),
        "stay_suggestions": [
            {
                "name": f"Comfort stay in {city}",
                "style": "Mid-range",
                "estimate_per_night": round(hotel_per_night, 2),
                "map_url": f"https://www.google.com/maps/search/?api=1&query=hotels+in+{search_destination}",
            },
            {
                "name": f"Simple stay in {city}",
                "style": "Budget",
                "estimate_per_night": round(hotel_per_night * 0.7, 2),
                "map_url": f"https://www.google.com/maps/search/?api=1&query=budget+hotels+in+{search_destination}",
            },
            {
                "name": f"Special stay in {city}",
                "style": "Boutique",
                "estimate_per_night": round(hotel_per_night * 1.45, 2),
                "map_url": f"https://www.google.com/maps/search/?api=1&query=boutique+hotels+in+{search_destination}",
            },
        ],
        "transport_options": transport_options,
        "hotel_options": hotel_options,
        "vehicle_options": vehicle_options,
        "option_data_note": (
            "Illustrative sample ranges for Hyderabad to Goa only—not live fares, train schedules, hotel "
            "availability, or rental quotes."
            if is_hyderabad_goa
            else "No route-specific transport estimate is available. Flight, train, bus, hotel, and rental prices are not live-connected."
        ),
        "search_links": {
            "transport": transport_search,
            "stays": f"https://www.google.com/travel/search?q=hotels+in+{search_destination}",
            "attractions": f"https://www.google.com/search?q=things+to+do+in+{search_destination}",
        },
    }


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/destinations")
def destinations():
    return jsonify(get_destinations())


@app.post("/api/plan")
def generate_plan():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Send trip details as a JSON object."}), 400
    try:
        return jsonify(build_plan(payload))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.post("/api/trips")
def save_trip():
    plan = request.get_json(silent=True)
    if not isinstance(plan, dict) or not plan.get("destination") or not plan.get("itinerary"):
        return jsonify({"error": "Generate a trip plan before saving it."}), 400
    with database_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO trips (title, destination, start_date, end_date, plan_json) VALUES (?, ?, ?, ?, ?)",
            (
                plan.get("title", f"{plan['destination']} trip"),
                plan["destination"],
                plan.get("start_date", ""),
                plan.get("end_date", ""),
                json.dumps(plan),
            ),
        )
        trip_id = cursor.lastrowid
    return jsonify({"id": trip_id, "message": "Trip saved."}), 201


@app.get("/api/trips")
def saved_trips():
    with database_connection() as connection:
        rows = connection.execute(
            "SELECT id, title, destination, start_date, end_date, created_at FROM trips ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.get("/api/trips/<int:trip_id>")
def saved_trip(trip_id):
    with database_connection() as connection:
        row = connection.execute("SELECT plan_json FROM trips WHERE id = ?", (trip_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Saved trip not found."}), 404
    return jsonify(json.loads(row["plan_json"]))


initialize_database()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
