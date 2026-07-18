import type { Metadata } from "next";
import { getMicaRegistry } from "@/lib/queries";
import { MicaRegistry } from "@/components/MicaRegistry";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "MiCA-Licensed Crypto Providers — ESMA Register, Ranked by Sentiment",
  description:
    "Search the EU MiCA register of licensed crypto-asset service providers (CASPs) — by country, regulator and service. Licensed exchanges ranked by NeoBase's own customer-sentiment score.",
  alternates: { canonical: "/exchanges/mica" },
};

export default async function MicaRegistryPage() {
  const rows = await getMicaRegistry();
  const countries = new Set(rows.map((r) => r.country)).size;
  const regulators = new Set(rows.map((r) => r.regulator)).size;
  const tradingPlatforms = rows.filter((r) => r.services.includes("Trading platform")).length;
  const tracked = rows.filter((r) => r.sentiment != null).length;

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <a href="/exchanges/" style={{ color: "var(--cyan-edge)" }}>← Exchanges</a>
        </p>
        <p className="eyebrow" style={{ marginBottom: 10 }}>EU regulation</p>
        <h1 className="h-sm">MiCA-licensed crypto providers</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 20, maxWidth: 780 }}>
          The EU register of crypto-asset service providers (CASPs) authorised under MiCA, mirrored from ESMA.
          Search by name, country, regulator or service — and see the licensed exchanges we track ranked by our own
          customer-sentiment score.
        </p>

        <div className="row" style={{ gap: 28, flexWrap: "wrap", marginBottom: 24 }}>
          <Stat n={rows.length} label="Licensed providers" />
          <Stat n={countries} label="Countries" />
          <Stat n={regulators} label="Regulators" />
          <Stat n={tradingPlatforms} label="Trading platforms" />
          <Stat n={tracked} label="Ranked by sentiment" />
        </div>

        <MicaRegistry rows={rows} />

        <p className="muted" style={{ fontSize: 11, marginTop: 20 }}>
          Source: ESMA MiCA register. NeoBase mirrors the public data and adds its own sentiment ranking; verify
          critical decisions against the official ESMA register and the relevant national regulator.
        </p>
      </div>
    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 500, lineHeight: 1 }}>{n}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}
