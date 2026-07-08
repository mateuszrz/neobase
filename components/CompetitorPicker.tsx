"use client";

import { useMemo, useState } from "react";

/**
 * Searchable multi-select for competitors, chosen from the tracked-fintech set
 * (so every pick is a brand we hold demo data for — no free-typed misses). Emits
 * hidden `competitorIds` inputs the server action reads via getAll().
 */

export interface BrandOption {
  id: string;
  name: string;
  country: string | null;
  logoSvg: string | null;
}

export function CompetitorPicker({
  options,
  max = 8,
  initial = [],
  label = "Competitors",
  hint,
  inputName = "competitorIds",
}: {
  options: BrandOption[];
  max?: number;
  initial?: string[];
  label?: string;
  hint?: string;
  inputName?: string;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const atMax = selected.length >= max;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !selected.includes(o.id))
      .filter((o) => (q ? o.name.toLowerCase().includes(q) || o.id.includes(q) : true))
      .slice(0, 8);
  }, [options, selected, query]);

  function add(id: string) {
    if (atMax || selected.includes(id)) return;
    setSelected((s) => [...s, id]);
    setQuery("");
  }
  function remove(id: string) {
    setSelected((s) => s.filter((x) => x !== id));
  }

  return (
    <div className="stack-8">
      <span style={{ fontWeight: 500, fontSize: 14 }}>{label}</span>

      {/* Selected chips (each carries a hidden input for the server action) */}
      {selected.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {selected.map((id) => {
            const o = byId.get(id);
            return (
              <span key={id} className="pill pill-score" style={{ gap: 8, paddingRight: 8 }}>
                {o?.logoSvg && <img src={o.logoSvg} alt="" style={{ width: 16, height: 16, borderRadius: 4 }} />}
                {o?.name ?? id}
                <input type="hidden" name={inputName} value={id} />
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={`Remove ${o?.name ?? id}`}
                  style={{ border: "none", background: "none", cursor: "pointer", fontSize: 15, lineHeight: 1, color: "inherit", padding: 0 }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search box */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={atMax ? `Up to ${max} selected` : "Search brands — e.g. Revolut, Wise, N26…"}
        disabled={atMax}
        aria-label="Search competitor brands"
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 8,
          border: "1px solid var(--stone-border, #e5e0d8)",
          fontSize: 15,
          background: atMax ? "var(--stone-border)" : "var(--stone-canvas, #fff)",
        }}
      />

      {/* Suggestions */}
      {!atMax && query.trim() !== "" && (
        <div className="card" style={{ padding: 6, marginTop: 2 }}>
          {matches.length === 0 ? (
            <p className="muted" style={{ margin: 0, padding: "8px 10px", fontSize: 13 }}>No tracked brand matches “{query}”.</p>
          ) : (
            matches.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => add(o.id)}
                className="row"
                style={{ width: "100%", gap: 10, padding: "8px 10px", border: "none", background: "none", cursor: "pointer", textAlign: "left", borderRadius: 6 }}
              >
                {o.logoSvg ? (
                  <img src={o.logoSvg} alt="" style={{ width: 22, height: 22, borderRadius: 5, flex: "0 0 auto" }} />
                ) : (
                  <span style={{ width: 22, height: 22, borderRadius: 5, background: "var(--stone-border)", flex: "0 0 auto" }} />
                )}
                <span style={{ fontSize: 14 }}>{o.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      <span className="muted" style={{ fontSize: 12 }}>
        {hint ?? `Pick up to ${max} from the brands we track — that's where the demo data comes from.`}
      </span>
    </div>
  );
}
