/**
 * generate.js — NeoBase Static HTML Generator v2
 * Generuje pełne strony HTML z treścią (nie tylko meta tagi)
 * Node >= 18 (fetch built-in), brak zewnętrznych zależności
 */

const fs = require("fs");
const path = require("path");

const API_BASE = "https://neobase.co/api.php";
const SITE_URL = "https://neobase.co";
const OUT_DIR = __dirname;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function fetchData(type) {
  try {
    const res = await fetch(`${API_BASE}?t=${type}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`  ✓ API ${type}: ${Array.isArray(data) ? data.length : 1} rekordów`);
    return data;
  } catch (err) {
    console.warn(`  ⚠ API ${type} niedostępne: ${err.message}`);
    return [];
  }
}

function writeHtml(urlPath, html) {
  const rel = urlPath.replace(/^\//, "").replace(/\/$/, "");
  const dir = rel ? path.join(OUT_DIR, rel) : OUT_DIR;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
  console.log(`  ✓ ${urlPath || "/"}`);
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
    body { font-family: system-ui, sans-serif; margin: 0; background: #0a0a0f; color: #e2e8f0; }
    .static-nav { display: flex; align-items: center; gap: 16px; padding: 16px 24px; background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.08); }
    .static-nav a { color: #94a3b8; text-decoration: none; font-size: 14px; }
    .static-nav a:first-child { font-weight: 700; color: #fff; font-size: 18px; margin-right: auto; }
    .static-nav a:hover { color: #fff; }
    .static-wrap { max-width: 1100px; margin: 0 auto; padding: 40px 20px 80px; }
    h1 { font-size: clamp(1.5rem, 4vw, 2.4rem); font-weight: 800; margin: 0 0 12px; }
    h2 { font-size: 1.3rem; font-weight: 700; margin: 32px 0 12px; }
    p { line-height: 1.7; color: #94a3b8; margin: 0 0 16px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; background: rgba(99,102,241,.2); color: #818cf8; margin: 0 4px 4px 0; }
    .score-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,.15); color: #34d399; border-radius: 8px; padding: 4px 12px; font-weight: 700; font-size: 1rem; }
    .logo-img { width: 64px; height: 64px; border-radius: 12px; object-fit: contain; background: rgba(255,255,255,.06); padding: 8px; }
    .entity-header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 24px; }
    .card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 14px; text-decoration: none; color: inherit; transition: border-color .2s; }
    .card:hover { border-color: rgba(99,102,241,.5); }
    .card-logo { width: 44px; height: 44px; border-radius: 8px; object-fit: contain; background: rgba(255,255,255,.06); }
    .card-info h3 { margin: 0 0 4px; font-size: 1rem; font-weight: 700; }
    .card-info p { margin: 0; font-size: 13px; color: #64748b; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; font-size: 14px; color: #64748b; }
    .news-date { font-size: 13px; color: #475569; }
  </style>
</head>
<body>
<nav class="static-nav">
  <a href="/">NeoBase</a>
  <a href="/exchanges/">Exchanges</a>
  <a href="/news/">News</a>
  <a href="/about/">About</a>
</nav>
<main class="static-wrap">
${bodyHtml}
</main>
<script>
  // Załaduj pełną aplikację SPA po wyrenderowaniu statycznych treści
  (function() {
    var script = document.createElement('script');
    script.src = '/app.js';
    document.body.appendChild(script);
  })();
</script>
</body>
</html>`;
}

// ─── Page builders ────────────────────────────────────────────────────────────

function bankPage(bank) {
  const name = esc(bank.name || bank.id);
  const score = bank.neobaseScore || bank.score || null;
  const country = bank.country || "";
  const description = bank.description || bank.about || "";
  const tags = bank.tags || [];

  const bodyHtml = `
<div class="entity-header">
  ${bank.logoUrl ? `<img class="logo-img" src="${esc(bank.logoUrl)}" alt="${name} logo" loading="lazy">` : ""}
  <div>
    <h1>${name}</h1>
    <div class="meta-row">
      ${country ? `<span>🌍 ${esc(country)}</span>` : ""}
      ${score ? `<span class="score-pill">⭐ ${esc(String(score))}</span>` : ""}
    </div>
  </div>
</div>
${description ? `<p>${esc(description)}</p>` : ""}
${tags.length ? `<div>${tags.map(t => `<span class="badge">${esc(t)}</span>`).join("")}</div>` : ""}
<h2>About ${name}</h2>
<p>${name} is a fintech company${country ? ` based in ${esc(country)}` : ""}. Compare user ratings, app store reviews and sentiment analysis on NeoBase.</p>
`;

  return {
    url: `/bank/${bank.id}/`,
    title: `${bank.name || bank.id} Review 2026 — NeoBase${score ? ` | Score: ${score}` : ""}`,
    description: `${bank.name || bank.id}${country ? ` (${country})` : ""} — user ratings, app reviews and sentiment analysis. ${description.slice(0, 100)}`,
    image: bank.logoUrl || null,
    bodyHtml,
  };
}

function exchangePage(ex) {
  const name = esc(ex.name || ex.id);
  const score = ex.neobaseScore || ex.score || null;
  const description = ex.description || ex.about || "";

  const bodyHtml = `
<div class="entity-header">
  ${ex.logoUrl ? `<img class="logo-img" src="${esc(ex.logoUrl)}" alt="${name} logo" loading="lazy">` : ""}
  <div>
    <h1>${name}</h1>
    ${score ? `<div class="meta-row"><span class="score-pill">⭐ ${esc(String(score))}</span></div>` : ""}
  </div>
</div>
${description ? `<p>${esc(description)}</p>` : ""}
<h2>About ${name}</h2>
<p>${name} is a cryptocurrency exchange. Compare fees, ratings and user sentiment on NeoBase.</p>
`;

  return {
    url: `/exchange/${ex.id}/`,
    title: `${ex.name || ex.id} Review 2026 — Crypto Exchange | NeoBase`,
    description: `${ex.name || ex.id} — compare fees, ratings and user reviews. ${description.slice(0, 100)}`,
    image: ex.logoUrl || null,
    bodyHtml,
  };
}

function newsPage(article) {
  const title = esc(article.title || article.id);
  const body = article.body || article.content || article.excerpt || "";
  const excerpt = article.excerpt || article.description || body.slice(0, 200);
  const date = article.date || article.publishedAt || "";

  const bodyHtml = `
<h1>${title}</h1>
${date ? `<p class="news-date">Published: ${esc(date)}</p>` : ""}
${body ? body.split("\n").map(p => p.trim() ? `<p>${esc(p)}</p>` : "").join("") : `<p>${esc(excerpt)}</p>`}
`;

  return {
    url: `/news/${article.id}/`,
    title: `${article.title || article.id} — NeoBase News`,
    description: String(excerpt).slice(0, 160),
    image: article.image || null,
    bodyHtml,
  };
}

function tagPage(tag, banks) {
  const filtered = banks.filter(b => (b.tags || []).includes(tag));
  const bodyHtml = `
<h1>${esc(tag)} Neobanks &amp; Fintechs</h1>
<p>${filtered.length} fintech ${filtered.length === 1 ? "company" : "companies"} tagged "${esc(tag)}" on NeoBase.</p>
<div class="cards-grid">
${filtered.map(b => `  <a class="card" href="/bank/${b.id}/">
    ${b.logoUrl ? `<img class="card-logo" src="${esc(b.logoUrl)}" alt="${esc(b.name)}" loading="lazy">` : ""}
    <div class="card-info"><h3>${esc(b.name || b.id)}</h3><p>${esc(b.country || "")}</p></div>
  </a>`).join("\n")}
</div>`;

  return {
    url: `/tag/${tag}/`,
    title: `${tag} Neobanks & Fintechs — NeoBase`,
    description: `Browse ${filtered.length} fintech companies tagged "${tag}" on NeoBase.`,
    bodyHtml,
  };
}

function countryPage(country, banks) {
  const filtered = banks.filter(b => b.country === country);
  const bodyHtml = `
<h1>Neobanks in ${esc(country)}</h1>
<p>${filtered.length} fintech ${filtered.length === 1 ? "company" : "companies"} based in ${esc(country)}.</p>
<div class="cards-grid">
${filtered.map(b => `  <a class="card" href="/bank/${b.id}/">
    ${b.logoUrl ? `<img class="card-logo" src="${esc(b.logoUrl)}" alt="${esc(b.name)}" loading="lazy">` : ""}
    <div class="card-info"><h3>${esc(b.name || b.id)}</h3><p>${esc((b.tags || []).slice(0, 2).join(", "))}</p></div>
  </a>`).join("\n")}
</div>`;

  return {
    url: `/country/${country}/`,
    title: `Neobanks in ${country} — NeoBase`,
    description: `Compare ${filtered.length} neobanks based in ${country} on NeoBase.`,
    bodyHtml,
  };
}

function homePage(banks, exchanges) {
  const topBanks = banks.slice(0, 12);
  const topExchanges = exchanges.slice(0, 6);

  const bodyHtml = `
<h1>Global Neobank &amp; Fintech Directory 2026</h1>
<p>Compare ratings, track sentiment, and research the world's best fintech alternatives to traditional banking — all in one place.</p>
<h2>Top Neobanks</h2>
<div class="cards-grid">
${topBanks.map(b => `  <a class="card" href="/bank/${b.id}/">
    ${b.logoUrl ? `<img class="card-logo" src="${esc(b.logoUrl)}" alt="${esc(b.name)}" loading="lazy">` : ""}
    <div class="card-info"><h3>${esc(b.name || b.id)}</h3><p>${esc(b.country || "")}${b.neobaseScore || b.score ? " · " + (b.neobaseScore || b.score) : ""}</p></div>
  </a>`).join("\n")}
</div>
${topExchanges.length ? `<h2>Top Crypto Exchanges</h2>
<div class="cards-grid">
${topExchanges.map(ex => `  <a class="card" href="/exchange/${ex.id}/">
    ${ex.logoUrl ? `<img class="card-logo" src="${esc(ex.logoUrl)}" alt="${esc(ex.name)}" loading="lazy">` : ""}
    <div class="card-info"><h3>${esc(ex.name || ex.id)}</h3><p>${esc(ex.country || "")}</p></div>
  </a>`).join("\n")}
</div>` : ""}`;

  return {
    url: "/",
    title: "NeoBase — Global Neobank & Fintech Directory 2026",
    description: "Compare ratings, track sentiment, and research the world's best fintech alternatives to traditional banking — all in one place.",
    bodyHtml,
  };
}

const STATIC_PAGES = [
  {
    url: "/about/",
    title: "About NeoBase — Independent Fintech Intelligence Platform",
    description: "NeoBase is an independent directory and intelligence platform for the global neobank ecosystem.",
    bodyHtml: `<h1>About NeoBase</h1>
<p>NeoBase is an independent fintech intelligence platform tracking the global neobank and crypto exchange ecosystem. We aggregate user reviews, app store ratings and market data to give you unbiased, data-driven insights.</p>
<h2>Our Mission</h2>
<p>To make fintech research faster, fairer, and more transparent for everyone — from individual users to institutional researchers.</p>`,
  },
  {
    url: "/news/",
    title: "Fintech & Neobank News — NeoBase",
    description: "Latest news, analysis and updates from the global fintech and neobank industry.",
    bodyHtml: `<h1>Fintech &amp; Neobank News</h1><p>Latest news, analysis and updates from the global fintech and neobank industry.</p>`,
  },
  {
    url: "/exchanges/",
    title: "Crypto Exchanges Directory — NeoBase",
    description: "Compare top cryptocurrency exchanges by rating, volume and user sentiment.",
    bodyHtml: `<h1>Crypto Exchanges Directory</h1><p>Compare top cryptocurrency exchanges by rating, volume and user sentiment on NeoBase.</p>`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generate() {
  console.log("\n🚀 NeoBase Static HTML Generator v2\n");

  console.log("📡 Pobieranie danych z API...");
  const [banks, exchanges, news] = await Promise.all([
    fetchData("banks"),
    fetchData("exchanges"),
    fetchData("news"),
  ]);

  console.log("\n📄 Generowanie stron...");
  let count = 0;

  const home = homePage(banks, exchanges);
  writeHtml(home.url, layout(home));
  count++;

  for (const page of STATIC_PAGES) {
    writeHtml(page.url, layout(page));
    count++;
  }

  for (const bank of banks) {
    if (!bank?.id) continue;
    writeHtml(`/bank/${bank.id}/`, layout(bankPage(bank)));
    count++;
  }

  for (const ex of exchanges) {
    if (!ex?.id) continue;
    writeHtml(`/exchange/${ex.id}/`, layout(exchangePage(ex)));
    count++;
  }

  for (const article of news) {
    if (!article?.id) continue;
    writeHtml(`/news/${article.id}/`, layout(newsPage(article)));
    count++;
  }

  const allTags = [...new Set(banks.flatMap(b => b.tags || []))].filter(Boolean);
  for (const tag of allTags) {
    writeHtml(`/tag/${tag}/`, layout(tagPage(tag, banks)));
    count++;
  }

  const allCountries = [...new Set(banks.map(b => b.country).filter(Boolean))];
  for (const country of allCountries) {
    writeHtml(`/country/${country}/`, layout(countryPage(country, banks)));
    count++;
  }

  console.log(`\n✅ Wygenerowano ${count} stron HTML\n`);
}

generate().catch(err => {
  console.error("❌ Błąd:", err);
  process.exit(1);
});
