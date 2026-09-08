const BASE = "https://brasilapi.com.br/api";

async function getJson(path) {
  const response = await fetch(`${BASE}${path}`);

  if (response.status === 404) {
    const error = new Error("Não encontrado");
    error.code = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error("Falha ao consultar a BrasilAPI");
    error.code = response.status;
    throw error;
  }

  return response.json();
}

export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatCep(value) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function fetchCep(cep) {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) {
    const error = new Error("Use 8 números. Exemplo: 01310-100");
    error.code = 400;
    throw error;
  }
  return getJson(`/cep/v2/${digits}`);
}

export function fetchHolidays(year) {
  return getJson(`/feriados/v1/${year}`);
}

export function fetchBanks() {
  return getJson("/banks/v1");
}
