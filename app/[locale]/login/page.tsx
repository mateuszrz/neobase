import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeRedirect as redirect } from "@/lib/i18n/redirect";
import { auth, signIn } from "@/lib/auth";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in → straight to the panel.
  const session = await auth();
  if (session?.user) return redirect("/panel/");

  const t = await getTranslations("login");

  async function sendLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("email", { email, redirectTo: "/panel" });
  }

  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: 420 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>{t("account")}</p>
        <h1 className="display" style={{ fontSize: "2rem" }}>{t("title")}</h1>
        <p className="lead" style={{ marginTop: 16, marginBottom: 28, fontSize: 16 }}>{t("lead")}</p>
        <form action={sendLink} className="stack-8">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t("placeholder")}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid var(--hairline, #e5e0d8)",
              fontSize: 15,
            }}
          />
          <button className="btn btn-cyan" style={{ width: "100%", justifyContent: "center" }} type="submit">
            {t("submit")}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6 }}>
          {t.rich("consent", {
            terms: (c) => (
              <Link href="/terms/" style={{ color: "var(--cyan-edge)" }}>
                {c}
              </Link>
            ),
            privacy: (c) => (
              <Link href="/privacy/" style={{ color: "var(--cyan-edge)" }}>
                {c}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
