/**
 * Magic-link email delivery for Auth.js.
 *
 * If RESEND_API_KEY is set, sends the sign-in link via the Resend HTTP API (no
 * SDK — a single fetch). Otherwise it falls back to logging the link to the
 * server console, so the whole flow is usable in dev without any email account.
 */

import type { EmailConfig } from "next-auth/providers";

interface VerificationParams {
  identifier: string; // recipient email
  url: string; // magic-link URL
  provider: EmailConfig;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendVerificationRequest(params: VerificationParams): Promise<void> {
  const { identifier: to, url } = params;
  const from = process.env.EMAIL_FROM || "NeoBase <login@neobase.co>";
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev fallback — no email provider configured.
    console.log(`\n🔑 NeoBase magic link for ${to}:\n${url}\n`);
    return;
  }

  const host = new URL(url).host;
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `Sign in to NeoBase`,
      html: signInHtml(url, host),
      text: `Sign in to NeoBase:\n${url}\n\nIf you didn't request this, ignore this email.`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed (${res.status}): ${await res.text()}`);
  }
}

function signInHtml(url: string, host: string): string {
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="font-weight:600;margin:0 0 12px">Sign in to NeoBase</h2>
    <p style="margin:0 0 20px;color:#555">Click the button below to sign in to <strong>${host}</strong>. This link expires in 24 hours.</p>
    <a href="${url}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Sign in</a>
    <p style="margin:24px 0 0;color:#999;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
  </div>`;
}
