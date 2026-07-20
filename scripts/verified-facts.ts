/**
 * Hand-verified facts. Pure data, no side effects — imported by both
 * scripts/fill-thin-exchanges.ts (which writes them) and
 * scripts/audit-confidence.ts (which trusts them instead of re-judging them),
 * so the two can't drift apart.
 *
 * Every value here was checked by hand against an authoritative source, cited
 * inline. Anything we couldn't pin down to that standard is absent on purpose —
 * an empty field is always better than a wrong one.
 */

export type Fill = {
  country?: string;
  founded?: number;
  headquarters?: string;
  status?: string;
  licenses?: string[];
  description?: string;
  about?: string;
};

/**
 * The four exchanges scripts/refresh-from-about.ts can never reach — their
 * sites bot-block or geo-block the fetcher, so no automated pass will fill them.
 *
 * Deliberately absent: `employees` everywhere (only headcount bands are
 * published anywhere) and Bitmymoney's `founded` (the service dates from 2013
 * but the B.V. was incorporated in 2016 — a genuine conflict).
 */
export const FILLS: Record<string, Fill> = {
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
  // DNB registration).
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

/**
 * Founding years for the exchanges that had none. This is the year the BRAND
 * was founded, not the year an EU subsidiary was incorporated to hold the MiCA
 * licence — most of these entities are 2025/2026 vehicles and would give a
 * badly misleading answer.
 *
 * Four exchanges are missing on purpose, each with an unresolved conflict:
 *   ari10     — KRS entry 2020 vs brand's "since 2017" vs predecessor Bitcan 2019
 *   criptan   — Registro Mercantil 2018 vs press dating the launch to Jan 2019
 *   cryptonow — group "since 2017" vs retail brand 2019 vs Cryptonow Group AG 2023
 *   deblock   — DEBLOCK SAS incorporated Jan 2023 vs press reporting a 2022 founding
 */
export const FOUNDED: Record<string, number> = {
  "21bitcoin": 2021, // Firmenbuch FN 556789h, FIOR Digital GmbH entered 15 May 2021
  backpack: 2022, // learn.backpack.exchange history; the exchange itself launched 2023-24
  bitstack: 2021, // SIREN 899125090 created 10 May 2021, matches press (Apr 2021)
  blox: 2018, // KvK 71663533, Blox B.V. incorporated 16 May 2018 (parent BTC Direct is 2013)
  coinfinity: 2014, // Firmenbuch FN 415803a, 8 May 2014; company press says April 2014
  coinflip: 2015, // CoinFlip brand, Chicago, 2015 — OLLIV ITALIA S.R.L. is a later subsidiary
  coinhouse: 2014, // brand lineage from La Maison du Bitcoin, 2014 (COINHOUSE SAS entity is 2015)
  conio: 2015, // own about page + Poste Italiane seed-round coverage
  cryptosmart: 2021, // CRYPTOSMART S.p.A. incorporated 9 Feb 2021, matches own about page
  firi: 2017, // Brønnøysund: Firi AS founded 6 Nov 2017 (renamed from MiraiEx in 2021)
  fumbi: 2018, // FUMBI NETWORK j.s.a. registered 30 Oct 2018 (Bratislava)
  "kanga-exchange": 2018, // Polish brand founded 2018; SIA AlphaRoute is the 2025 MiCA entity
  kriptomat: 2020, // Bitblock d.o.o. (OIB 10607405244) founded 4 Jun 2020 — the Croatian ATM
  // operator, NOT the Slovenian Kriptomat.io
  neverless: 2022, // brand founded 2022 in London; Neverless SIA is the later Latvian entity
  simplecoin: 2013, // Simple Coin s.r.o., IČO 01516558, incorporated 20 Mar 2013
  "sling-money": 2022, // AVIAN LABS LTD (CH 13941760) incorporated 25 Feb 2022
  strike: 2020, // Strike launched Jan 2020; parent Zap is older but is a different product
  "trading-212": 2004, // founded in Sofia as Avus Capital; the Trading 212 brand dates to 2013
  tradu: 2023, // Tradu brand launched Nov 2023 by Stratos/Jefferies (the entity is FXCM lineage)
  whitebit: 2018, // founded 2018 in Kharkiv by Volodymyr Nosov; the Austrian GmbH is a later
  // EU/MiCA entity
  "young-platform": 2018, // founded 2018 in Turin (CEO Andrea Ferrero)
};
