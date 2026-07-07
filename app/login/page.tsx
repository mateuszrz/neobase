import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your NeoBase account.",
};

export default async function LoginPage() {
  // Already signed in → straight to the panel.
  const session = await auth();
  if (session?.user) redirect("/panel");

  async function sendLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("email", { email, redirectTo: "/panel" });
  }

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 420 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Account</p>
        <h1 className="display" style={{ fontSize: "2rem" }}>Sign in to NeoBase</h1>
        <p className="lead" style={{ marginTop: 16, marginBottom: 28, fontSize: 16 }}>
          Enter your email and we&apos;ll send you a magic link — no password needed.
        </p>
        <form action={sendLink} className="stack-8">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid var(--hairline, #e5e0d8)",
              fontSize: 15,
            }}
          />
          <button className="btn btn-cyan" style={{ width: "100%", justifyContent: "center" }} type="submit">
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
