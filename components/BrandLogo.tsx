"use client";

import { useState } from "react";

/**
 * Brand logo tile with a graceful fallback. Renders the logo image, but if the
 * src is missing OR the URL fails to load (some fintechs have dead logo URLs),
 * it falls back to a monogram tile — so a broken image never shows.
 */

function monogram(name: string): string {
  const s = name.replace(/[^a-z0-9]/gi, "");
  return (s.slice(0, 2) || "?").toUpperCase();
}

export function BrandLogo({
  src,
  name,
  size = 44,
  radius = "var(--r-icon)",
}: {
  src?: string | null;
  name: string;
  size?: number;
  radius?: number | string;
}) {
  const [broken, setBroken] = useState(false);
  const box = {
    width: size,
    height: size,
    borderRadius: radius,
    flex: "none" as const,
    background: "var(--stone-canvas)",
    border: "1px solid var(--stone-border)",
  };

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        // Also catch images that already failed before hydration (onError won't
        // re-fire) or that load a 200 with no pixels — check naturalWidth.
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth === 0) setBroken(true);
        }}
        ref={(el) => {
          if (el && el.complete && el.naturalWidth === 0) setBroken(true);
        }}
        style={{ ...box, objectFit: "contain" }}
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
