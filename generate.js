/**
 * generate.js — NeoBase Static HTML Generator v3
 * Wyciąga dane z lokalnego app.js (hardkodowane vl/yl/cv)
 * zamiast odpytywać API podczas buildu.
 * Node >= 18, brak zewnętrznych zależności
 */

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://neobase.co";
const OUT_DIR = __dirname;
const APP_JS = path.join(__dirname, "app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function writeHtml(urlPath, html) {
  const rel = urlPath.replace(/^\//, "").replace(/\/$/, "");
  const dir = rel ? path.join(OUT_DIR, rel) : OUT_DIR;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
  console.log(`  ✓ ${urlPath || "/"}`);
}

// ─── Wyciąganie danych z app.js ───────────────────────────────────────────────
// app.js zawiera hardkodowane zmienne vl (banks), yl (exchanges), cv (news)
// w formacie: var vl=[{...},{...},...];
// Wyciągamy je przez prosty regex + JSON.parse

function extractArrayFromAppJs(source, varName) {
  // Spróbuj kilka wzorców (minifikacja może mieć różną postać)
  const patterns = [
    new RegExp(`\\b${varName}\\s*=\\s*(\\[.*?\\])(?=,|;|\\s*[a-zA-Z_$])`, "s"),
    new RegExp(`(?:var|let|const)\\s+${varName}\\s*=\\s*(\\[.*?\\])`, "s"),
  ];

  for (const re of patterns) {
    const m = source.match(re);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]);
        if (Array.isArray(parsed)) {
          console.log(`  ✓ Wyciągnięto ${varName}: ${parsed.length} rekordów`);
          return parsed;
        }
      } catch (e) {
        // spróbuj kolejny pattern
      }
    }
  }

  console.warn(`  ⚠ Nie udało się wyciągnąć ${varName} z app.js`);
  return [];
}

function loadDataFromAppJs() {
  if (!fs.existsSync(APP_JS)) {
    console.warn("  ⚠ app.js nie znaleziony — brak danych");
    return { banks: [], exchanges: [], news: [] };
  }

  const source = fs.readFileSync(APP_JS, "utf8");
  console.log(`  ✓ Wczytano app.js (${Math.round(source.length / 1024)} KB)`);

  const banks    = extractArrayFromAppJs(source, "vl");
  const exchanges = extractArrayFromAppJs(source, "yl");
  const news     = extractArrayFromAppJs(source, "cv");

  return { banks, exchanges, news };
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function layout({ title, description, url, image, bodyHtml, lang = "en" }) {
  const fullUrl = `${SITE_URL}${url}`;
  const img = image || `${SITE_URL}/og-default.png`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${fullUrl}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${img}">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${img}">
  <link rel="stylesheet" href="/styles.css">
  <style>
    body{font-family:system-ui,sans-serif;margin:0;background:#0a0a0f;color:#e2e8f0}
    .snav{display:flex;align-items:center;gap:16px;padding:16px 24px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)}
    .snav a{color:#94a3b8;text-decoration:none;font-size:14px}
    .snav a:first-child{font-weight:700;color:#fff;font-size:18px;margin-right:auto}
    .snav a:hover{color:#fff}
    .wrap{max-width:1100px;margin:0 auto;padding:40px 20px 80px}
    h1{font-size:clamp(1.5rem,4vw,2.4rem);font-weight:800;margin:0 0 12px}
    h2{font-size:1.3rem;font-weight:700;margin:32px 0 12px}
    p{line-height:1.7;color:#94a3b8;margin:0 0 16px}
    .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:rgba(99,102,241,.2);color:#818cf8;margin:0 4px 4px 0}
    .pill{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,.15);color:#34d399;border-radius:8px;padding:4px 12px;font-weight:700}
    .eheader{display:flex;align-items:center;gap:20px;margin-bottom:24px}
    .elogo{width:64px;height:64px;border-radius:12px;object-fit:contain;background:rgba(255,255,255,.06);padding:8px}
    .metarow{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;font-size:14px;color:#64748b}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:16px}
    .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px;display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;transition:border-color .2s}
    .card:hover{border-color:rgba(99,102,241,.5)}
    .clogo{width:44px;height:44px;border-radius:8px;object-fit:contain;background:rgba(255,255,255,.06)}
    .cinfo h3{margin:0 0 4px;font-size:.95rem;font-weight:700}
    .cinfo p{margin:0;font-size:12px;color:#64748b}
  </style>
</head>
<body>
<nav class="snav">
  <a href="/">NeoBase</a>
  <a href="/exchanges/">Exchanges</a>
  <a href="/news/">News</a>
  <a href="/about/">About</a>
</nav>
<main class="wrap">
${bodyHtml}
</main>
<script src="/app.js"></script>
</body>
</html>`;
}

// ─── Page builders ────────────────────────────────────────────────────────────

function cardHtml(href, logoUrl, name, sub) {
  return `<a class="card" href="${href}">
    ${logoUrl ? `<img class="clogo" src="${esc(logoUrl)}" alt="${esc(name)}" loading="lazy">` : ""}
    <div class="cinfo"><h3>${esc(name)}</h3><p>${esc(sub || "")}</p></div>
  </a>`;
}

function bankPage(bank) {
  const name = bank.name || bank.id;
  const score = bank.neobaseScore || bank.score || null;
  const country = bank.country || "";
  const desc = bank.description || bank.about || "";
  const tags = bank.tags || [];

  const body = `
<div class="eheader">
  ${bank.logoUrl ? `<img class="elogo" src="${esc(bank.logoUrl)}" alt="${esc(name)} logo" loading="lazy">` : ""}
  <div>
    <h1>${esc(name)}</h1>
    <div class="metarow">
      ${country ? `<span>🌍 ${esc(country)}</span>` : ""}
      ${score ? `<span class="pill">⭐ ${esc(String(score))}</span>` : ""}
    </div>
    ${tags.length ? tags.map(t => `<span class="badge">${esc(t)}</span>`).join("") : ""}
  </div>
</div>
${desc ? `<p>${esc(desc)}</p>` : ""}
<p>${esc(name)} is a fintech company${country ? ` based in ${esc(country)}` : ""}. Compare user ratings, app store reviews and sentiment analysis on NeoBase.</p>`;

  return {
    url: `/bank/${bank.id}/`,
    title: `${name} Review 2026 — NeoBase${score ? ` | Score: ${score}` : ""}`,
    description: `${name}${country ? ` (${country})` : ""} — ratings, reviews & sentiment. ${desc.slice(0, 100)}`,
    image: bank.logoUrl || null,
    bodyHtml: body,
  };
}

function exchangePage(ex) {
  const name = ex.name || ex.id;
  const score = ex.neobaseScore || ex.score || null;
  const desc = ex.description || ex.about || "";

  const body = `
<div class="eheader">
  ${ex.logoUrl ? `<img class="elogo" src="${esc(ex.logoUrl)}" alt="${esc(name)} logo" loading="lazy">` : ""}
  <div>
    <h1>${esc(name)}</h1>
    ${score ? `<div class="metarow"><span class="pill">⭐ ${esc(String(score))}</span></div>` : ""}
  </div>
</div>
${desc ? `<p>${esc(desc)}</p>` : ""}
<p>${esc(name)} is a cryptocurrency exchange. Compare fees, ratings and user sentiment on NeoBase.</p>`;

  return {
    url: `/exchange/${ex.id}/`,
    title: `${name} Review 2026 — Crypto Exchange | NeoBase`,
    description: `${name} — fees, ratings and user reviews. ${desc.slice(0, 100)}`,
    image: ex.logoUrl || null,
    bodyHtml: body,
  };
}

function newsPage(article) {
  const title = article.title || article.id;
  const body = article.body || article.content || article.excerpt || "";
  const excerpt = article.excerpt || article.description || body.slice(0, 200);
  const date = article.date || article.publishedAt || "";

  const bodyHtml = `
<h1>${esc(title)}</h1>
${date ? `<p style="font-size:13px;color:#475569">Published: ${esc(date)}</p>` : ""}
${body ? body.split("\n").filter(l => l.trim()).map(l => `<p>${esc(l)}</p>`).join("") : `<p>${esc(excerpt)}</p>`}`;

  return {
    url: `/news/${article.id}/`,
    title: `${title} — NeoBase News`,
    description: String(excerpt).slice(0, 160),
    image: article.image || null,
    bodyHtml,
  };
}

function tagPage(tag, banks) {
  const filtered = banks.filter(b => (b.tags || []).includes(tag));
  return {
    url: `/tag/${tag}/`,
    title: `${tag} Neobanks & Fintechs — NeoBase`,
    description: `Browse ${filtered.length} fintech companies tagged "${tag}" on NeoBase.`,
    bodyHtml: `<h1>${esc(tag)} Neobanks &amp; Fintechs</h1>
<p>${filtered.length} ${filtered.length === 1 ? "company" : "companies"} tagged "${esc(tag)}".</p>
<div class="grid">${filtered.map(b => cardHtml(`/bank/${b.id}/`, b.logoUrl, b.name || b.id, b.country)).join("\n")}</div>`,
  };
}

function countryPage(country, banks) {
  const filtered = banks.filter(b => b.country === country);
  return {
    url: `/country/${country}/`,
    title: `Neobanks in ${country} — NeoBase`,
    description: `Compare ${filtered.length} neobanks in ${country} on NeoBase.`,
    bodyHtml: `<h1>Neobanks in ${esc(country)}</h1>
<p>${filtered.length} fintech ${filtered.length === 1 ? "company" : "companies"} in ${esc(country)}.</p>
<div class="grid">${filtered.map(b => cardHtml(`/bank/${b.id}/`, b.logoUrl, b.name || b.id, (b.tags || []).slice(0, 2).join(", "))).join("\n")}</div>`,
  };
}

function homePage(banks, exchanges) {
  const topBanks = banks.slice(0, 12);
  const topEx = exchanges.slice(0, 6);
  return {
    url: "/",
    title: "NeoBase — Global Neobank & Fintech Directory 2026",
    description: "Compare ratings, track sentiment, and research the world's best fintech alternatives to traditional banking.",
    bodyHtml: `
<h1>Global Neobank &amp; Fintech Directory 2026</h1>
<p>Compare ratings, track sentiment, and research the world's best fintech alternatives to traditional banking — all in one place.</p>
${topBanks.length ? `<h2>Top Neobanks</h2>
<div class="grid">${topBanks.map(b => cardHtml(`/bank/${b.id}/`, b.logoUrl, b.name || b.id, (b.country || "") + (b.neobaseScore || b.score ? " · " + (b.neobaseScore || b.score) : ""))).join("\n")}</div>` : ""}
${topEx.length ? `<h2>Top Crypto Exchanges</h2>
<div class="grid">${topEx.map(ex => cardHtml(`/exchange/${ex.id}/`, ex.logoUrl, ex.name || ex.id, ex.country || "")).join("\n")}</div>` : ""}`,
  };
}

const STATIC_PAGES = [
  {
    url: "/about/",
    title: "About NeoBase — Independent Fintech Intelligence Platform",
    description: "NeoBase is an independent directory and intelligence platform for the global neobank ecosystem.",
    bodyHtml: `<h1>About NeoBase</h1>
<p>NeoBase is an independent fintech intelligence platform tracking the global neobank and crypto exchange ecosystem. We aggregate user reviews, app store ratings and market data to give you unbiased insights.</p>`,
  },
  {
    url: "/news/",
    title: "Fintech & Neobank News — NeoBase",
    description: "Latest news from the global fintech industry.",
    bodyHtml: `<h1>Fintech &amp; Neobank News</h1><p>Latest news and analysis from the global fintech industry.</p>`,
  },
  {
    url: "/exchanges/",
    title: "Crypto Exchanges Directory — NeoBase",
    description: "Compare top cryptocurrency exchanges by rating and user sentiment.",
    bodyHtml: `<h1>Crypto Exchanges Directory</h1><p>Compare top cryptocurrency exchanges on NeoBase.</p>`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generate() {
  console.log("\n🚀 NeoBase Static HTML Generator v3\n");

  console.log("📂 Wczytywanie danych z app.js...");
  const { banks, exchanges, news } = loadDataFromAppJs();
  console.log(`  Łącznie: ${banks.length} banków, ${exchanges.length} exchanges, ${news.length} news\n`);

  console.log("📄 Generowanie stron...");
  let count = 0;

  writeHtml("/", layout(homePage(banks, exchanges))); count++;
  for (const p of STATIC_PAGES) { writeHtml(p.url, layout(p)); count++; }
  for (const b of banks) { if (b?.id) { writeHtml(`/bank/${b.id}/`, layout(bankPage(b))); count++; } }
  for (const ex of exchanges) { if (ex?.id) { writeHtml(`/exchange/${ex.id}/`, layout(exchangePage(ex))); count++; } }
  for (const a of news) { if (a?.id) { writeHtml(`/news/${a.id}/`, layout(newsPage(a))); count++; } }

  const tags = [...new Set(banks.flatMap(b => b.tags || []))].filter(Boolean);
  for (const tag of tags) { writeHtml(`/tag/${tag}/`, layout(tagPage(tag, banks))); count++; }

  const countries = [...new Set(banks.map(b => b.country).filter(Boolean))];
  for (const c of countries) { writeHtml(`/country/${c}/`, layout(countryPage(c, banks))); count++; }

  console.log(`\n✅ Wygenerowano ${count} stron HTML\n`);
}

generate().catch(err => {
  console.error("❌ Błąd:", err);
  process.exit(1);
});
