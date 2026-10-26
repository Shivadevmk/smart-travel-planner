import React, { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";
const INTERESTS = [
  { id: "culture", label: "Culture", icon: "✳" },
  { id: "food", label: "Food", icon: "⌁" },
  { id: "nature", label: "Nature", icon: "♧" },
  { id: "museums", label: "Museums", icon: "▧" },
  { id: "sightseeing", label: "Sightseeing", icon: "⌖" },
];
const today = new Date();
const dateString = (date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};
const startDefault = new Date(today);
startDefault.setDate(today.getDate() + 14);
const endDefault = new Date(startDefault);
endDefault.setDate(startDefault.getDate() + 4);

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error("Couldn't reach the planner API. Make sure the Flask server is running on port 5000.");
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}

function money(value, currency = "USD") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function App() {
  const [savedTrips, setSavedTrips] = useState([]);
  const [destination, setDestination] = useState("");
  const [form, setForm] = useState({
    origin: "",
    start_date: dateString(startDefault),
    end_date: dateString(endDefault),
    budget: "2500",
    currency: "USD",
    travelers: "2",
    transport_mode: "flight",
    interests: ["culture", "food"],
  });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api("/trips")
      .then((tripData) => setSavedTrips(tripData))
      .catch((requestError) => setError(requestError.message));
  }, []);

  const tripDays = useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    return Math.max(0, Math.round((new Date(`${form.end_date}T00:00:00`) - new Date(`${form.start_date}T00:00:00`)) / 86400000));
  }, [form.start_date, form.end_date]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleInterest(interest) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  }

  async function generatePlan(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPlan(null);
    setLoading(true);
    try {
      const generated = await api("/plan", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          destination,
          budget: Number(form.budget),
          travelers: Number(form.travelers),
        }),
      });
      setPlan(generated);
      setNotice("Your sample itinerary is ready.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function savePlan() {
    if (!plan) return;
    setSaving(true);
    setError("");
    try {
      await api("/trips", { method: "POST", body: JSON.stringify(plan) });
      const trips = await api("/trips");
      setSavedTrips(trips);
      setNotice("Trip saved to this device.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadTrip(id) {
    setError("");
    setNotice("");
    try {
      setPlan(await api(`/trips/${id}`));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const transportLink = plan?.search_links.transport;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Wayfarer home">
          <span className="brand-mark">w</span>
          <span>wayfarer<span className="brand-period">.</span></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a className="active" href="#planner">Plan a trip</a>
          <a href="#itinerary">Your itinerary</a>
        </nav>
        <a className="saved-nav" href="#saved-trips"><span>♡</span> Saved trips</a>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> THE ART OF GETTING AWAY</div>
            <h1>Somewhere<br /><em>good</em> is calling.</h1>
            <p>A little inspiration, a thoughtful plan, and the world is yours. Let’s make your next trip feel like you.</p>
            <a className="hero-link" href="#planner">Start planning <span>↓</span></a>
          </div>
          <div className="hero-art" aria-label="Illustration of a sunny coastal destination">
            <div className="sun" />
            <div className="art-label"><span>01 / 09</span><strong>Find your somewhere</strong></div>
            <div className="landscape hill-back" />
            <div className="landscape hill-front" />
            <div className="art-coast" />
            <div className="art-caption">A WORLD OF POSSIBILITIES</div>
          </div>
          <div className="hero-index">01 — PLAN WITH INTENTION</div>
        </section>

        {error && <div className="message message-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
        {notice && <div className="message message-success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

        <section className="planner-section" id="planner">
          <div className="section-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT CHAPTER</div><h2>Plan a trip</h2></div>
            <p>Start with the details. We’ll take it from there.</p>
          </div>
          <div className="planner-layout">
            <form className="planner-form" onSubmit={generatePlan}>
              <div className="form-row">
                <label className="field">
                  <span className="field-label">FROM</span>
                  <span className="input-wrap"><span className="field-icon">⌖</span><input name="origin" value={form.origin} onChange={updateForm} placeholder="Your starting city" required /></span>
                </label>
                <label className="field">
                  <span className="field-label">TO</span>
                  <span className="input-wrap"><span className="field-icon">✧</span><input name="destination" value={destination} onChange={(event) => { setDestination(event.target.value); setPlan(null); }} placeholder="Enter any city or destination" required /></span>
                </label>
              </div>

              <div className="form-row dates-row">
                <label className="field">
                  <span className="field-label">DEPARTURE</span>
                  <span className="input-wrap"><span className="field-icon">▦</span><input type="date" name="start_date" value={form.start_date} onChange={updateForm} required /></span>
                </label>
                <label className="field">
                  <span className="field-label">RETURN</span>
                  <span className="input-wrap"><span className="field-icon">▦</span><input type="date" name="end_date" value={form.end_date} onChange={updateForm} min={form.start_date} required /></span>
                </label>
              </div>
              <div className="form-row">
                <label className="field">
                  <span className="field-label">TOTAL BUDGET <small>{form.currency}</small></span>
                  <span className="input-wrap">
                    <span className="field-icon">{form.currency === "INR" ? "₹" : "$"}</span>
                    <input type="number" name="budget" min={form.currency === "INR" ? "1" : "0.01"} step={form.currency === "INR" ? "1" : "0.01"} value={form.budget} onChange={updateForm} required />
                    <select className="currency-select" name="currency" aria-label="Budget currency" value={form.currency} onChange={updateForm}>
                      <option value="USD">USD $</option>
                      <option value="INR">INR ₹</option>
                    </select>
                  </span>
                </label>
                <label className="field">
                  <span className="field-label">TRAVELLERS</span>
                  <span className="input-wrap"><span className="field-icon">♙</span><input type="number" name="travelers" min="1" max="20" value={form.travelers} onChange={updateForm} required /></span>
                </label>
              </div>
              <label className="field transport-field">
                <span className="field-label">HOW WOULD YOU LIKE TO GET THERE?</span>
                <span className="input-wrap"><span className="field-icon">↗</span>
                  <select name="transport_mode" value={form.transport_mode} onChange={updateForm}>
                    <option value="flight">By flight</option><option value="train">By train</option><option value="car">By car</option><option value="bus">By bus</option><option value="any">Open to anything</option>
                  </select>
                </span>
              </label>
              <fieldset className="interest-field">
                <legend>WHAT ARE YOU IN THE MOOD FOR?</legend>
                <div className="interest-options">
                  {INTERESTS.map((interest) => (
                    <button className={`interest-chip ${form.interests.includes(interest.id) ? "selected" : ""}`} type="button" key={interest.id} aria-pressed={form.interests.includes(interest.id)} onClick={() => toggleInterest(interest.id)}>
                      <span>{interest.icon}</span>{interest.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button className="primary-button" type="submit" disabled={loading || !destination}>
                {loading ? "Putting it together..." : "Create my trip"} <span>↗</span>
              </button>
              <p className="form-note">Your plan is a starting point. Sample prices aren’t live quotes.</p>
            </form>
            <aside className="planner-aside">
              <div className="aside-top"><span className="aside-number">01</span><span>THE GOOD PART</span></div>
              <h3>It’s not just<br />where you go.<br /><em>It’s how it feels.</em></h3>
              <div className="aside-rule" />
              <div className="aside-facts">
                <div><span>✳</span><p><strong>A day shaped around you</strong><small>Ideas for morning, afternoon & evening</small></p></div>
                <div><span>⌁</span><p><strong>Know before you go</strong><small>One clear budget, no surprises</small></p></div>
                <div><span>♡</span><p><strong>Keep the good ideas</strong><small>Save your plan on this device</small></p></div>
              </div>
              <div className="aside-bottom">MADE FOR THE WAY YOU WANDER</div>
            </aside>
          </div>
        </section>

        {plan && (
          <div id="itinerary" className="results-section">
            <section className="trip-overview">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> YOUR TRIP, AT A GLANCE</div>
                <h2>{plan.destination}<span>{plan.country ? `, ${plan.country}` : ""}</span></h2>
                <p>{plan.origin} <span>→</span> {plan.destination} <b>·</b> {formatDate(plan.start_date)} — {formatDate(plan.end_date)}</p>
              </div>
              <div className="overview-actions">
                <button className="outline-button" onClick={savePlan} disabled={saving}>{saving ? "Saving..." : "♡ Save trip"}</button>
                <a className="dark-button" href={transportLink} target="_blank" rel="noreferrer">Search {plan.transport_mode === "any" ? "transport" : plan.transport_mode} ↗</a>
              </div>
            </section>
            <div className="estimate-notice"><span>ⓘ</span><div><strong>Planning estimates, not live quotes</strong><p>{plan.data_coverage}. {plan.exchange_rate_note} Fares, stays, opening hours and availability can change. No booking has been made.</p></div></div>
            <section className="trip-stats">
              <div><span>TRIP LENGTH</span><strong>{plan.nights} <small>nights</small></strong></div>
              <div><span>TRAVELLERS</span><strong>{plan.travelers} <small>{plan.travelers === 1 ? "person" : "people"}</small></strong></div>
              <div><span>{plan.costs.total === null ? "ESTIMATED TOTAL · INCOMPLETE" : "ESTIMATED TOTAL"}</span><strong>{plan.costs.total === null ? "Unavailable" : money(plan.costs.total, plan.costs.currency)}</strong></div>
              <div><span>YOUR BUDGET</span><strong>{money(plan.budget, plan.costs.currency)}</strong></div>
            </section>
            <div className="results-grid">
              <section className="itinerary-panel">
                <div className="panel-heading"><div><div className="eyebrow">THE DAYS AHEAD</div><h3>Your itinerary</h3></div><span className="sample-tag">SUGGESTED</span></div>
                <div className="day-list">
                  {plan.itinerary.map((day) => (
                    <article className="day-card" key={day.date}>
                      <div className="day-heading"><span>DAY {String(day.day).padStart(2, "0")}</span><strong>{formatDate(day.date)}</strong></div>
                      <div className="activity-list">
                        {day.activities.map((activity) => (
                          <div className="activity-row" key={`${day.date}-${activity.time}`}>
                            <span className="activity-time">{activity.time}</span><span className={`activity-dot ${activity.category}`} />
                            <div className="activity-detail"><strong>{activity.name}</strong><span>{activity.category}{activity.estimated_cost ? ` · est. ${money(activity.estimated_cost, plan.costs.currency)}/person` : ""}</span></div>
                            <a className="map-link" href={activity.map_url} target="_blank" rel="noreferrer" aria-label={`Map directions for ${activity.name}`}>↗</a>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <aside className="cost-panel">
                <div className="panel-heading"><div><div className="eyebrow">A HELPFUL HEADS-UP</div><h3>Budget overview</h3></div></div>
                <div className="cost-total"><span>{plan.costs.total === null ? "INCOMPLETE ESTIMATE" : "ESTIMATED TOTAL"}</span><strong>{plan.costs.total === null ? "Unavailable" : money(plan.costs.total, plan.costs.currency)}</strong><small>for {plan.travelers} {plan.travelers === 1 ? "traveller" : "travellers"}</small></div>
                {plan.costs.total !== null ? (
                  <>
                    <div className="budget-meter"><div style={{ width: `${Math.min(100, Math.max(0, (plan.costs.total / plan.budget) * 100))}%` }} /></div>
                    <div className="budget-caption"><span>Trip estimate</span><span>{Math.round((plan.costs.total / plan.budget) * 100)}% of budget</span></div>
                  </>
                ) : (
                  <div className="option-note">Total is incomplete until live transport pricing is connected.</div>
                )}
                <div className="cost-breakdown">
                  {plan.costs.transport !== null
                    ? <CostRow label="Transport" value={plan.costs.transport} currency={plan.costs.currency} note="round trip, sample estimate—not a live fare" />
                    : <div className="cost-row"><span className="cost-dot" /><div><strong>Transport</strong><small>No route-specific fare available</small></div><b>Unavailable</b></div>}
                  <CostRow label="Accommodation" value={plan.costs.accommodation} currency={plan.costs.currency} note="shared rooms, sample rate" />
                  <CostRow label="Meals" value={plan.costs.meals} currency={plan.costs.currency} note="daily estimate" />
                  <CostRow label="Activities" value={plan.costs.activities} currency={plan.costs.currency} note="listed admission estimates" />
                </div>
                {plan.costs.remaining !== null && (
                  <div className={`budget-remaining ${plan.costs.remaining < 0 ? "over-budget" : ""}`}><span>{plan.costs.remaining < 0 ? "Over budget by" : "Left in your budget"}</span><strong>{money(Math.abs(plan.costs.remaining), plan.costs.currency)}</strong></div>
                )}
                {plan.transport_options.length > 0 && (
                  <div className="sample-options">
                    <div className="stays-heading"><div className="eyebrow">SAMPLE RETURN FARES · PER PERSON</div><h3>Ways to get there</h3></div>
                    {plan.transport_options.map((option) => (
                      <div className={`sample-option ${plan.transport_mode === option.mode ? "chosen" : ""}`} key={option.mode}>
                        <span><strong>{option.name}{plan.transport_mode === option.mode ? " · in estimate" : ""}</strong><small>{option.unit}</small></span>
                        <b>{money(option.minimum, plan.costs.currency)}–{money(option.maximum, plan.costs.currency)}</b>
                      </div>
                    ))}
                    <p className="option-note">{plan.option_data_note} Train names, times and seats are not checked.</p>
                  </div>
                )}
                {plan.hotel_options.length > 0 ? (
                  <>
                    <div className="stays-heading"><div className="eyebrow">SAMPLE PRICE RANGES · PER ROOM / NIGHT</div><h3>Stay ideas</h3></div>
                    <div className="sample-options">
                    {plan.hotel_options.map((stay) => (
                      <a className="sample-option sample-option-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stay.name} in ${plan.destination}`)}`} target="_blank" rel="noreferrer" key={stay.style}>
                        <span><strong>{stay.name}</strong><small>{stay.style} · per room / night · search map ↗</small></span>
                        <b>{money(stay.minimum, plan.costs.currency)}–{money(stay.maximum, plan.costs.currency)}</b>
                      </a>
                    ))}
                    <p className="option-note">{plan.option_data_note} These are stay categories, not named properties or live prices.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="stays-heading"><div className="eyebrow">PLACES TO START LOOKING</div><h3>Stay ideas</h3></div>
                    <div className="stay-list">
                      {plan.stay_suggestions.map((stay) => <a className="stay-card" href={stay.map_url} target="_blank" rel="noreferrer" key={stay.style}><span className="stay-icon">⌂</span><span className="stay-info"><strong>{stay.name}</strong><small>{stay.style} · sample per night</small></span><b>{money(stay.estimate_per_night, plan.costs.currency)}<small>/night</small></b></a>)}
                    </div>
                  </>
                )}
                {plan.vehicle_options.length > 0 && (
                  <div className="sample-options vehicle-options">
                    <div className="stays-heading"><div className="eyebrow">OPTIONAL · NOT INCLUDED IN TOTAL</div><h3>Local rentals</h3></div>
                    {plan.vehicle_options.map((vehicle) => (
                      <div className="sample-option" key={vehicle.name}>
                        <span><strong>{vehicle.name}</strong><small>sample price per day</small></span>
                        <b>{money(vehicle.minimum_per_day, plan.costs.currency)}–{money(vehicle.maximum_per_day, plan.costs.currency)}</b>
                      </div>
                    ))}
                    <p className="option-note">Rental prices, deposits, licence rules and availability are not checked live.</p>
                  </div>
                )}
                <div className="more-links">
                  <a href={plan.search_links.stays} target="_blank" rel="noreferrer">Search stays ↗</a>
                  <a href={plan.search_links.attractions} target="_blank" rel="noreferrer">More things to do ↗</a>
                </div>
                <p className="disclaimer">Sample estimates only. Rates and availability are not checked live. Links open external search pages; nothing is booked.</p>
              </aside>
            </div>
          </div>
        )}

        <section className="saved-section" id="saved-trips">
          <div className="section-heading saved-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> A LITTLE PLACE FOR LATER</div><h2>Your saved trips</h2></div>
            <p>Good ideas are worth keeping.</p>
          </div>
          {savedTrips.length === 0 ? (
            <div className="empty-saved"><span>♡</span><p>No saved trips just yet.<br /><strong>Make a plan you love, then save it here.</strong></p></div>
          ) : (
            <div className="saved-grid">
              {savedTrips.map((trip) => <button className="saved-card" key={trip.id} onClick={() => loadTrip(trip.id)}><span className="saved-card-icon">↗</span><span className="saved-card-title">{trip.title}</span><span className="saved-card-date">{formatDate(trip.start_date)} — {formatDate(trip.end_date)}</span><span className="saved-card-open">OPEN TRIP ↗</span></button>)}
            </div>
          )}
        </section>
      </main>
      <footer className="footer"><a className="brand" href="#"><span className="brand-mark">w</span><span>wayfarer<span className="brand-period">.</span></span></a><p>Take the scenic route.</p><span>THOUGHTFULLY PLANNED, NEVER BOOKED</span></footer>
    </div>
  );
}

function CostRow({ label, value, currency, note }) {
  return <div className="cost-row"><span className="cost-dot" /><div><strong>{label}</strong><small>{note}</small></div><b>{money(value, currency)}</b></div>;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default App;
