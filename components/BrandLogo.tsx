"use client";

import { useState } from "react";

/**
 * Brand logo tile with a graceful fallback chain. Prefers the site's own
 * favicon (fetched by domain), then the stored logo image, then a monogram —
 * so a broken/missing icon never shows. Favicons make the directory feel like
 * the real brands rather than generic tiles.
 */

function monogram(name: string): string {
  const s = name.replace(/[^a-z0-9]/gi, "");
  return (s.slice(0, 2) || "?").toUpperCase();
}

/** DuckDuckGo icon service — returns the real favicon, or a clean 404 (→ onError
 *  falls through to the stored logo) when a domain has none. */
function faviconUrl(website?: string | null): string | null {
  if (!website) return null;
  const host = website
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();
  if (!host || !host.includes(".")) return null;
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

export function BrandLogo({
  src,
  website,
  name,
  size = 44,
  radius = "var(--r-icon)",
}: {
  src?: string | null;
  website?: string | null;
  name: string;
  size?: number;
  radius?: number | string;
}) {
  // Ordered fallback: favicon → stored logo → monogram.
  const sources = [faviconUrl(website), src].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  const current = sources[idx];

  const box = {
    width: size,
    height: size,
    borderRadius: radius,
    flex: "none" as const,
    background: "var(--stone-canvas)",
    border: "1px solid var(--stone-border)",
  };

  if (current) {
    return (
      <img
        key={current}
        src={current}
        alt=""
        loading="lazy"
        onError={() => setIdx((i) => i + 1)}
        // Also catch images that already failed before hydration (onError won't
        // re-fire) or that load a 200 with no pixels — check naturalWidth.
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth === 0) setIdx((i) => i + 1);
        }}
        ref={(el) => {
          if (el && el.complete && el.naturalWidth === 0) setIdx((i) => i + 1);
        }}
        style={{ ...box, objectFit: "contain", padding: Math.round(size * 0.14) }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        ...box,
        display: "grid",
        placeItems: "center",
        color: "var(--warm-gray)",
        fontWeight: 600,
        fontSize: Math.round(size * 0.4),
        letterSpacing: "-0.02em",
      }}
    >
      {monogram(name)}
    </span>
  );
}
