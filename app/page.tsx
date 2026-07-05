export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 20px" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>NeoBase</h1>
      <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>
        Fintech competitive-intelligence platform. The public directory and paid analytics panel
        are under construction. The daily data pipeline is live — inspect a fintech&apos;s collected
        history at <code>/panel/debug/&lt;fintechId&gt;</code> (e.g.{" "}
        <a href="/panel/debug/revolut/" style={{ color: "#818cf8" }}>
          /panel/debug/revolut
        </a>
        ).
      </p>
    </main>
  );
}
