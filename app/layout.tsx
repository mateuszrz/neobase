import type { ReactNode } from "react";

/**
 * Pass-through root. `<html>`/`<body>` live in app/[locale]/layout.tsx, which
 * needs the resolved locale to set `lang`. Every route sits under [locale]
 * (English is unprefixed), so that layout always runs.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
