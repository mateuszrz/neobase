/**
 * The "your report is unlocked" email, sent after a lead enters their address on
 * the teaser page. Links back to the full report and teases the weekly cadence.
 */

import { sendEmail } from "@/lib/email";

export async function sendReportEmail(to: string, id: string, brand: string, baseUrl: string): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, "")}/test/${id}/`;
  const subject = `Your competitive brief on ${brand} is ready`;
  return sendEmail({
    to,
    subject,
    html: reportHtml(brand, url),
    text: `Your weekly competitive brief on ${brand} is unlocked:\n${url}\n\nIt covers competitor moves, products & partnerships, marketing signals, risks and recommendations — grounded in real ratings and sentiment data.\n\nWant this in your inbox every week? Just reply and let us know.`,
  });
}

function reportHtml(brand: string, url: string): string {
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="font-weight:600;margin:0 0 12px">Your brief on ${brand} is unlocked</h2>
    <p style="margin:0 0 20px;color:#555;line-height:1.6">
      The full report covers competitor moves, products &amp; partnerships, marketing signals,
      risks and recommendations — grounded in real cross-platform ratings and customer sentiment.
    </p>
    <a href="${url}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Open the full report</a>
    <p style="margin:24px 0 0;color:#999;font-size:13px">Want this every week? Just reply and let us know which markets matter.</p>
  </div>`;
}
