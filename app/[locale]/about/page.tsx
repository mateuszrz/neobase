import type { Metadata } from "next";
import { Highlight } from "@/components/ui";

export const metadata: Metadata = {
  title: "About",
  description: "NeoBase is an independent intelligence platform for the global neobank and crypto exchange ecosystem.",
};

export default function AboutPage() {
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>About</p>
        <h1 className="display">
          Independent <Highlight>fintech intelligence</Highlight>.
        </h1>
        <div className="stack-16" style={{ marginTop: 24 }}>
          <p className="lead">
            NeoBase tracks the global neobank and crypto exchange ecosystem. We aggregate user reviews,
            app-store ratings and market signals to give an unbiased, always-current view of how each
            company is really performing.
          </p>
          <p className="lead">
            The public directory is free. Underneath it sits a monitoring platform: pick a country and a
            few competitors, and get daily-updated data plus AI summaries of what changed — pricing,
            plans, media coverage and sentiment.
          </p>
        </div>
      </div>
    </main>
  );
}
