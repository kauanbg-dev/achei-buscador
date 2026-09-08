import { useEffect, useMemo, useRef, useState } from "react";
import { fetchHolidays } from "./api/brasil.js";
import {
  WEEKDAYS,
  buildMonthCells,
  dayKind,
  eventsByDate,
  formatEventDay,
  monthTitle,
  shiftMonth,
  threeMonthRange,
  toISODate,
  upcomingEvents,
} from "./api/calendar.js";

function Status({ children, tone = "info" }) {
  return <p className={`status status-${tone}`}>{children}</p>;
}

export default function HolidayCalendar() {
  const today = toISODate(new Date());
  const initial = new Date();
  const range = useMemo(() => threeMonthRange(initial), []);
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [cache, setCache] = useState({});
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [selected, setSelected] = useState(today);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const neededKey = [...new Set([cursor.year, ...range.years])].sort().join(",");

  useEffect(() => {
    const years = neededKey.split(",").map(Number);
    const missing = years.filter((year) => !cacheRef.current[year]);
    if (!missing.length) {
      setStatus({ loading: false, error: "" });
      return;
    }

    let alive = true;
    setStatus({ loading: true, error: "" });
    Promise.all(missing.map((year) => fetchHolidays(year).then((data) => [year, data])))
      .then((entries) => {
        if (!alive) return;
        setCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        setStatus({ loading: false, error: "" });
      })
      .catch(() => {
        if (alive) setStatus({ loading: false, error: "Não foi possível carregar os feriados." });
      });

    return () => {
      alive = false;
    };
  }, [neededKey]);

  const holidays = cache[cursor.year] ?? [];
  const events = useMemo(() => eventsByDate(holidays, cursor.year), [holidays, cursor.year]);
  const cells = useMemo(() => buildMonthCells(cursor.year, cursor.month), [cursor]);
  const selectedEvents = events.get(selected) ?? [];
  const upcoming = useMemo(
    () => upcomingEvents(cache, range.start, range.end),
    [cache, range.end, range.start]
  );

  function go(delta) {
    const next = shiftMonth(cursor.year, cursor.month, delta);
    setCursor(next);
    const stillVisible = selected.startsWith(
      `${next.year}-${String(next.month + 1).padStart(2, "0")}`
    );
    if (!stillVisible) {
      const nextToday = today.startsWith(`${next.year}-${String(next.month + 1).padStart(2, "0")}`);
      setSelected(nextToday ? today : `${next.year}-${String(next.month + 1).padStart(2, "0")}-01`);
    }
  }

  function jumpTo(iso) {
    setSelected(iso);
    setCursor({
      year: Number(iso.slice(0, 4)),
      month: Number(iso.slice(5, 7)) - 1,
    });
  }

  return (
    <article className="card">
      <p className="kicker">Feriados</p>
      <h2>Próximos 3 meses</h2>
      {status.loading && <Status>Carregando feriados…</Status>}
      {status.error && <Status tone="error">{status.error}</Status>}
      {!status.loading && !status.error && upcoming.length === 0 && (
        <Status>Nenhum feriado ou data especial neste período.</Status>
      )}
      {upcoming.length > 0 && (
        <ul className="list upcoming">
          {upcoming.map((item) => (
            <li key={`${item.date}-${item.kind}-${item.name}`}>
              <button className={`upcoming-item is-${item.kind}`} type="button" onClick={() => jumpTo(item.date)}>
                <strong>{formatEventDay(item.date)}</strong>
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="cal-block">
        <div className="cal-head">
          <button className="cal-nav" type="button" aria-label="Mês anterior" onClick={() => go(-1)}>
            ‹
          </button>
          <h2>{monthTitle(cursor.year, cursor.month)}</h2>
          <button className="cal-nav" type="button" aria-label="Próximo mês" onClick={() => go(1)}>
            ›
          </button>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((label, index) => (
            <span className="cal-dow" key={`${label}-${index}`}>
              {label}
            </span>
          ))}
          {cells.map((iso, index) => {
            if (!iso) return <span className="cal-day is-empty" key={`empty-${index}`} />;
            const kind = dayKind(events.get(iso));
            const day = Number(iso.slice(-2));
            return (
              <button
                key={iso}
                className={[
                  "cal-day",
                  kind ? `is-${kind}` : "",
                  iso === today ? "is-today" : "",
                  iso === selected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                onClick={() => setSelected(iso)}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="cal-detail">
          {selectedEvents.length
            ? selectedEvents.map((item) => item.name).join(" · ")
            : "Nenhum feriado ou data especial neste dia."}
        </p>
        <p className="cal-legend">
          <span className="dot holiday" /> Feriado nacional
          <span className="dot special" /> Data especial
        </p>
      </div>
    </article>
  );
}
