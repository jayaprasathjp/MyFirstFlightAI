import { useEffect, useState } from "react";
import { api, store } from "../api";
import { useI18n } from "../i18n";
import Listen from "../components/Listen";
import { usePlaces } from "../places";

// A trip is over once its last date has passed (the return flight if there is one).
const tripEnd = (s) => s?.return_date || s?.arrival_date || s?.departure_date || "";
const today = () => new Date().toISOString().slice(0, 10);

export default function TripsScreen({ onSelect, onNew, onDeleted, busy, error, toast }) {
  const { t, fmtDate } = useI18n();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [asking, setAsking] = useState(null); // the trip waiting for "delete?" to be confirmed
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .getTrips()
      .then((res) => setTrips(res.trips || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const place = usePlaces(trips.flatMap((x) => [x.summary?.origin_city || x.summary?.origin_country, x.summary?.destination_city || x.summary?.destination_country]));
  const titleOf = (trip) => {
    const o = place(trip.summary?.origin_city || trip.summary?.origin_country);
    const d = place(trip.summary?.destination_city || trip.summary?.destination_country);
    return o && d ? `${o} → ${d}` : d || o || t("destination_tbd");
  };
  const statusOf = (trip) => (trip.status === "ready" ? t("ready_title") : trip.status === "fix" ? t("fix_title") : "");

  // finished by mistake: move it back to upcoming
  const reopen = async (trip) => {
    const mark = (completed_at) => setTrips((list) => list.map((x) => (x.id === trip.id ? { ...x, completed_at } : x)));
    mark(null); // moves back straight away; put back if the server says no
    try {
      await api.completeTrip(trip.id, false);
    } catch (e) {
      mark(trip.completed_at);
      setErr(e.message);
    }
  };

  const remove = async () => {
    const trip = asking;
    setDeleting(true);
    try {
      await api.deleteTrip(trip.id);
      setTrips((list) => list.filter((x) => x.id !== trip.id));
      if (store.get("mff-trip", "") === trip.id) store.del("mff-trip");
      if (store.get("mff-trip-cache", null)?.id === trip.id) store.del("mff-trip-cache");
      store.del(`mff-done-${trip.id}`);
      store.del(`mff-jstep-${trip.id}`);
      onDeleted?.(trip.id);
      setAsking(null);
    } catch (e) {
      setErr(e.message);
      setAsking(null);
    } finally {
      setDeleting(false);
    }
  };

  // upcoming first (soonest at the top), past trips below (most recent first); both stay openable
  const now = today();
  const isPast = (x) => !!x.completed_at || (tripEnd(x.summary) && tripEnd(x.summary) < now);
  const past = trips.filter(isPast).sort((a, b) => tripEnd(b.summary).localeCompare(tripEnd(a.summary)));
  const upcoming = trips.filter((x) => !past.includes(x)).sort((a, b) => (a.summary?.departure_date || "9").localeCompare(b.summary?.departure_date || "9"));

  const card = (trip, isPast) => {
    const n = trip.travellers?.length || 0;
    const date = trip.summary?.departure_date ? fmtDate(trip.summary.departure_date, { day: "numeric", month: "short", year: "numeric" }) : "";
    const status = statusOf(trip);
    const line = [date, n ? `${n} ${t("travellers_count")}` : t("no_travellers_added"), trip.completed_at ? `${t("trip_completed")} ✓` : !isPast && status].filter(Boolean).join(" • ");
    return (
      <div key={trip.id} className={"card tripcard" + (isPast ? " past" : "")}>
        <button type="button" className="tripopen" onClick={() => onSelect(trip)}>
          <b>{titleOf(trip)}</b>
          <small>{line}</small>
        </button>
        {trip.completed_at && (
          <button type="button" className="link tripreopen" onClick={() => reopen(trip)}>↺ {t("trip_reopen")}</button>
        )}
        <div className="tripacts">
          <Listen text={`${titleOf(trip)}. ${line}`} toast={toast} />
          <button type="button" className="tripdel" aria-label={`${t("trip_delete")}: ${titleOf(trip)}`} onClick={() => setAsking(trip)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const question = asking ? t("trip_delete_q", { trip: titleOf(asking) }) : "";

  return (
    <div className="screen" style={{ alignContent: "start" }}>
      <h2>{t("my_trips_title")}</h2>

      {(err || error) && (
        <div className="err" role="alert">
          {err || error}
        </div>
      )}

      {loading ? (
        <div className="reading" role="status">
          <span className="spin" aria-hidden="true"></span> {t("loading_trips")}
        </div>
      ) : trips.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "30px 14px" }}>
          <p style={{ color: "var(--muted)", marginBottom: "16px" }}>{t("no_trips_yet")}</p>
          <button className="btn pri" onClick={onNew} disabled={busy}>
            {t("start_new_trip")}
          </button>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="tripgroup">
              {past.length > 0 && <h3>{t("trips_upcoming")}</h3>}
              <div className="tripsgrid">{upcoming.map((x) => card(x, false))}</div>
            </section>
          )}
          {past.length > 0 && (
            <section className="tripgroup">
              <h3>{t("trips_past")}</h3>
              <div className="tripsgrid">{past.map((x) => card(x, true))}</div>
            </section>
          )}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
            <button className="btn pri" onClick={onNew} disabled={busy} style={{ minWidth: "200px" }}>
              {t("start_new_trip")}
            </button>
          </div>
        </>
      )}

      {asking && (
        <div className="modal-overlay" onClick={() => !deleting && setAsking(null)}>
          <div className="modal-content" role="alertdialog" aria-modal="true" aria-label={question} onClick={(e) => e.stopPropagation()}>
            <div className="gh">
              <h3 style={{ fontSize: "22px", textTransform: "none", letterSpacing: 0 }}>{question}</h3>
              <Listen text={`${question} ${t("trip_delete_body")}`} toast={toast} />
            </div>
            <p className="muted">{t("trip_delete_body")}</p>
            <button className="btn full tripdel-yes" onClick={remove} disabled={deleting}>
              {deleting ? <span className="spin" /> : t("trip_delete")}
            </button>
            <button className="btn sec full" onClick={() => setAsking(null)} disabled={deleting} autoFocus>
              {t("trip_keep")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
