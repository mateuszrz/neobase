/**
 * generate.js — NeoBase Static HTML Generator
 * 
 * Uruchamiaj przed deployem: node generate.js
 * Generuje statyczne pliki HTML dla każdej trasy projektu,
 * dzięki czemu Google i inne boty dostają pełny HTML bez JS.
 * 
 * Wymagania: node >= 18 (fetch built-in)
 * Zależności: brak zewnętrznych
 */

const fs = require("fs");
const path = require("path");

// ─── Konfiguracja ────────────────────────────────────────────────────────────

const API_BASE = "https://neobase.co/api.php";
const INDEX_HTML = path.join(__dirname, "index.html");
const OUT_DIR = __dirname; // pliki lądują obok index.html

const SITE_URL = "https://neobase.co";
const DEFAULT_LANG = "en";

// Aktywne języki i ich prefiksy URL (z app.js: mv)
const LANGUAGES = [
  { code: "en", urlPrefix: "", isDefault: true },
  // Odkomentuj gdy aktywujesz inne języki:
  // { code: "pl", urlPrefix: "/pl" },
  // { code: "de", urlPrefix: "/de" },
  // { code: "fr", urlPrefix: "/fr" },
  // { code: "es", urlPrefix: "/es" },
];

// ─── Pobieranie danych z API ──────────────────────────────────────────────────

async function fetchData(type) {
  try {
    const res = await fetch(`${API_BASE}?t=${type}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`  ✓ API: ${type} (${Array.isArray(data) ? data.length : "ok"} records)`);
    return data;
  } catch (err) {
    console.warn(`  ⚠ API ${type} niedostępne (${err.message}), używam pustej tablicy`);
    return [];
  }
}

// ─── Czytanie base index.html ─────────────────────────────────────────────────

function readTemplate() {
  if (!fs.existsSync(INDEX_HTML)) {
    throw new Error(`Nie znaleziono ${INDEX_HTML}`);
  }
  return fs.readFileSync(INDEX_HTML, "utf8");
}

// ─── Budowanie meta tagów ─────────────────────────────────────────────────────

function buildMeta({ title, description, image, url, type = "website", lang = "en" }) {
  const fullUrl = `${SITE_URL}${url}`;
  const img = image || `${SITE_URL}/og-default.png`;

  return `
    <title>${escHtml(title)}</title>
    <meta name="description" content="${escHtml(description)}">
    <link rel="canonical" href="${fullUrl}">
    <meta property="og:title" content="${escHtml(title)}">
    <meta property="og:description" content="${escHtml(description)}">
    <meta property="og:image" content="${img}">
    <meta property="og:url" content="${fullUrl}">
    <meta property="og:type" content="${type}">
    <meta property="og:locale" content="${lang}_${lang.toUpperCase()}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escHtml(title)}">
    <meta name="twitter:description" content="${escHtml(description)}">
    <meta name="twitter:image" content="${img}">`.trim();
}

function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Wstrzykiwanie meta do HTML ───────────────────────────────────────────────

function injectMeta(template, meta) {
  // Usuwa stare <title> i <meta name="description"> z template
  let html = template
    .replace(/<title>.*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/i, "");

  // Wstrzykuje nowe meta za <head>
  html = html.replace(/(<head[^>]*>)/i, `$1\n    ${meta}\n`);
  return html;
}

// ─── Zapis pliku ──────────────────────────────────────────────────────────────

function writeHtml(urlPath, html) {
  // /bank/revolut/ → OUT_DIR/bank/revolut/index.html
  const rel = urlPath.replace(/^\//, "").replace(/\/$/, "");
  const dir = rel ? path.join(OUT_DIR, rel) : OUT_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "index.html");
  fs.writeFileSync(file, html, "utf8");
  console.log(`  ✓ ${urlPath || "/"}`);
}

// ─── Definicje stron ──────────────────────────────────────────────────────────

function getStaticPages() {
  return [
    {
      url: "/",
      title: "NeoBase — Global Neobank & Fintech Directory 2026",
      description:
        "Compare ratings, track sentiment, and research the world's best fintech alternatives to traditional banking — all in one place.",
    },
    {
      url: "/about/",
      title: "About NeoBase — Independent Fintech Intelligence Platform",
      description:
        "NeoBase is an independent directory and intelligence platform for the global neobank ecosystem.",
    },
    {
      url: "/news/",
      title: "Fintech & Neobank News — NeoBase",
      description:
        "Latest news, analysis and updates from the global fintech and neobank industry.",
    },
    {
      url: "/exchanges/",
      title: "Crypto Exchanges Directory — NeoBase",
      description:
        "Compare top cryptocurrency exchanges by rating, volume and user sentiment.",
    },
    {
      url: "/contact/",
      title: "Contact NeoBase",
      description: "Get in touch with the NeoBase team.",
    },
    {
      url: "/terms/",
      title: "Terms of Service — NeoBase",
      description: "NeoBase terms of service and usage policy.",
    },
    {
      url: "/privacy/",
      title: "Privacy Policy — NeoBase",
      description: "NeoBase privacy policy and data protection information.",
    },
  ];
}

// ─── Główna funkcja ───────────────────────────────────────────────────────────

async function generate() {
  console.log("\n🚀 NeoBase Static HTML Generator\n");

  const template = readTemplate();

  // Pobierz dane
  console.log("📡 Pobieranie danych z API...");
  const [banks, exchanges, news] = await Promise.all([
    fetchData("banks"),
    fetchData("exchanges"),
    fetchData("news"),
  ]);

  console.log("\n📄 Generowanie stron...");

  // ── Strony statyczne ──
  for (const page of getStaticPages()) {
    const meta = buildMeta({
      title: page.title,
      description: page.description,
      url: page.url,
    });
    writeHtml(page.url, injectMeta(template, meta));
  }

  // ── Strony banków: /bank/[id]/ ──
  for (const bank of banks) {
    if (!bank?.id) continue;

    const name = bank.name || bank.id;
    const country = bank.country ? ` (${bank.country})` : "";
    const score = bank.neobaseScore || bank.score || "";

    const meta = buildMeta({
      title: `${name} Review 2026 — NeoBase${score ? ` | Score: ${score}` : ""}`,
      description: `${name}${country} — compare ratings, user reviews and sentiment analysis on NeoBase.${bank.description ? " " + bank.description.slice(0, 100) : ""}`,
      image: bank.logoUrl || null,
      url: `/bank/${bank.id}/`,
      type: "profile",
    });
    writeHtml(`/bank/${bank.id}/`, injectMeta(template, meta));
  }

  // ── Strony exchange: /exchange/[id]/ ──
  for (const ex of exchanges) {
    if (!ex?.id) continue;

    const name = ex.name || ex.id;
    const meta = buildMeta({
      title: `${name} Review 2026 — Crypto Exchange | NeoBase`,
      description: `${name} — compare ratings, fees and user sentiment on NeoBase crypto exchange directory.`,
      image: ex.logoUrl || null,
      url: `/exchange/${ex.id}/`,
      type: "profile",
    });
    writeHtml(`/exchange/${ex.id}/`, injectMeta(template, meta));
  }

  // ── Strony news: /news/[id]/ ──
  for (const article of news) {
    if (!article?.id) continue;

    const title = article.title || article.id;
    const meta = buildMeta({
      title: `${title} — NeoBase News`,
      description: article.excerpt || article.description || title,
      image: article.image || null,
      url: `/news/${article.id}/`,
      type: "article",
    });
    writeHtml(`/news/${article.id}/`, injectMeta(template, meta));
  }

  // ── Strony tagów: /tag/[slug]/ ──
  // Wyciągnij unikalne tagi ze wszystkich banków
  const allTags = [...new Set(banks.flatMap((b) => b.tags || []))];
  for (const tag of allTags) {
    if (!tag) continue;
    const meta = buildMeta({
      title: `${tag} Neobanks & Fintechs — NeoBase`,
      description: `Browse all fintech companies tagged "${tag}" on NeoBase.`,
      url: `/tag/${tag}/`,
    });
    writeHtml(`/tag/${tag}/`, injectMeta(template, meta));
  }

  // ── Strony krajów: /country/[code]/ ──
  const allCountries = [...new Set(banks.map((b) => b.country).filter(Boolean))];
  for (const country of allCountries) {
    const meta = buildMeta({
      title: `Neobanks in ${country} — NeoBase`,
      description: `Compare fintech companies and neobanks based in ${country} on NeoBase.`,
      url: `/country/${country}/`,
    });
    writeHtml(`/country/${country}/`, injectMeta(template, meta));
  }

  // ── Podsumowanie ──
  const total =
    getStaticPages().length +
    banks.length +
    exchanges.length +
    news.length +
    allTags.length +
    allCountries.length;

  console.log(`\n✅ Wygenerowano ${total} stron HTML\n`);
}

generate().catch((err) => {
  console.error("❌ Błąd generatora:", err);
  process.exit(1);
});
