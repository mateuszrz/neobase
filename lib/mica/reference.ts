/**
 * MiCA reference data — the 10 crypto-asset services (with plain-language
 * descriptions) and full regulator names — used to enrich the licence panel.
 * Keyed by the short service/regulator tokens stored in casp_providers.
 */

export interface MicaService {
  letter: string;
  name: string;
  desc: string;
}

/** The 10 MiCA crypto-asset services (a–j), keyed by the CSV/registry short token. */
export const MICA_SERVICES: Record<string, MicaService> = {
  Custody: { letter: "A", name: "Custody & administration of crypto-assets", desc: "Safekeeping and administration of crypto-assets on behalf of clients." },
  "Trading platform": { letter: "B", name: "Operation of a trading platform", desc: "Running a marketplace where clients can trade crypto-assets." },
  "Crypto<->cash": { letter: "C", name: "Exchange of crypto-assets for funds", desc: "Exchanging crypto-assets for fiat currency." },
  "Crypto<->crypto": { letter: "D", name: "Exchange of crypto-assets for other crypto-assets", desc: "Exchanging one crypto-asset for another." },
  "Order execution": { letter: "E", name: "Execution of orders on behalf of clients", desc: "Executing buy/sell orders for crypto-assets for clients." },
  Placing: { letter: "F", name: "Placing of crypto-assets", desc: "Marketing or placing crypto-assets on behalf of an issuer or offeror." },
  "Order routing": { letter: "G", name: "Reception & transmission of orders", desc: "Receiving and passing on client orders for crypto-assets." },
  Advice: { letter: "H", name: "Advice on crypto-assets", desc: "Providing personalised recommendations on crypto-assets." },
  "Portfolio mgmt": { letter: "I", name: "Portfolio management", desc: "Managing crypto-asset portfolios on a discretionary basis." },
  Transfers: { letter: "J", name: "Transfer services for crypto-assets", desc: "Transferring crypto-assets on behalf of clients." },
};

/**
 * A MiCA service by its register token.
 *
 * The letter (A–J) is regulatory shorthand and never translated; the name and
 * description are prose, so callers on a localised page pass a `translate`
 * lookup into the `micaServices` catalog. Without one — scripts, cron jobs —
 * the English defaults below are used.
 */
export function micaService(token: string, translate?: (key: "name" | "desc") => string): MicaService {
  const base = MICA_SERVICES[token] ?? { letter: "•", name: token, desc: "" };
  if (!translate) return base;
  try {
    return { letter: base.letter, name: translate("name"), desc: translate("desc") };
  } catch {
    return base; // unknown token — no catalog entry, fall back to English
  }
}

/** Full national-competent-authority names for the regulator abbreviations we see. */
export const REGULATORS: Record<string, string> = {
  BaFin: "Federal Financial Supervisory Authority (BaFin)",
  AMF: "Autorité des marchés financiers (AMF)",
  AFM: "Authority for the Financial Markets (AFM)",
  MFSA: "Malta Financial Services Authority (MFSA)",
  CySEC: "Cyprus Securities and Exchange Commission (CySEC)",
  FMA: "Financial Market Authority (FMA)",
  CNMV: "Comisión Nacional del Mercado de Valores (CNMV)",
  CBI: "Central Bank of Ireland (CBI)",
  CSSF: "Commission de Surveillance du Secteur Financier (CSSF)",
  FSC: "Financial Supervision Commission (FSC)",
  CNB: "Czech National Bank (CNB)",
  Finanstilsynet: "Finanstilsynet",
};

/** Full regulator name for an abbreviation, falling back to the abbreviation itself. */
export const regulatorName = (abbr: string): string => REGULATORS[abbr] ?? abbr;

/**
 * The EU/EEA member states a MiCA licence passports into (EU-27 + the three EEA
 * states Iceland, Liechtenstein, Norway) — the same set for every authorised CASP.
 */
export const EU_EEA_MEMBERS: string[] = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France",
  "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg",
  "Malta", "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
];

/** MiCA passporting: a CASP licensed in one member state can serve the whole EU/EEA. */
export const EU_EEA_COUNTRIES = EU_EEA_MEMBERS.length;

/** Country name → ISO-3166 alpha-2 for the EU/EEA members that appear in the register. */
export const COUNTRY_ISO: Record<string, string> = {
  Austria: "AT", Belgium: "BE", Bulgaria: "BG", Croatia: "HR", Cyprus: "CY",
  Czechia: "CZ", Denmark: "DK", Estonia: "EE", Finland: "FI", France: "FR",
  Germany: "DE", Greece: "GR", Hungary: "HU", Iceland: "IS", Ireland: "IE",
  Italy: "IT", Latvia: "LV", Liechtenstein: "LI", Lithuania: "LT", Luxembourg: "LU",
  Malta: "MT", Netherlands: "NL", Norway: "NO", Poland: "PL", Portugal: "PT",
  Romania: "RO", Slovakia: "SK", Slovenia: "SI", Spain: "ES", Sweden: "SE",
};

/** Emoji flag for a country name (🌍 if unmapped). */
export function countryFlag(name: string): string {
  const iso = COUNTRY_ISO[name];
  if (!iso) return "🌍";
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Auto-generated MiCA FAQ for an exchange, from its ESMA-register status. SEO-friendly Q&A. */
export function micaFaqs(
  name: string,
  mica: { licensed: boolean; legalEntity: string | null; country: string | null; regulator: string | null; services: string[] },
  /** Set when the register row belongs to a successor entity, not to this brand. */
  successor?: { entity: string; brand: string; note: string } | null,
): { q: string; a: string }[] {
  // The register row is real, but it is not this brand's licence. Answering
  // "yes, and it may serve clients EU-wide" would be false — and these answers
  // are the ones that end up in FAQ rich results.
  if (mica.licensed && successor) {
    const reg = regulatorName(mica.regulator ?? "");
    return [
      { q: `Does ${name} have a MiCA licence?`, a: `Not any more. ${successor.note} The authorisation is registered to ${successor.entity}, which trades as ${successor.brand}, regulated by ${reg} in ${mica.country}.` },
      { q: `Can I still use ${name}?`, a: `No. ${name} no longer serves customers. The MiCA-authorised business of the group operates under the ${successor.brand} brand instead.` },
      { q: `Who holds ${name}'s former MiCA authorisation?`, a: `${successor.entity} holds the CASP authorisation in the ESMA register, supervised by ${reg} in ${mica.country}. It trades as ${successor.brand}.` },
      { q: `Is a MiCA licence the same as a CASP licence?`, a: `Yes. MiCA (MiCAR) is the EU regulation; a CASP (crypto-asset service provider) is a firm it licenses. "MiCA register", "CASP register" and "ESMA register" all refer to the same official list.` },
    ];
  }
  if (mica.licensed) {
    const reg = regulatorName(mica.regulator ?? "");
    const svc = mica.services.map((t) => micaService(t).name).join(", ");
    return [
      { q: `Does ${name} have a MiCA licence?`, a: `Yes. ${name}${mica.legalEntity ? ` (legal entity ${mica.legalEntity})` : ""} holds a MiCA crypto-asset service provider (CASP) authorisation, regulated by ${reg} in ${mica.country} and listed in the official ESMA register.` },
      { q: `Who regulates ${name} in the EU?`, a: `${name}'s EU activity is authorised and supervised by ${reg}, its home national competent authority under MiCA.` },
      { q: `Which crypto services is ${name} licensed for?`, a: `Under MiCA, ${name} is authorised for: ${svc}.` },
      { q: `In which countries can I legally use ${name}?`, a: `A MiCA authorisation passports across the whole EU/EEA, so ${name} may legally serve clients in all ${EU_EEA_COUNTRIES} EU/EEA member states.` },
      { q: `Is ${name} in the ESMA register?`, a: `Yes. ${mica.legalEntity ?? name} appears in ESMA's official register of authorised MiCA crypto-asset service providers, recorded under ${reg}.` },
      { q: `Is a MiCA licence the same as a CASP licence?`, a: `Yes. MiCA (MiCAR) is the EU regulation; a CASP (crypto-asset service provider) is a firm it licenses. "MiCA register", "CASP register" and "ESMA register" all refer to the same official list.` },
    ];
  }
  return [
    { q: `Does ${name} have a MiCA licence?`, a: `No. ${name} is not listed in the EU's ESMA register of authorised crypto-asset service providers (CASPs). The MiCA transition period ended on 1 July 2026, so it may not be permitted to serve clients in the EU/EEA.` },
    { q: `Is ${name} in the ESMA register?`, a: `No. ${name} does not currently appear in ESMA's official MiCA register of authorised CASPs. Check the official register before trading from the EU/EEA.` },
  ];
}
