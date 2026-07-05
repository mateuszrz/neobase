import type { Metadata } from "next";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const { fintechs, metricSnapshots } = schema;

type Point = { date: string; rating: number | null; count: number | null; pos: number | null };

function LineChart({ points }: { points: Point[] }) {
  const W = 760;
  const H = 220;
  const P = 32;
  const rated = points.filter((p) => p.rating != null);
  if (rated.length < 2) return <p style={{ color: "#64748b" }}>Not enough data to chart yet.</p>;

  const xs = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const ratingY = (r: number) => H - P - ((r - 1) / 4) * (H - 2 * P); // rating scale 1..5

  const counts = points.map((p) => p.count ?? 0);
  const minC = Math.min(...counts);
  const maxC = Math.max(...counts);
  const countY = (c: number) => H - P - ((c - minC) / Math.max(1, maxC - minC)) * (H - 2 * P);

  const ratingPath = points
    .map((p, i) => (p.rating == null ? null : `${i === 0 ? "M" : "L"}${xs(i)},${ratingY(p.rating)}`))
    .filter(Boolean)
    .join(" ");
  const countPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i)},${countY(p.count ?? 0)}`).join(" ");

  return (
    <svg width={W} height={H} style={{ maxWidth: "100%", background: "rgba(255,255,255,.03)", borderRadius: 12 }}>
      <path d={countPath} fill="none" stroke="#38bdf8" strokeWidth={1.5} opacity={0.7} />
      <path d={ratingPath} fill="none" stroke="#34d399" strokeWidth={2} />
      {points.map((p, i) =>
        p.rating == null ? null : <circle key={i} cx={xs(i)} cy={ratingY(p.rating)} r={2.5} fill="#34d399" />,
      )}
      <text x={P} y={16} fill="#34d399" fontSize={11}>
        ● Trustpilot rating (1–5)
      </text>
      <text x={P + 180} y={16} fill="#38bdf8" fontSize={11}>
        ● Total review count
      </text>
    </svg>
  );
}

export default async function DebugPage({ params }: { params: Promise<{ fintechId: string }> }) {
  const { fintechId } = await params;

  const [ft] = await db.select().from(fintechs).where(eq(fintechs.id, fintechId)).limit(1);
  if (!ft) {
    return (
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px" }}>
        <h1>Unknown fintech: {fintechId}</h1>
      </main>
    );
  }

  const series = await db
    .select({
      date: metricSnapshots.snapshotDate,
      rating: metricSnapshots.rating,
      count: metricSnapshots.reviewCount,
      pos: metricSnapshots.sentimentPos,
    })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.fintechId, fintechId),
        eq(metricSnapshots.kind, "trustpilot"),
        eq(metricSnapshots.country, "ZZ"),
      ),
    )
    .orderBy(asc(metricSnapshots.snapshotDate));

  const points: Point[] = series.map((r) => ({
    date: String(r.date),
    rating: r.rating == null ? null : Number(r.rating),
    count: r.count == null ? null : Number(r.count),
    pos: r.pos == null ? null : Number(r.pos),
  }));

  const perCountry = await db
    .select({
      country: metricSnapshots.country,
      date: metricSnapshots.snapshotDate,
      rating: metricSnapshots.rating,
      count: metricSnapshots.reviewCount,
    })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.fintechId, fintechId),
        eq(metricSnapshots.kind, "trustpilot"),
        ne(metricSnapshots.country, "ZZ"),
      ),
    )
    .orderBy(desc(metricSnapshots.snapshotDate))
    .limit(40);

  const recent = [...points].slice(-8).reverse();

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 96px" }}>
      <a href="/" style={{ color: "#818cf8", fontSize: 14 }}>
        ← NeoBase
      </a>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 4 }}>{ft.name}</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginTop: 0 }}>
        {ft.type} · {ft.country ?? "—"} · {points.length} Trustpilot snapshots
      </p>

      <h2 style={{ fontSize: "1.1rem", marginTop: 28 }}>Trustpilot history (global)</h2>
      <LineChart points={points} />

      <h2 style={{ fontSize: "1.1rem", marginTop: 28 }}>Most recent snapshots</h2>
      <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#64748b" }}>
            <th style={{ padding: "6px 12px" }}>Date</th>
            <th style={{ padding: "6px 12px" }}>Rating</th>
            <th style={{ padding: "6px 12px" }}>Reviews</th>
            <th style={{ padding: "6px 12px" }}>Positive %</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((p) => (
            <tr key={p.date} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <td style={{ padding: "6px 12px" }}>{p.date}</td>
              <td style={{ padding: "6px 12px" }}>{p.rating ?? "—"}</td>
              <td style={{ padding: "6px 12px" }}>{p.count?.toLocaleString() ?? "—"}</td>
              <td style={{ padding: "6px 12px" }}>{p.pos ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {perCountry.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginTop: 28 }}>Recent by reviewer country</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {perCountry.slice(0, 24).map((c, i) => (
              <span
                key={i}
                style={{
                  background: "rgba(99,102,241,.15)",
                  color: "#a5b4fc",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: 13,
                }}
              >
                {c.country} · {String(c.date).slice(5)} · {c.count ?? 0} rev · ⭐{c.rating ?? "—"}
              </span>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
