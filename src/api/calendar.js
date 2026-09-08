export const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthTitle(year, month) {
  const label = new Date(year, month, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(year, month, delta) {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

export function buildMonthCells(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: startWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toISODate(new Date(year, month, day)));
  }
  return cells;
}

function nthWeekday(year, month, weekday, nth) {
  let count = 0;
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(year, month, day);
    if (date.getMonth() !== month) break;
    if (date.getDay() !== weekday) continue;
    count += 1;
    if (count === nth) return toISODate(date);
  }
  return null;
}

export function commemorativeDays(year) {
  return [
    { date: `${year}-03-08`, name: "Dia Internacional da Mulher", kind: "special" },
    { date: nthWeekday(year, 4, 0, 2), name: "Dia das Mães", kind: "special" },
    { date: `${year}-06-12`, name: "Dia dos Namorados", kind: "special" },
    { date: nthWeekday(year, 7, 0, 2), name: "Dia dos Pais", kind: "special" },
    { date: `${year}-10-12`, name: "Dia das Crianças", kind: "special" },
    { date: `${year}-10-15`, name: "Dia do Professor", kind: "special" },
  ].filter((item) => item.date);
}

export function eventsByDate(holidays, year) {
  const map = new Map();

  for (const item of commemorativeDays(year)) {
    map.set(item.date, [{ date: item.date, name: item.name, kind: "special" }]);
  }

  for (const item of holidays ?? []) {
    const current = map.get(item.date) ?? [];
    map.set(item.date, [{ date: item.date, name: item.name, kind: "holiday" }, ...current]);
  }

  return map;
}

export function dayKind(events) {
  if (!events?.length) return "";
  if (events.some((item) => item.kind === "holiday") && events.some((item) => item.kind === "special")) {
    return "both";
  }
  return events[0].kind;
}

export function threeMonthRange(from = new Date()) {
  const start = toISODate(from);
  const end = toISODate(new Date(from.getFullYear(), from.getMonth() + 3, 0));
  const years = [];
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) {
    years.push(year);
  }
  return { start, end, years };
}

export function formatEventDay(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function upcomingEvents(holidaysByYear, start, end) {
  const items = [];
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) {
    const mapped = eventsByDate(holidaysByYear[year] ?? [], year);
    for (const [date, events] of mapped) {
      if (date < start || date > end) continue;
      items.push(...events);
    }
  }
  return items.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate) return byDate;
    if (a.kind !== b.kind) return a.kind === "holiday" ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
