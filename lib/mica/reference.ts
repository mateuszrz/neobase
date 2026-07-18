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

export function micaService(token: string): MicaService {
  return MICA_SERVICES[token] ?? { letter: "•", name: token, desc: "" };
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
