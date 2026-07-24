"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { MicaRegistryRow } from "@/lib/queries";
import { countryFlag } from "@/lib/mica/reference";

/* Searchable MiCA/ESMA CASP registry, ranked by our composite sentiment score.
 * Client component — instant search/filter over the full (~280) provider list. */

function scoreColor(v: number): string {
  if (v >= 80) return "#16a34a";
  if (v >= 60) return "var(--cyan-edge)";
  if (v >= 40) return "#b45309";
  return "var(--neg)";
}

const uniqSorted = (xs: string[]) => Array.from(new Set(xs.filter(Boolean))).sort((a, b) => a.localeCompare(b));

export function MicaRegistry({ rows }: { rows: MicaRegistryRow[] }) {
  const t = useTranslations("micaPage");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [regulator, setRegulator] = useState("");
  const [service, setService] = useState("");

  const countries = useMemo(() => uniqSorted(rows.map((r) => r.country)), [rows]);
  const regulators = useMemo(() => uniqSorted(rows.map((r) => r.regulator)), [rows]);
  const services = useMemo(() => uniqSorted(rows.flatMap((r) => r.services)), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!needle || r.provider.toLowerCase().includes(needle) || (r.legalEntity ?? "").toLowerCase().includes(needle)) &&
        (!country || r.country === country) &&
        (!regulator || r.regulator === regulator) &&
        (!service || r.services.includes(service)),
    );
  }, [rows, q, country, regulator, service]);

  const tracked = filtered.filter((r) => r.sentiment != null).length;

  const selStyle: React.CSSProperties = {
    padding: "8px 10px", borderRadius: 8, border: "1px solid var(--stone-border)",
    background: "var(--pure-white)", fontSize: 13, color: "var(--ink-black)", minWidth: 130,
  };

  return (
    <div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          style={{ ...selStyle, flex: 1, minWidth: 220 }}
          aria-label={t("searchLabel")}
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={selStyle} aria-label={t("countryFilter")}>
          <option value="">{t("allCountries")}</option>
          {countries.map((c) => <option key={c} value={c}>{countryFlag(c)} {c}</option>)}
        </select>
        <select value={regulator} onChange={(e) => setRegulator(e.target.value)} style={selStyle} aria-label={t("regulatorFilter")}>
          <option value="">{t("allRegulators")}</option>
          {regulators.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={service} onChange={(e) => setService(e.target.value)} style={selStyle} aria-label={t("serviceLabel")}>
          <option value="">{t("allServices")}</option>
          {services.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <p className="muted" style={{ fontSize: 12, margin: "0 0 12px" }}>
        {t("resultProviders", { count: filtered.length })}{tracked > 0 ? ` · ${t("trackedBy", { count: tracked })}` : ""}
        {(country || regulator || service || q) && (
          <button
            onClick={() => { setQ(""); setCountry(""); setRegulator(""); setService(""); }}
            style={{ marginLeft: 10, background: "none", border: "none", color: "var(--cyan-edge)", cursor: "pointer", fontSize: 12, padding: 0 }}
          >
            {t("clear")}
          </button>
        )}
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--warm-gray)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "8px 10px", width: 40 }}>#</th>
              <th style={{ padding: "8px 10px" }}>{t("colProvider")}</th>
              <th style={{ padding: "8px 10px", width: 120 }}>{t("colScore")}</th>
              <th style={{ padding: "8px 10px" }}>{t("colCountry")}</th>
              <th style={{ padding: "8px 10px" }}>{t("colRegulator")}</th>
              <th style={{ padding: "8px 10px" }}>{t("colServices")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const tradingPlatform = r.services.includes("Trading platform");
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--stone-border)" }}>
                  <td style={{ padding: "10px", color: "var(--ash-gray)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</td>
                  <td style={{ padding: "10px", fontWeight: 500 }}>
                    {r.fintechId ? (
                      <a href={`/exchange/${r.fintechId}/`} style={{ color: "var(--cyan-edge)" }}>{r.provider}</a>
                    ) : (
                      r.provider
                    )}
                    {r.legalEntity && r.legalEntity !== r.provider && (
                      <span className="muted" style={{ fontSize: 11, display: "block" }}>{r.legalEntity}</span>
                    )}
                  </td>
                  <td style={{ padding: "10px", fontVariantNumeric: "tabular-nums" }}>
                    {r.sentiment != null ? (
                      <strong style={{ color: scoreColor(r.sentiment), fontWeight: 600 }}>{r.sentiment.toFixed(1)}</strong>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                    <span aria-hidden style={{ marginRight: 6 }}>{countryFlag(r.country)}</span>{r.country}
                  </td>
                  <td style={{ padding: "10px" }}>{r.regulator}</td>
                  <td style={{ padding: "10px" }}>
                    {tradingPlatform && (
                      <span className="badge" style={{ borderColor: "#16a34a", color: "#16a34a", marginRight: 6 }}>{t("tradingPlatform")}</span>
                    )}
                    <span className="muted" style={{ fontSize: 12 }}>{t("services", { count: r.services.length })}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="muted" style={{ padding: "20px 0", textAlign: "center" }}>{t("noMatch")}</p>}
    </div>
  );
}
