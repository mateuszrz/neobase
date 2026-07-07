import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check your email",
  description: "A sign-in link is on its way.",
};

export default function VerifyRequestPage() {
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 420 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Account</p>
        <h1 className="display" style={{ fontSize: "2rem" }}>Check your email</h1>
        <p className="lead" style={{ marginTop: 16, fontSize: 16 }}>
          We sent a magic link to your inbox. Click it to finish signing in — the link expires in 24 hours.
        </p>
        <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
          Didn&apos;t get it? Check spam, or <a href="/login" style={{ color: "var(--cyan-signal)" }}>try again</a>.
        </p>
      </div>
    </main>
  );
}
