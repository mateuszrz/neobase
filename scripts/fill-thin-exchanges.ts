/**
 * Hand-verified backfill for the exchanges that scripts/refresh-from-about.ts
 * can't reach — their sites bot-block or geo-block the fetcher, so no automated
 * pass will ever fill them. Every value below was checked by hand against an
 * authoritative source (national business register, AMF/MFSA/AFM register,
 * the company's own blog) and the source is cited inline.
 *
 * Fields we could NOT verify to that standard are deliberately left out:
 * `employees` (only headcount bands published anywhere) and, for Bitmymoney,
 * `founded` (the service dates from 2013 but the B.V. was incorporated in
 * 2016 — a genuine conflict, so we show nothing).
 *
 * These ids are also pinned in the VERIFIED map in scripts/audit-confidence.ts
 * so the trust gate shows them instead of re-judging them every run.
 *
 *   npm run data:fill-thin
 *   npm run data:fill-thin -- --dry
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";

const DRY = process.argv.slice(2).includes("--dry");

type Fill = {
  country?: string;
  founded?: number;
  headquarters?: string;
  status?: string;
  licenses?: string[];
  description?: string;
  about?: string;
};

const FILLS: Record<string, Fill> = {
  // ARES/justice.cz (IČO 07055285, entered 19 Apr 2018) · EU CASP register
  // (MP Developers s.r.o., CNB, authorised 11 Feb 2026) · cs.wikipedia.org/wiki/Anycoin
  anycoin: {
    country: "CZ",
    founded: 2018,
    headquarters: "Prague, Czechia",
    status: "active",
    licenses: ["CNB (CZ) - MiCA CASP licence"],
    description:
      "Anycoin is a Czech cryptocurrency exchange and brokerage operated by MP Developers s.r.o., authorised by the Czech National Bank as a MiCA crypto-asset service provider.",
    about:
      "Anycoin is a Czech crypto-asset platform operated by MP Developers s.r.o., a company registered in Prague. It lets users buy, sell and store cryptocurrencies funded in Czech koruna and euro. In February 2026 it was authorised by the Czech National Bank as a crypto-asset service provider under MiCA, covering custody, operation of a trading platform, crypto-to-cash and crypto-to-crypto exchange, and order execution.",
  },

  // KvK 67547893 (Bitmymoney B.V., 's-Gravenhage) · HSD Campus tenant listing ·
  // company blog: AFM MiCAR licence granted 20 Nov 2025 (replacing the Nov 2020
  // DNB registration). `founded` withheld: service "since 2013" vs B.V. 2016.
  bitmymoney: {
    country: "NL",
    headquarters: "The Hague, Netherlands",
    status: "active",
    licenses: ["AFM (NL) - MiCA CASP licence"],
    description:
      "Bitmymoney is a Dutch crypto broker based in The Hague that lets customers buy, sell and hold Bitcoin, Ethereum and tokenised gold through a euro-denominated account.",
    about:
      "Bitmymoney is operated by Bitmymoney B.V., registered with the Dutch Chamber of Commerce under number 67547893 and based at the HSD Campus in The Hague. It works as a broker rather than an order-book exchange, settling trades at market price for customers funding by iDEAL. It was registered with De Nederlandsche Bank as a crypto service provider in November 2020, and that registration was replaced by a MiCA licence from the AFM on 20 November 2025 covering custody, exchange of crypto for funds, exchange of crypto for crypto and transfer services.",
  },

  // AMF white list (MERIA SAS, MiCA CASP A2026-020, 22 Jun 2026) ·
  // annuaire-entreprises.data.gouv.fr (SIREN 829 840 735, created 9 May 2017, Metz)
  meria: {
    country: "FR",
    founded: 2017,
    headquarters: "Metz, France",
    status: "active",
    licenses: ["AMF (FR) - MiCA CASP licence", "AMF (FR) - PSAN registration"],
    description:
      "Meria is a French crypto-asset platform, formerly Just Mining, offering buying, selling, custody, staking and portfolio management of digital assets to retail and professional clients.",
    about:
      "Meria SAS is a Metz-based French company founded in 2017 as Just Mining, originally selling mining hardware before shifting to staking and crypto investment services. It rebranded to Meria in December 2022. Registered as a PSAN with the AMF in 2021, it obtained a full MiCA crypto-asset service provider licence from the AMF in June 2026, covering custody, exchange for cash, order execution, advice, portfolio management and transfers.",
  },

  // AMF white list (Zillion Bits Limited, home member state Malta, MFSA) ·
  // LinkedIn company page (founded 2018, Birkirkara). The historic ZB Group
  // origin and the pre-MiCA VFA Class 4 licence are deliberately omitted —
  // neither could be corroborated to the standard the rest of this file uses.
  zbx: {
    country: "MT",
    founded: 2018,
    headquarters: "Birkirkara, Malta",
    status: "active",
    licenses: ["MFSA (MT) - MiCA CASP licence"],
    description:
      "ZBX is a Malta-based crypto-asset exchange operated by Zillion Bits Limited and authorised by the MFSA as a crypto-asset service provider under MiCA.",
    about:
      "ZBX is a fiat-enabled digital-asset trading platform run by Zillion Bits Limited, a Maltese company headquartered in Birkirkara and established in 2018. It is authorised by the Malta Financial Services Authority as a crypto-asset service provider under MiCA, with one of the broadest service sets in the register: custody, operation of a trading platform, crypto-to-cash and crypto-to-crypto exchange, order execution, placing, reception and transmission of orders, and transfers.",
  },
};

for (const [id, fill] of Object.entries(FILLS)) {
  const keys = Object.keys(fill);
  console.log(`✎ ${id}: ${keys.join(", ")}`);
  if (DRY) continue;
  await db
    .update(schema.fintechs)
    .set({ ...fill, updatedAt: new Date() } as any)
    .where(eq(schema.fintechs.id, id));
}
console.log(`\ndone. ${Object.keys(FILLS).length} exchanges${DRY ? " (dry)" : " filled"}`);
process.exit(0);
