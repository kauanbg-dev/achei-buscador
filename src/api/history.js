import { formatCep, onlyDigits } from "./brasil.js";

const KEY = "achei-ceps";
const LIMIT = 6;

export function formatAddress(data) {
  const street = data.street || "Logradouro não informado";
  const neighborhood = data.neighborhood || "—";
  return `${street}\n${neighborhood}\n${data.city}/${data.state}\nCEP ${formatCep(data.cep)}`;
}

export function loadCepHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => ({
        cep: formatCep(item.cep),
        label: item.label || formatCep(item.cep),
      }))
      .filter((item) => onlyDigits(item.cep).length === 8);
  } catch {
    return [];
  }
}

export function saveCepHistory(entry, previous = loadCepHistory()) {
  const cep = formatCep(entry.cep);
  const next = [{ cep, label: entry.label || cep }, ...previous.filter((item) => item.cep !== cep)].slice(
    0,
    LIMIT
  );
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
