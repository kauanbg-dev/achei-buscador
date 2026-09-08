import { fetchBanks, fetchCep, fetchHolidays, formatCep } from "./src/api/brasil.js";
import { formatAddress, loadCepHistory, saveCepHistory } from "./src/api/history.js";
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
} from "./src/api/calendar.js";

const year = new Date().getFullYear();
document.getElementById("year").textContent = String(year);

const cepInput = document.getElementById("cep");
const cepStatus = document.getElementById("cep-status");
const cepBtn = document.getElementById("cep-btn");
const addressCard = document.getElementById("address-card");
const holidayStatus = document.getElementById("holiday-status");
const holidayList = document.getElementById("holiday-list");
const calTitle = document.getElementById("cal-title");
const calendarEl = document.getElementById("calendar");
const calDetail = document.getElementById("cal-detail");
const bankStatus = document.getElementById("bank-status");
const bankList = document.getElementById("bank-list");
const bankQ = document.getElementById("bank-q");
const historyEl = document.getElementById("cep-history");

let banks = [];
let history = loadCepHistory();
let copyTimer;
const todayIso = toISODate(new Date());
const holidayCache = {};
const holidayLoads = {};
const range = threeMonthRange(new Date());
const cursor = { year: new Date().getFullYear(), month: new Date().getMonth() };
let selected = todayIso;

function emptyAddress() {
  return `<p class="kicker">Endereço</p>
      <h2>Aguardando um CEP</h2>
      <p>O resultado da busca aparece aqui, com bairro, cidade e link para o mapa.</p>`;
}

function renderHistory() {
  if (!history.length) {
    historyEl.innerHTML = "";
    return;
  }
  historyEl.innerHTML = history
    .map(
      (item) =>
        `<button class="chip" type="button" data-cep="${item.cep}">${item.label}</button>`
    )
    .join("");
}

function mapUrlFor(data) {
  const coords = data.location?.coordinates;
  const lat = coords?.latitude;
  const lng = coords?.longitude;
  const query = `${data.street ?? ""} ${data.neighborhood ?? ""} ${data.city ?? ""} ${data.state ?? ""} ${data.cep}`;
  return lat && lng
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function showAddress(data) {
  addressCard.classList.remove("muted");
  addressCard.innerHTML = `
      <p class="kicker">Endereço</p>
      <h2>${data.street || "Logradouro não informado"}</h2>
      <ul class="details">
        <li><strong>CEP</strong><span>${formatCep(data.cep)}</span></li>
        <li><strong>Bairro</strong><span>${data.neighborhood || "—"}</span></li>
        <li><strong>Cidade</strong><span>${data.city}/${data.state}</span></li>
      </ul>
      <div class="card-actions">
        <button class="btn ghost" type="button" id="copy-address">Copiar endereço</button>
        <a class="btn ghost" href="${mapUrlFor(data)}" target="_blank" rel="noopener noreferrer">Ver no mapa</a>
      </div>
    `;
  document.getElementById("copy-address").addEventListener("click", async () => {
    const button = document.getElementById("copy-address");
    try {
      await navigator.clipboard.writeText(formatAddress(data));
      button.textContent = "Copiado";
      window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        if (button) button.textContent = "Copiar endereço";
      }, 1600);
    } catch {
      button.textContent = "Não foi possível copiar";
    }
  });
}

async function lookupCep(value) {
  const formatted = formatCep(value);
  cepInput.value = formatted;
  cepBtn.disabled = true;
  cepBtn.textContent = "Buscando…";
  cepStatus.textContent = "";
  cepStatus.classList.remove("status-error");
  addressCard.classList.add("muted");
  addressCard.innerHTML = emptyAddress();

  try {
    const data = await fetchCep(formatted);
    showAddress(data);
    const label = data.street ? `${formatCep(data.cep)} · ${data.city}` : formatCep(data.cep);
    history = saveCepHistory({ cep: data.cep, label });
    renderHistory();
  } catch (error) {
    cepStatus.classList.add("status-error");
    cepStatus.textContent =
      error.code === 404
        ? "CEP não encontrado. Exemplo válido: 01310-100."
        : error.message || "Não foi possível buscar esse CEP.";
  } finally {
    cepBtn.disabled = false;
    cepBtn.textContent = "Buscar";
  }
}

cepInput.addEventListener("input", () => {
  cepInput.value = formatCep(cepInput.value);
});

document.getElementById("cep-form").addEventListener("submit", (event) => {
  event.preventDefault();
  lookupCep(cepInput.value);
});

historyEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cep]");
  if (button) lookupCep(button.dataset.cep);
});

function renderBanks() {
  const term = bankQ.value.trim().toLowerCase();
  const valid = banks.filter((bank) => bank.name && bank.code != null);
  const filtered = (term
    ? valid.filter(
        (bank) =>
          String(bank.code).includes(term) ||
          bank.name.toLowerCase().includes(term) ||
          String(bank.fullName ?? "").toLowerCase().includes(term)
      )
    : valid
  ).slice(0, 8);

  if (!filtered.length) {
    bankList.innerHTML = "";
    bankStatus.textContent = "Nenhum banco encontrado para essa busca.";
    return;
  }
  bankStatus.textContent = "";
  bankList.innerHTML = filtered
    .map(
      (bank) =>
        `<li><strong>${String(bank.code).padStart(3, "0")}</strong><span>${bank.name}</span></li>`
    )
    .join("");
}

bankQ.addEventListener("input", renderBanks);

function renderCalendar(events) {
  calTitle.textContent = monthTitle(cursor.year, cursor.month);
  const cells = buildMonthCells(cursor.year, cursor.month);
  const weekdays = WEEKDAYS.map((label) => `<span class="cal-dow">${label}</span>`).join("");
  const days = cells
    .map((iso, index) => {
      if (!iso) return `<span class="cal-day is-empty"></span>`;
      const kind = dayKind(events.get(iso));
      const classes = [
        "cal-day",
        kind ? `is-${kind}` : "",
        iso === todayIso ? "is-today" : "",
        iso === selected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button class="${classes}" type="button" data-date="${iso}">${Number(iso.slice(-2))}</button>`;
    })
    .join("");
  calendarEl.innerHTML = weekdays + days;
  const selectedEvents = events.get(selected) ?? [];
  calDetail.textContent = selectedEvents.length
    ? selectedEvents.map((item) => item.name).join(" · ")
    : "Nenhum feriado ou data especial neste dia.";
}

function renderUpcoming() {
  const items = upcomingEvents(holidayCache, range.start, range.end);
  if (!items.length) {
    holidayList.innerHTML = "";
    return;
  }
  holidayList.innerHTML = items
    .map(
      (item) =>
        `<li><button class="upcoming-item is-${item.kind}" type="button" data-date="${item.date}"><strong>${formatEventDay(item.date)}</strong><span>${item.name}</span></button></li>`
    )
    .join("");
}

function ensureYear(year) {
  if (holidayCache[year]) return Promise.resolve();
  if (!holidayLoads[year]) {
    holidayLoads[year] = fetchHolidays(year)
      .then((data) => {
        holidayCache[year] = data;
      })
      .catch(() => {
        holidayCache[year] = [];
        throw new Error("holiday-fetch");
      });
  }
  return holidayLoads[year];
}

async function loadCalendarYear() {
  holidayStatus.classList.remove("status-error");
  holidayStatus.textContent = "Carregando feriados…";
  const years = [...new Set([cursor.year, ...range.years])];
  try {
    await Promise.all(years.map(ensureYear));
    holidayStatus.textContent = "";
  } catch {
    holidayStatus.classList.add("status-error");
    holidayStatus.textContent = "Não foi possível carregar os feriados.";
  }
  renderUpcoming();
  renderCalendar(eventsByDate(holidayCache[cursor.year] ?? [], cursor.year));
}

function moveMonth(delta) {
  const next = shiftMonth(cursor.year, cursor.month, delta);
  cursor.year = next.year;
  cursor.month = next.month;
  const prefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  if (!selected.startsWith(prefix)) {
    selected = todayIso.startsWith(prefix) ? todayIso : `${prefix}-01`;
  }
  loadCalendarYear();
}

document.getElementById("cal-prev").addEventListener("click", () => moveMonth(-1));
document.getElementById("cal-next").addEventListener("click", () => moveMonth(1));
calendarEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  selected = button.dataset.date;
  renderCalendar(eventsByDate(holidayCache[cursor.year] ?? [], cursor.year));
});

holidayList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  selected = button.dataset.date;
  cursor.year = Number(selected.slice(0, 4));
  cursor.month = Number(selected.slice(5, 7)) - 1;
  loadCalendarYear();
});

loadCalendarYear();

fetchBanks()
  .then((data) => {
    banks = data;
    renderBanks();
  })
  .catch(() => {
    bankStatus.classList.add("status-error");
    bankStatus.textContent = "Não foi possível carregar os bancos.";
  });

renderHistory();
