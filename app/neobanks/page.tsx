import type { Metadata } from "next";
import { listNeobanks } from "@/lib/queries";
import { FintechCard, flagEmoji } from "@/components/ui";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Neobank & Fintech Directory",
  description: "Compare 100+ neobanks and fintech companies by rating, reviews and country.",
};

export default async function NeobanksPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const all = await listNeobanks();
  const countries = [...new Set(all.map((f) => f.country).filter(Boolean))].sort() as string[];
  const list = country ? all.filter((f) => f.country === country) : all;

  return (
    <main className="section">
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Directory</p>
        <h1 className="h-sm">Neobanks &amp; fintechs</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 24 }}>
          {list.length} {list.length === 1 ? "company" : "companies"}
          {country ? ` in ${flagEmoji(country)} ${country}` : " worldwide"}, ranked by TrustScore.
        </p>

        <div className="row" style={{ gap: 8, marginBottom: 28 }}>
          <a className={`badge${!country ? " pill-score" : ""}`} href="/neobanks/">All</a>
          {countries.map((c) => (
            <a key={c} className={`badge${country === c ? " pill-score" : ""}`} href={`/neobanks/?country=${c}`}>
              {flagEmoji(c)} {c}
            </a>
          ))}
        </div>

        <div className="grid grid-3">
          {list.map((f) => (
            <FintechCard key={f.id} f={f} kind="neobank" />
          ))}
        </div>
      </div>
    </main>
  );
}
