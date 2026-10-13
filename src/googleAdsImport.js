// Lecture d'un export de rapport "Campagnes" Google Ads (CSV ou TSV, interface
// en français ou en anglais) pour pré-remplir le simulateur avec les vrais
// chiffres d'un compte. Fonctions pures, sans dépendance au navigateur hors
// decodeExport (TextDecoder).

const MONTHS = {
  janvier: 0, janv: 0, january: 0, jan: 0,
  fevrier: 1, fevr: 1, february: 1, feb: 1,
  mars: 2, march: 2, mar: 2,
  avril: 3, avr: 3, april: 3, apr: 3,
  mai: 4, may: 4,
  juin: 5, june: 5, jun: 5,
  juillet: 6, juil: 6, july: 6, jul: 6,
  aout: 7, august: 7, aug: 7,
  septembre: 8, sept: 8, sep: 8, september: 8,
  octobre: 9, oct: 9, october: 9,
  novembre: 10, nov: 10, november: 10,
  decembre: 11, dec: 11, december: 11,
};

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^"+|"+$/g, "")
    .replace(/[ \s]+/g, " ")
    .trim()
    .toLowerCase();

// Google Ads exporte souvent en UTF-16 (Excel .csv) : on lit l'octet d'ordre.
export function decodeExport(buffer) {
  const b = new Uint8Array(buffer);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b);
  return new TextDecoder("utf-8").decode(b);
}

function splitLine(line, delim) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delim && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

// "1 234,56", "1,234.56", "8,05 %", "4,2 €", "< 10 %", "--" -> nombre ou null.
export function parseNumber(raw) {
  let t = String(raw ?? "").replace(/[ \s€$%]/g, "").replace(/^"+|"+$/g, "");
  if (t === "" || t === "--" || t === "-") return null;
  if (t.startsWith("<")) { const n = parseNumber(t.slice(1)); return n == null ? null : n / 2; }
  if (t.startsWith(">")) return parseNumber(t.slice(1));
  if (t.includes(",") && t.includes(".")) {
    // le dernier séparateur est la décimale
    t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (t.includes(",")) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const COLUMN_TESTS = {
  campaign: (h) => h === "campagne" || h === "campaign",
  impr: (h) => h === "impr." || h === "impr" || h === "impressions" || h === "impression",
  clicks: (h) => h === "clics" || h === "clicks",
  cost: (h) => h === "cout" || h === "cost",
  conv: (h) => h === "conversions" || h === "conv." || h === "conv",
  lostBudget: (h) => h.includes("perdue") && h.includes("budget") && !h.includes("display")
    || h.includes("lost") && h.includes("budget") && !h.includes("display"),
};

// Cherche la période dans les lignes d'en-tête du rapport ("1 janvier 2026 - 31 mars 2026").
function detectMonths(lines) {
  const re = /(\d{1,2})\s+([a-zéûôàç.]+)\s+(\d{4})/gi;
  for (const line of lines) {
    const dates = [];
    for (const m of line.matchAll(re)) {
      const mon = MONTHS[norm(m[2]).replace(".", "")];
      if (mon != null) dates.push(new Date(Number(m[3]), mon, Number(m[1])));
    }
    // Format anglais : "January 1, 2026 - March 31, 2026"
    if (dates.length < 2) {
      for (const m of line.matchAll(/([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/gi)) {
        const mon = MONTHS[norm(m[1])];
        if (mon != null) dates.push(new Date(Number(m[3]), mon, Number(m[2])));
      }
    }
    if (dates.length >= 2) {
      const days = Math.round((dates[1] - dates[0]) / 86400000) + 1;
      if (days > 0) return Math.max(1, Math.round((days / 30.4) * 10) / 10);
    }
  }
  return null;
}

// Retourne { campaigns, months, hasLostBudget } ou { error }.
export function parseGoogleAdsExport(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  let headerIdx = -1;
  let delim = ",";
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    for (const d of ["\t", ";", ","]) {
      const cells = splitLine(lines[i], d).map(norm);
      if (cells.some(COLUMN_TESTS.campaign) && cells.some(COLUMN_TESTS.impr) && cells.some(COLUMN_TESTS.clicks) && cells.some(COLUMN_TESTS.cost)) {
        headerIdx = i; delim = d; break;
      }
    }
    if (headerIdx >= 0) break;
  }
  if (headerIdx < 0) {
    return { error: "Colonnes introuvables : l'export doit être un rapport Campagnes avec au minimum Campagne, Impr., Clics et Coût." };
  }
  const header = splitLine(lines[headerIdx], delim).map(norm);
  const col = {};
  for (const [key, test] of Object.entries(COLUMN_TESTS)) col[key] = header.findIndex(test);

  const campaigns = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitLine(lines[i], delim);
    const name = norm(cells[col.campaign]);
    if (!name || name.startsWith("total")) continue;
    const impr = parseNumber(cells[col.impr]);
    const clicks = parseNumber(cells[col.clicks]);
    const cost = parseNumber(cells[col.cost]);
    if (impr == null || clicks == null || cost == null) continue;
    if (impr === 0 && cost === 0) continue;
    campaigns.push({
      name: String(cells[col.campaign]).replace(/^"+|"+$/g, "").trim(),
      impr, clicks, cost,
      conv: col.conv >= 0 ? parseNumber(cells[col.conv]) ?? 0 : null,
      lostBudget: col.lostBudget >= 0 ? parseNumber(cells[col.lostBudget]) : null,
    });
  }
  if (!campaigns.length) return { error: "Aucune campagne avec des impressions ou des dépenses n'a été trouvée dans ce fichier." };
  return {
    campaigns,
    months: detectMonths(lines.slice(0, headerIdx)),
    hasConv: col.conv >= 0,
    hasLostBudget: col.lostBudget >= 0,
  };
}

// Agrège les campagnes retenues sur `months` mois en indicateurs prêts à saisir.
export function aggregateCampaigns(campaigns, months) {
  const m = months > 0 ? months : 1;
  const sum = (k) => campaigns.reduce((s, c) => s + (c[k] ?? 0), 0);
  const impr = sum("impr"), clicks = sum("clicks"), cost = sum("cost"), conv = sum("conv");
  const withLost = campaigns.filter((c) => c.lostBudget != null && c.impr > 0);
  const lostWeight = withLost.reduce((s, c) => s + c.impr, 0);
  return {
    impr, clicks, cost, conv,
    ctr: impr > 0 ? (clicks / impr) * 100 : null,
    cpc: clicks > 0 ? cost / clicks : null,
    convRate: clicks > 0 && conv > 0 ? (conv / clicks) * 100 : null,
    cpl: conv > 0 ? cost / conv : null,
    monthlyBudget: cost / m,
    monthlyLeads: conv / m,
    lostBudget: lostWeight > 0 ? withLost.reduce((s, c) => s + c.lostBudget * c.impr, 0) / lostWeight : null,
  };
}
