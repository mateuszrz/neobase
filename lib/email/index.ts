/**
 * Minimal transactional-email helper. Mirrors lib/auth/email-provider: if
 * RESEND_API_KEY is set it sends via the Resend HTTP API (a single fetch, no
 * SDK); otherwise it logs to the server console so flows stay usable in dev
 * without an email account. Never throws to the caller — a failed send must not
 * break the user action that triggered it.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Send an email. Returns true if handed off to Resend (or logged in dev). */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const from = process.env.EMAIL_FROM || "NeoBase <hello@neobase.co>";
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`\n📧 [dev] email to ${msg.to} — "${msg.subject}"\n${msg.text}\n`);
    return true;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) {
      console.error(`Resend send failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send error:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
