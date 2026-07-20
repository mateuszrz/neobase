import type { Metadata } from "next";
import { getTagCounts } from "@/lib/queries";
import { TAGS, tagsForGroup } from "@/lib/tags";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Best Neobanks & Crypto Exchanges by Use Case — NeoBase Rankings",
  description:
    "Rankings of the best neobanks and crypto exchanges by use case — multi-currency accounts, travel cards, low-fee exchanges, staking and more — ranked by NeoBase's own sentiment score.",
  alternates: { canonical: "/best" },
};

export default async function RankingsIndex() {
  const counts = await getTagCounts();
  const sizeOf = (t: (typeof TAGS)[number]) => t.match.reduce((s, raw) => s + (counts.get(`${t.group}:${raw}`) ?? 0), 0);

  return (
    <main className="section" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <p className="eyebrow" style={{ marginBottom: 10 }}>Rankings</p>
        <h1 className="h-sm">Best by use case</h1>
        <p className="lead" style={{ marginTop: 10, marginBottom: 28, maxWidth: 760 }}>
          The best neobanks and crypto exchanges for what you actually need — each list ranked by NeoBase’s own
          customer-sentiment score.
        </p>

        {(["neobank", "exchange"] as const).map((group) => (
          <section key={group} style={{ marginBottom: 32 }}>
            <h2 className="subheading" style={{ marginBottom: 14 }}>{group === "neobank" ? "Neobanks" : "Crypto exchanges"}</h2>
            <div className="grid grid-3">
              {tagsForGroup(group).map((t) => (
                <a key={t.slug} href={`/best/${t.slug}/`} className="card" style={{ textDecoration: "none", color: "inherit", padding: 18 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{sizeOf(t)} options</div>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
