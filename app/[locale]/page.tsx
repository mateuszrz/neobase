import { getPlatformStats, getTopNeobanks, getTopExchanges } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { FintechCard, Highlight, Stat, fmt } from "@/components/ui";

export const revalidate = 3600;

export default async function Home() {
  const [stats, neobanks, exchanges] = await Promise.all([
    getPlatformStats(),
    getTopNeobanks(9),
    getTopExchanges(6),
  ]);

  return (
    <main>
      {/* Hero */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 880 }}>
          <p className="eyebrow" style={{ marginBottom: 18 }}>Independent fintech intelligence</p>
          <h1 className="display">
            Track how the world&apos;s <Highlight>neobanks</Highlight> are really doing.
          </h1>
          <p className="lead" style={{ marginTop: 20, maxWidth: 620 }}>
            Ratings, reviews and sentiment for 100+ neobanks and crypto exchanges — aggregated from
            Trustpilot and the app stores, segmented by country, updated daily.
          </p>
          <div className="row" style={{ marginTop: 28 }}>
            <Link className="btn btn-cyan" href="/test/">Test our reports — free</Link>
            <Link className="btn btn-ghost" href="/neobanks/">Explore neobanks</Link>
          </div>
          <div className="row" style={{ marginTop: 22, color: "var(--warm-gray)", fontSize: 13 }}>
            <span className="stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></span>
            Real reviews from Trustpilot, Google Play &amp; the App Store
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="wrap">
        <div className="grid grid-4">
          <Stat num={String(stats.fintechs)} label="Fintechs tracked" />
          <Stat num={fmt(stats.ratings)} label="Ratings analysed" />
          <Stat num={String(stats.countries)} label="Countries segmented" />
          <Stat num="Daily" label="Data refresh cadence" />
        </div>
      </section>

      {/* Top neobanks */}
      <section className="section">
        <div className="wrap">
          <div className="spread" style={{ marginBottom: 20 }}>
            <h2 className="h-sm">Top-rated neobanks</h2>
            <Link className="nav-link" href="/neobanks/" style={{ padding: 0, color: "var(--cyan-edge)" }}>
              View all →
            </Link>
          </div>
          <div className="grid grid-3">
            {neobanks.map((f) => (
              <FintechCard key={f.id} f={f} kind="neobank" />
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="wrap">
        <div className="grid grid-3">
          {[
            ["Change detection", "Spot pricing, plan and positioning shifts across competitors before they reach you."],
            ["Sentiment tracking", "See whether the market mood is turning — positive vs negative, by country."],
            ["Rating momentum", "Follow how ratings and review volume grow across Trustpilot and the app stores."],
          ].map(([t, d]) => (
            <div key={t} className="feature-card">
              <h3 className="subheading" style={{ marginBottom: 8 }}>{t}</h3>
              <p className="muted" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top exchanges */}
      <section className="section">
        <div className="wrap">
          <div className="spread" style={{ marginBottom: 20 }}>
            <h2 className="h-sm">Crypto exchanges</h2>
            <Link className="nav-link" href="/exchanges/" style={{ padding: 0, color: "var(--cyan-edge)" }}>
              View all →
            </Link>
          </div>
          <div className="grid grid-3">
            {exchanges.map((f) => (
              <FintechCard key={f.id} f={f} kind="exchange" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
