import { useEffect, useMemo, useState } from "react";
import { fetchBanks, fetchCep, formatCep } from "./api/brasil.js";
import { formatAddress, loadCepHistory, saveCepHistory } from "./api/history.js";
import HolidayCalendar from "./HolidayCalendar.jsx";

const currentYear = new Date().getFullYear();

function Status({ children, tone = "info" }) {
  return <p className={`status status-${tone}`}>{children}</p>;
}

function AddressCard({ data }) {
  const [copied, setCopied] = useState(false);
  const coords = data.location?.coordinates;
  const lat = coords?.latitude;
  const lng = coords?.longitude;
  const mapUrl =
    lat && lng
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
      : `https://www.openstreetmap.org/search?query=${encodeURIComponent(
          `${data.street ?? ""} ${data.neighborhood ?? ""} ${data.city ?? ""} ${data.state ?? ""} ${data.cep}`
        )}`;

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(formatAddress(data));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="card">
      <p className="kicker">Endereço</p>
      <h2>{data.street || "Logradouro não informado"}</h2>
      <ul className="details">
        <li>
          <strong>CEP</strong>
          <span>{formatCep(data.cep)}</span>
        </li>
        <li>
          <strong>Bairro</strong>
          <span>{data.neighborhood || "—"}</span>
        </li>
        <li>
          <strong>Cidade</strong>
          <span>
            {data.city}/{data.state}
          </span>
        </li>
      </ul>
      <div className="card-actions">
        <button className="btn ghost" type="button" onClick={copyAddress}>
          {copied ? "Copiado" : "Copiar endereço"}
        </button>
        <a className="btn ghost" href={mapUrl} target="_blank" rel="noopener noreferrer">
          Ver no mapa
        </a>
      </div>
    </article>
  );
}

function BanksList({ banks, loading, error, query, onQuery }) {
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const valid = (banks ?? []).filter((bank) => bank.name && bank.code != null);
    if (!term) return valid.slice(0, 8);
    return valid
      .filter(
        (bank) =>
          String(bank.code).includes(term) ||
          bank.name.toLowerCase().includes(term) ||
          String(bank.fullName ?? "").toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [banks, query]);

  return (
    <article className="card">
      <p className="kicker">Bancos</p>
      <h2>Buscar instituição</h2>
      <input
        className="field"
        type="search"
        placeholder="Nome ou código (ex: 001)"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        disabled={loading || Boolean(error)}
      />
      {loading && <Status>Carregando bancos…</Status>}
      {error && <Status tone="error">{error}</Status>}
      {!loading && !error && filtered.length === 0 && (
        <Status>Nenhum banco encontrado para essa busca.</Status>
      )}
      {filtered.length > 0 && (
        <ul className="list">
          {filtered.map((bank) => (
            <li key={`${bank.code}-${bank.ispb}`}>
              <strong>{String(bank.code).padStart(3, "0")}</strong>
              <span>{bank.name}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function App() {
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState(null);
  const [cepStatus, setCepStatus] = useState({ loading: false, error: "" });
  const [banks, setBanks] = useState([]);
  const [bankStatus, setBankStatus] = useState({ loading: true, error: "" });
  const [bankQuery, setBankQuery] = useState("");
  const [history, setHistory] = useState(() => loadCepHistory());

  useEffect(() => {
    let alive = true;

    fetchBanks()
      .then((data) => {
        if (alive) {
          setBanks(data);
          setBankStatus({ loading: false, error: "" });
        }
      })
      .catch(() => {
        if (alive) setBankStatus({ loading: false, error: "Não foi possível carregar os bancos." });
      });

    return () => {
      alive = false;
    };
  }, []);

  async function lookupCep(value) {
    const formatted = formatCep(value);
    setCep(formatted);
    setCepStatus({ loading: true, error: "" });
    setAddress(null);

    try {
      const data = await fetchCep(formatted);
      setAddress(data);
      setCepStatus({ loading: false, error: "" });
      const label = data.street ? `${formatCep(data.cep)} · ${data.city}` : formatCep(data.cep);
      setHistory(saveCepHistory({ cep: data.cep, label }));
    } catch (error) {
      const message =
        error.code === 404
          ? "CEP não encontrado. Exemplo válido: 01310-100."
          : error.message || "Não foi possível buscar esse CEP.";
      setCepStatus({ loading: false, error: message });
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    lookupCep(cep);
  }

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="brand">Achei</p>
          <p className="tagline">CEP, feriados e bancos com a BrasilAPI</p>
        </div>
        <a className="source" href="https://brasilapi.com.br/" target="_blank" rel="noopener noreferrer">
          BrasilAPI
        </a>
      </header>

      <section className="hero">
        <h1>Achei esse endereço.</h1>
        <p>
          Digite um CEP para ver logradouro, cidade e mapa. Ao lado, o calendário de feriados e uma
          busca rápida de bancos.
        </p>
        <form className="search" onSubmit={handleSearch}>
          <label htmlFor="cep">CEP</label>
          <div className="search-row">
            <input
              id="cep"
              className="field"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={cep}
              onChange={(event) => setCep(formatCep(event.target.value))}
              maxLength={9}
            />
            <button className="btn" type="submit" disabled={cepStatus.loading}>
              {cepStatus.loading ? "Buscando…" : "Buscar"}
            </button>
          </div>
        </form>
        {cepStatus.error && <Status tone="error">{cepStatus.error}</Status>}
        {!address && !cepStatus.loading && !cepStatus.error && (
          <Status>Experimente 01310-100 (Av. Paulista) para ver o fluxo completo.</Status>
        )}
        {history.length > 0 && (
          <div className="history">
            {history.map((item) => (
              <button
                key={item.cep}
                className="chip"
                type="button"
                onClick={() => lookupCep(item.cep)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid">
        {address ? (
          <AddressCard data={address} />
        ) : (
          <article className="card muted">
            <p className="kicker">Endereço</p>
            <h2>Aguardando um CEP</h2>
            <p>O resultado da busca aparece aqui, com bairro, cidade e link para o mapa.</p>
          </article>
        )}
        <HolidayCalendar />
        <BanksList
          banks={banks}
          loading={bankStatus.loading}
          error={bankStatus.error}
          query={bankQuery}
          onQuery={setBankQuery}
        />
      </section>

      <footer>
        <p>Projeto de portfólio · React + BrasilAPI · {currentYear}</p>
      </footer>
    </div>
  );
}
