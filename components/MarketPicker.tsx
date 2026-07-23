"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Multi-select for markets (ISO2), chosen from a fixed list, capped at the
 * package's market slots. Emits hidden `marketCodes` inputs for the server action.
 */

export interface MarketOption {
  code: string; // ISO2
  name: string;
}

function flag(cc: string): string {
  if (cc.length !== 2) return "🌍";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function MarketPicker({ options, max, initial = [] }: { options: MarketOption[]; max: number; initial?: string[] }) {
  const t = useTranslations("picker");
  const [selected, setSelected] = useState<string[]>(initial.map((c) => c.toUpperCase()));
  const byCode = useMemo(() => new Map(options.map((o) => [o.code, o])), [options]);
  const atMax = selected.length >= max;

  function toggle(code: string) {
    setSelected((s) => (s.includes(code) ? s.filter((x) => x !== code) : atMax ? s : [...s, code]));
  }

  return (
    <div className="stack-8">
      <span style={{ fontWeight: 500, fontSize: 14 }}>{t("markets")}</span>

      {selected.map((code) => (
        <input key={code} type="hidden" name="marketCodes" value={code} />
      ))}

      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = selected.includes(o.code);
          const disabled = !on && atMax;
          return (
            <button
              key={o.code}
              type="button"
              onClick={() => toggle(o.code)}
              disabled={disabled}
              aria-pressed={on}
              className={`pill ${on ? "pill-score" : "pill-neutral"}`}
              style={{ gap: 6, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, border: "none" }}
            >
              <span aria-hidden>{flag(o.code)}</span>
              {o.name}
              {on && <span aria-hidden style={{ opacity: 0.7 }}>✓</span>}
            </button>
          );
        })}
      </div>

      <span className="muted" style={{ fontSize: 12 }}>
        {t("marketsHint", { count: selected.length, max })}
      </span>
    </div>
  );
}
