import type { Metadata } from "next";
import { listExchanges } from "@/lib/queries";
import { FintechCard } from "@/components/ui";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Crypto Exchange Directory",
  description: "Compare top cryptocurrency exchanges by rating, reviews and user sentiment.",
};

export default async function ExchangesPage() {
  const list = await listExchanges();
  return (
    <main className="section">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Directory</p>
        <h1 className="h-sm">Crypto exchanges</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 16 }}>
          {list.length} exchanges ranked by TrustScore.
        </p>
        <p style={{ marginBottom: 28 }}>
          <a href="/exchanges/mica/" className="btn btn-ghost">🇪🇺 MiCA licence registry →</a>
        </p>
        <div className="grid grid-3">
          {list.map((f) => (
            <FintechCard key={f.id} f={f} kind="exchange" />
          ))}
        </div>
      </div>
    </main>
  );
}
