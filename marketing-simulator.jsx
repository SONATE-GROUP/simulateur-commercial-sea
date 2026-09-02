import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { SECTORS, FRENCH_REGIONS, getRegionPopulationShare, getDefaultValues, getSectorSalesCycle, getSectorMargin, CONVERSION_SUPPORTS, getSupportFactor, BUSINESS_TYPES, CONTACT_TYPES } from "./src/config/defaults";
import { loadTracking, saveTracking, genLinkId, fmtDuration, fmtDate } from "./src/tracking";

const CFG = {
  channels: {
    "google-ads": {
      label: "Google Ads",
      color: "#e8571a",
      funnel: ["Impressions", "Clics", "Leads"],
      cpcLabel: "CPC (€)",
      ctrLabel: "CTR (%)",
      ctrMax: 15,
      cpcMax: 20,
      cpcStep: 0.1,
      cpcDigits: 1,
      cpmLabel: "CPM (€)",
      cpmMax: 60,
      cpmStep: 0.5,
      cpmDigits: 1,
      cpmDefault: 30,
      showCtr: true,
    },
    "meta-ads": {
      label: "Meta Ads",
      color: "#e8571a",
      funnel: ["Impressions", "Clics", "Leads"],
      cpcLabel: "CPC (€)",
      ctrLabel: "CTR (%)",
      ctrMax: 10,
      cpcMax: 15,
      cpcStep: 0.1,
      cpcDigits: 1,
      cpmLabel: "CPM (€)",
      cpmMax: 40,
      cpmStep: 0.5,
      cpmDigits: 1,
      cpmDefault: 12,
      showCtr: true,
    },
    "linkedin-ads": {
      label: "LinkedIn Ads",
      color: "#e8571a",
      funnel: ["Impressions", "Clics", "Leads"],
      cpcLabel: "CPC (€)",
      ctrLabel: "CTR (%)",
      ctrMax: 5,
      cpcMax: 25,
      cpcStep: 0.5,
      cpcDigits: 1,
      cpmLabel: "CPM (€)",
      cpmMax: 120,
      cpmStep: 1,
      cpmDigits: 1,
      cpmDefault: 60,
      showCtr: true,
    },
    "tiktok-ads": {
      label: "TikTok Ads",
      color: "#e8571a",
      funnel: ["Impressions", "Clics", "Leads"],
      cpcLabel: "CPC (€)",
      ctrLabel: "CTR (%)",
      ctrMax: 8,
      cpcMax: 10,
      cpcStep: 0.1,
      cpcDigits: 1,
      cpmLabel: "CPM (€)",
      cpmMax: 30,
      cpmStep: 0.5,
      cpmDigits: 1,
      cpmDefault: 8,
      showCtr: true,
    },

  },
  sectors: SECTORS,
};

// ─── Animated counter ────────────────────────────────────────
function useCountUp(target, ms = 600) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  const raf = useRef(null);
  useEffect(() => {
    const from = prev.current;
    const diff = target - from;
    if (!diff) return;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / ms, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const next = from + diff * e;
      prev.current = next;
      setVal(next);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { prev.current = target; setVal(target); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return val;
}

function Num({ value, fmt }) {
  const v = useCountUp(value);
  if (fmt === "eur")  return <>{Math.round(v).toLocaleString("fr-FR")} €</>;
  if (fmt === "pct")  return <>{v.toFixed(2)} %</>;
  if (fmt === "pctS") return <>{v.toFixed(1)} %</>;
  if (fmt === "coef") return <>x{v.toFixed(2)}</>;
  return <>{Math.round(v).toLocaleString("fr-FR")}</>;
}

// ─── SVG Funnel ──────────────────────────────────────────────
function Funnel({ stages, color }) {
  const W = 280, rowH = 72, H = rowH * stages.length;
  const MIN = 24; // width at the very bottom
  // Straight sides: width decreases linearly from W (top) to MIN (bottom)
  const widthAt = y => W - (W - MIN) * (y / H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {stages.map((s, i) => {
        const y0 = i * rowH, y1 = (i + 1) * rowH;
        const wTop = widthAt(y0), wBot = widthAt(y1);
        const x1 = (W - wTop) / 2, x2 = (W + wTop) / 2;
        const x3 = (W + wBot) / 2, x4 = (W - wBot) / 2;
        const op = 1 - i * 0.18;
        const ratio = i > 0 && stages[i - 1].value > 0
          ? ((s.value / stages[i - 1].value) * 100).toFixed(1) : null;
        return (
          <g key={i}>
            <polygon points={`${x1},${y0} ${x2},${y0} ${x3},${y1} ${x4},${y1}`}
              fill={color} fillOpacity={op} />
            <text x={W / 2} y={y0 + rowH * 0.36} textAnchor="middle"
              fill="rgba(255,255,255,0.65)" fontSize="9.5" fontWeight="500">{s.label}</text>
            <text x={W / 2} y={y0 + rowH * 0.7} textAnchor="middle"
              fill="white" fontSize="13" fontWeight="700">
              {Math.round(s.value).toLocaleString("fr-FR")}
            </text>
            {ratio && (
              <text x={W - 4} y={y0 + 11} textAnchor="end"
                fill={color} fontSize="8.5" fontWeight="600" opacity="0.9">↓ {ratio}%</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Range slider with colored track ─────────────────────────
function Slider({ label, value, min, max, step, onChange, accent, display, labelColor, trackBg }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: labelColor ?? "rgba(255,255,255,0.38)" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: accent }}>{display}</span>
      </div>
      <div style={{ position: "relative", height: 16, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", width: "100%", height: 3, background: trackBg ?? "rgba(255,255,255,0.08)", borderRadius: 2 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: accent, borderRadius: 2 }} />
        </div>
        <div style={{
          position: "absolute", left: `${pct}%`, transform: "translateX(-50%)",
          width: 13, height: 13, borderRadius: "50%", background: accent,
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
          pointerEvents: "none", transition: "left 0.05s",
        }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", width: "100%", opacity: 0, cursor: "pointer", height: "100%", margin: 0 }} />
      </div>
    </div>
  );
}

// ─── Section repliable ───────────────────────────────────────
function Fold({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
        background: "none", border: "none", padding: 0, cursor: "pointer",
        marginBottom: open ? 10 : 0, fontFamily: "inherit",
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.16em", color: "rgba(0,0,0,0.4)", textTransform: "uppercase" }}>{title}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "rgba(0,0,0,0.35)", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────
function KCard({ label, sub, value, fmt, accent, highlight }) {
  return (
    <div style={{
      background: highlight ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
      borderRadius: 10, padding: "14px 16px",
      border: `1px solid ${highlight ? accent + "55" : "rgba(255,255,255,0.06)"}`,
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 7 }}>{label}</div>
      <div style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 800, fontSize: highlight ? 30 : 21, letterSpacing: "-0.03em", lineHeight: 1, color: highlight ? accent : "#F6F1E8" }}>
        <Num value={value} fmt={fmt} />
      </div>
      {sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.27)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─── Design tokens repris du simulateur SEO ──────────────────
const G = "#1a2e25", G2 = "#142218", G3 = "#2d4a3e", G5 = "#233d30";
const CREAM = "#f5f0e8", ORANGE = "#e8571a";
const L_BORD = "#ddd5c8", L_MED = "#4a6a5a";

const fmtN = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const fmtC = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(n));
const fmtP = (n, d = 1) => `${n.toFixed(d)}%`;
const fmtLeads = (n) => (n >= 1 ? `${Math.round(n)}` : n > 0 ? n.toFixed(1) : "0");

// ─── KPI Card (style SEO) ────────────────────────────────────
function KPICard({ label, value, sub, accent = false }) {
  return (
    <div style={{ backgroundColor: G5, borderRadius: 10, padding: "14px 16px", border: `1px solid ${G3}`, flex: 1 }}>
      <div style={{ color: "#7a9e8e", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ color: accent ? ORANGE : CREAM, fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: "#5a7a6a", fontSize: 11, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─── Entonnoir de conversion (trapèze orange, style SEO) ─────
function ConversionFunnel({ stages, rates }) {
  const N = stages.length;
  const W = 400, BAND = 80, H = N * BAND, TIP = 60, SVG_W = 520;
  const xl = (y) => (W - TIP) * y / (2 * H);
  const xr = (y) => W - xl(y);
  const COLORS_ON = ["#e8571a", "#d04c15", "#b84412", "#a63c0f", "#8a300a", "#6e2407"];
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
      <svg viewBox={`0 0 ${SVG_W} ${H + 4}`} style={{ width: "100%", maxWidth: 560 }} aria-label="Entonnoir de conversion">
        {stages.map((stage, i) => {
          const y1 = i * BAND, y2 = (i + 1) * BAND, cy = (y1 + y2) / 2;
          const pts = `${xl(y1)},${y1} ${xr(y1)},${y1} ${xr(y2)},${y2} ${xl(y2)},${y2}`;
          const color = COLORS_ON[Math.min(i, COLORS_ON.length - 1)];
          return (
            <g key={i}>
              <polygon points={pts} fill={color} />
              {i > 0 && <line x1={xl(y1)} y1={y1} x2={xr(y1)} y2={y1} stroke="rgba(0,0,0,0.18)" strokeWidth={1} />}
              <text x={W / 2} y={cy - 12} fill="rgba(255,255,255,0.8)" fontSize={12} textAnchor="middle" fontFamily="Inter, sans-serif">{stage.label}</text>
              <text x={W / 2} y={cy + 14} fill="rgba(255,255,255,1)" fontSize={20} fontWeight="800" textAnchor="middle" fontFamily="Inter, sans-serif">{stage.value}</text>
              {i < N - 1 && rates[i] && (
                <text x={xr(y2) + 12} y={y2 + 5} fill={ORANGE} fontSize={11} fontWeight="600" textAnchor="start" fontFamily="Inter, sans-serif">{rates[i]}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Learning curve — CPL evolution over the first months ────
function LearningCurve({ data, color }) {
  const W = 560, H = 190;
  const padL = 14, padR = 14, padT = 30, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxV = Math.max(...data.map(d => d.cpl), 1);
  const n = data.length;
  const px = i => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const py = v => padT + plotH - (v / maxV) * plotH;
  const linePts = data.map((d, i) => `${px(i)},${py(d.cpl)}`).join(" ");
  const baseY = padT + plotH;
  const areaPts = `${px(0)},${baseY} ${linePts} ${px(n - 1)},${baseY}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      <defs>
        <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill="url(#lc-grad)" />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(d.cpl)} r="3.5" fill={color} stroke="#0F332B" strokeWidth="1.5" />
          <text x={px(i)} y={py(d.cpl) - 10} textAnchor="middle" fill="#F6F1E8" fontSize="10" fontWeight="700">
            {Math.round(d.cpl).toLocaleString("fr-FR")} €
          </text>
          {d.delta != null && (
            <text x={px(i)} y={py(d.cpl) - 22} textAnchor="middle" fill={color} fontSize="8" fontWeight="600">
              {d.delta < 0 ? "−" : ""}{Math.abs(d.delta)}%
            </text>
          )}
          <text x={px(i)} y={H - 7} textAnchor="middle" fill="rgba(255,255,255,0.42)" fontSize="9.5">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// Réduction marginale du CPL mois après mois. La phase d'apprentissage
// algorithmique elle-même dure ~2 à 6 semaines ; les gains des premiers mois
// viennent surtout de l'optimisation continue (mots-clés/audiences/créas) et se
// stabilisent à maturité. On retient un gain DURABLE prudent (~−25 % vs M1),
// plutôt qu'une division par deux maintenue toute l'année (irréaliste).
const LEARNING_STEPS = [
  { label: "M1", mult: 1.0,  delta: null },
  { label: "M2", mult: 0.92, delta: -8 },
  { label: "M3", mult: 0.85, delta: -8 },
  { label: "M4", mult: 0.78, delta: -8 },
  { label: "M5", mult: 0.76, delta: -3 },
  { label: "M6", mult: 0.75, delta: null },
];
// Seuil de signal en deçà duquel l'algorithme manque de conversions pour
// optimiser : ~30 conv/mois (recommandation Google Smart Bidding ; Meta ~50/sem).
const MIN_SIGNAL_CONV = 30;

// ─── Saisonnalité (logique portée du simulateur SEO) ─────────
// Les mois cochés en "haute saison" voient leurs résultats pondérés par un
// coefficient ; les autres restent à ×1. `startMonth` décale le calendrier.
const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const SEASON_PRESETS = {
  uniforme: Array(12).fill(false),
  hivernal: [true, true, true, true, false, false, false, false, false, false, false, true], // Oct-Avr
  estival:  [false, false, false, true, true, true, true, true, true, false, false, false],  // Avr-Sep
};

// ─── App ─────────────────────────────────────────────────────
export default function Simulator({ onOpenBackOffice, user, onLogout, consultation }) {
  const [channel, setChannel] = useState("google-ads");
  const [sector, setSector]   = useState("saas");
  const [mode, setMode]       = useState("budget");
  const [budget, setBudget]   = useState(5000);
  const [tLeads, setTLeads]   = useState(50);
  const [cpc, setCpc]         = useState(8);
  const [billing, setBilling] = useState("cpc");
  const [cpm, setCpm]         = useState(30);
  const [ctr, setCtr]         = useState(4);
  const [conv, setConv]       = useState(3.5);
  const [support, setSupport] = useState("landing");
  const [businessType, setBusinessType] = useState("lead");
  const [contactTypes, setContactTypes] = useState([BUSINESS_TYPES.lead.defaultContact]);
  const [geoScope, setGeoScope] = useState("france");
  const [geoZone, setGeoZone]   = useState("");
  const [panierMoyen, setPanierMoyen] = useState(300);
  const [revenueType, setRevenueType] = useState("ponctuel"); // "ponctuel" | "recurrent"
  const [mrr, setMrr]                 = useState(50);  // revenu mensuel par client (récurrent)
  const [lifetime, setLifetime]       = useState(24); // durée de vie client (mois)
  const [marge, setMarge]             = useState(getSectorMargin("saas"));
  const [margeEnabled, setMargeEnabled] = useState(true);
  const [closing, setClosing]         = useState(20);
  const [cycleVente, setCycleVente]   = useState(1);
  const [seasonalityEnabled, setSeasonalityEnabled] = useState(false);
  const [startMonth, setStartMonth]   = useState(0);
  const [highSeasonMonths, setHighSeasonMonths] = useState(Array(12).fill(false));
  const [highSeasonMultiplier, setHighSeasonMultiplier] = useState(3);
  const [prospect, setProspect] = useState("");
  const [logo, setLogo]       = useState(null);
  const [website, setWebsite] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied]   = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingTick, setTrackingTick] = useState(0);
  const [funnelPeriod, setFunnelPeriod] = useState("month");
  const [myReportsOpen, setMyReportsOpen] = useState(false);
  const [myReports, setMyReports] = useState(null);

  const ch     = CFG.channels[channel];
  const biz    = BUSINESS_TYPES[businessType];
  const accent = ch.color;
  // Lecteur = lecture seule : pas d'enregistrement. Consultation (prospect) non plus.
  const canSave = !consultation && user?.role !== "Lecteur";
  const openMyReports = () => {
    setMyReportsOpen(true); setMyReports(null);
    fetch("/api/my-reports", { headers: { "X-Requested-With": "fetch" } })
      .then(r => (r.ok ? r.json() : { reports: [] }))
      .then(d => setMyReports(d.reports || []))
      .catch(() => setMyReports([]));
  };

  const contentRef   = useRef();
  const exportBtnRef = useRef();

  const exportFileName = (() => {
    const slug = prospect
      ? prospect.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      : "";
    return slug ? `simulation-${slug}-${channel}` : `simulation-${channel}`;
  })();

  // Reset defaults when channel/sector changes — useLayoutEffect prevents a visible
  // flash of wrong metrics caused by the old CPC/CTR being used with the new channel.
  useLayoutEffect(() => {
    const d = getDefaultValues(channel, sector);
    // Taux de conversion sectoriel pondéré par le support actuellement choisi.
    if (d) { setCpc(d.cpc); setCtr(d.ctr); setConv(Math.round(d.conversionRate * getSupportFactor(support) * 10) / 10); setBudget(d.budget); }
    setCpm(CFG.channels[channel]?.cpmDefault ?? 10);
    setCycleVente(getSectorSalesCycle(sector));
    setMarge(getSectorMargin(sector));
    // `support` n'est volontairement pas dans les deps : changer de support ne
    // doit pas réinitialiser budget/CPC ; le bouton support ajuste déjà `conv`.
  }, [channel, sector]);

  // Restore state from shared URL on first load
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (!s) return;
    try {
      const d = JSON.parse(atob(s));
      if (CFG.channels[d.channel] && CFG.sectors[d.sector]) {
        setChannel(d.channel);
        setSector(d.sector);
        setMode(d.mode === "leads" ? "leads" : "budget");
        if (d.budget > 0)  setBudget(d.budget);
        if (d.tLeads > 0)  setTLeads(d.tLeads);
        if (d.cpc   >= 0)  setCpc(d.cpc);
        if (d.billing === "cpc" || d.billing === "cpm") setBilling(d.billing);
        if (d.cpm   > 0)   setCpm(d.cpm);
        if (d.ctr   > 0)   setCtr(d.ctr);
        if (d.conv  > 0)   setConv(d.conv);
        if (CONVERSION_SUPPORTS[d.support]) setSupport(d.support);
        if (BUSINESS_TYPES[d.businessType]) setBusinessType(d.businessType);
        if (Array.isArray(d.contactTypes) && d.contactTypes.some(k => CONTACT_TYPES[k])) {
          setContactTypes(d.contactTypes.filter(k => CONTACT_TYPES[k]));
        } else if (CONTACT_TYPES[d.contactType]) {
          setContactTypes([d.contactType]); // liens partagés générés avant le passage au multi-select
        }
        if (d.geoScope === "france" || d.geoScope === "localisee") setGeoScope(d.geoScope);
        if (FRENCH_REGIONS[d.geoZone]) setGeoZone(d.geoZone);
        if (d.panierMoyen > 0) setPanierMoyen(d.panierMoyen);
        if (d.revenueType === "recurrent" || d.revenueType === "ponctuel") setRevenueType(d.revenueType);
        if (d.mrr > 0) setMrr(d.mrr);
        if (d.lifetime >= 1) setLifetime(d.lifetime);
        if (d.marge >= 0 && d.marge <= 100) setMarge(d.marge);
        if (typeof d.margeEnabled === "boolean") setMargeEnabled(d.margeEnabled);
        if (d.closing > 0)     setClosing(d.closing);
        if (d.cycleVente >= 1 && d.cycleVente <= 12) setCycleVente(d.cycleVente);
        if (typeof d.seasonalityEnabled === "boolean") setSeasonalityEnabled(d.seasonalityEnabled);
        if (d.startMonth >= 0 && d.startMonth <= 11) setStartMonth(d.startMonth);
        if (Array.isArray(d.highSeasonMonths) && d.highSeasonMonths.length === 12)
          setHighSeasonMonths(d.highSeasonMonths.map(Boolean));
        if (d.highSeasonMultiplier >= 1) setHighSeasonMultiplier(d.highSeasonMultiplier);
        if (d.prospect)    setProspect(d.prospect);
        if (d.website)     { setWebsite(d.website); fetchLogoFromWebsite(d.website); }
      }
    } catch (_) {}
  }, []);

  // Enregistre une visite quand la page est ouverte via un lien partagé (?t=…),
  // et mesure la durée de consultation (mise à jour périodique + à la fermeture).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkId = params.get("t");
    const encoded = params.get("s");
    if (!linkId || !encoded) return;

    let label = "Lien partagé";
    try {
      const d = JSON.parse(atob(encoded));
      if (d.prospect) label = d.prospect;
    } catch (_) {}

    const store = loadTracking();
    const entry = store[linkId] ?? { label, createdAt: new Date().toISOString(), visits: [] };
    if (!entry.label || entry.label === "Lien partagé") entry.label = label;
    const visitIndex = entry.visits.length;
    entry.visits.push({ ts: new Date().toISOString(), duration: 0 });
    store[linkId] = entry;
    saveTracking(store);

    const start = Date.now();
    // Identifiant de visite stable, pour mettre à jour la même visite côté serveur.
    const visitId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const postVisit = () => {
      fetch("/api/report-visit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId, visitId, duration: Math.round((Date.now() - start) / 1000) }),
      }).catch(() => {});
    };
    const update = () => {
      const s = loadTracking();
      const v = s[linkId]?.visits?.[visitIndex];
      if (v) { v.duration = Math.round((Date.now() - start) / 1000); saveTracking(s); }
      postVisit();
    };
    const iv = setInterval(update, 5000);
    const onHide = () => update();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(iv); update();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  // ── Funnel computation ────────────────────────────────────
  let impr = 0, clicks = 0, leads = 0, cpl = 0, budgetOut = 0;
  const safeDiv = (a, b) => b > 0 ? a / b : 0;

  const isCpm = billing === "cpm";
  if (mode === "budget") {
    if (isCpm) {
      // CPM : le budget achète des impressions, les clics en découlent via le CTR.
      impr = Math.round(safeDiv(budget, cpm) * 1000);
      clicks = Math.round(impr * ctr / 100);
    } else {
      clicks = Math.round(safeDiv(budget, cpc));
      impr = Math.round(safeDiv(clicks, ctr / 100));
    }
    leads = Math.round(clicks * conv / 100);
    budgetOut = budget;
  } else {
    leads = tLeads;
    clicks = Math.round(safeDiv(leads, conv / 100));
    impr = Math.round(safeDiv(clicks, ctr / 100));
    budgetOut = isCpm ? Math.round(safeDiv(impr, 1000) * cpm) : Math.round(clicks * cpc);
  }
  cpl = leads > 0 ? safeDiv(mode === "budget" ? budget : budgetOut, leads) : 0;
  // En e-commerce la conversion EST une vente : pas d'étape de closing distincte.
  const clients     = biz.hasClosing ? Math.round(leads * closing / 100) : leads;
  // Valeur d'un client : panier unique (revenu ponctuel) ou valeur vie client
  //  (LTV = revenu mensuel × durée de vie) pour un revenu récurrent / abonnement.
  const recurring   = revenueType === "recurrent";
  const clientValue = recurring ? mrr * lifetime : panierMoyen;
  const caPotentiel = clients * clientValue;
  const spend = mode === "budget" ? budget : budgetOut;
  // ROAS = chiffre d'affaires généré pour 1 € dépensé (CA / budget).
  // ROI net = profit réel rapporté au budget, une fois la marge produit déduite.
  // Un ROAS de x1 n'est PAS rentable : il faut couvrir le coût de revient (1 − marge).
  const roas   = spend > 0 ? caPotentiel / spend : 0;
  // Marge desactivable : le sujet peut ne pas etre pertinent selon le business
  // (marge inconnue, service pur...). Desactivee, le ROI net est calcule sur
  // le CA brut, sans deduction de cout de revient.
  const effectiveMarge = margeEnabled ? marge : 100;
  const profit = caPotentiel * effectiveMarge / 100 - spend;
  const roiPct = spend > 0 ? (profit / spend) * 100 : 0;
  // Seuil de rentabilité : ROAS minimal pour que la marge couvre la dépense.
  const breakEvenRoas = effectiveMarge > 0 ? 100 / effectiveMarge : Infinity;

  // Courbe d'apprentissage : évolution du CPL/CPA sur les premiers mois.
  const learningData = LEARNING_STEPS.map(s => ({ ...s, cpl: cpl * s.mult }));
  const learningTable = [
    { label: "Mois 1",      deltaLabel: `${biz.cplShort} de base`, isBase: true, cpl: cpl * 1.0 },
    { label: "Mois 2",      deltaLabel: "−8%",                                    cpl: cpl * 0.92 },
    { label: "Mois 3",      deltaLabel: "−8% suppl.",                             cpl: cpl * 0.85 },
    { label: "Mois 4 et +", deltaLabel: "≈ −25% vs M1", tag: "maturité",          cpl: cpl * 0.75 },
  ];
  // Signal insuffisant : trop peu de conversions pour que l'algorithme optimise,
  // auquel cas la baisse de CPL ci-dessus est peu probable.
  const lowSignal = leads > 0 && leads < MIN_SIGNAL_CONV;

  // Budget démesuré au regard de la zone géographique : le budget de référence
  // national (calibré pour cibler toute la France) est ramené au poids
  // démographique de la région choisie, avec un plancher à 10% pour ne pas
  // être trop agressif sur les très petites régions (un minimum de budget
  // reste nécessaire pour faire tourner une campagne, quelle que soit la
  // taille du marché local). Marge de ×2,5 avant de déclencher l'alerte.
  const nationalRefBudget = getDefaultValues(channel, sector)?.budget ?? 0;
  const regionShare = geoZone ? getRegionPopulationShare(geoZone) : 0;
  const localBudgetCeiling = nationalRefBudget * Math.max(regionShare, 0.1) * 2.5;
  const budgetHighForZone = geoScope === "localisee" && !!geoZone && nationalRefBudget > 0 && spend > localBudgetCeiling;

  // Projection sur 12 mois combinant DEUX effets, mois par mois :
  //  • Apprentissage : le CPL/CPA baisse les premiers mois (LEARNING_STEPS),
  //    puis se stabilise à maturité (×0,5 dès M4). À budget constant cela
  //    génère plus de volume ; à objectif constant cela coûte moins cher.
  //  • Saisonnalité : en haute saison on capte plus de volume MAIS on dépense
  //    aussi davantage (le coefficient s'applique au volume ET au budget),
  //    sinon le ROI serait artificiellement gonflé par des leads « gratuits ».
  const seasonalMonths = Array.from({ length: 12 }, (_, i) => {
    const calMonth = (startMonth + i) % 12;
    const high = seasonalityEnabled && highSeasonMonths[calMonth];
    const coef = high ? highSeasonMultiplier : 1;
    const lm = LEARNING_STEPS[i]?.mult ?? LEARNING_STEPS[LEARNING_STEPS.length - 1].mult; // mult CPL du mois
    // budget figé → le volume profite de la baisse de CPL (÷ lm) ;
    // objectif figé → le volume reste la cible, c'est le budget qui baisse (× lm).
    const mLeads   = mode === "budget" ? leads * coef / lm : leads * coef;
    const mClients = biz.hasClosing ? mLeads * closing / 100 : mLeads;
    const mCA      = mClients * clientValue;
    const mSpend   = mode === "budget" ? spend * coef : spend * coef * lm;
    return {
      label: seasonalityEnabled ? MONTH_NAMES[calMonth] : `M${i + 1}`,
      high, coef,
      leads: mLeads,
      clients: mClients,
      ca: mCA,
      spend: mSpend,
    };
  });
  const annualLeads   = seasonalMonths.reduce((s, m) => s + m.leads, 0);
  const annualClients = seasonalMonths.reduce((s, m) => s + m.clients, 0);
  const annualCA      = seasonalMonths.reduce((s, m) => s + m.ca, 0);
  const annualSpend   = seasonalMonths.reduce((s, m) => s + m.spend, 0);
  const annualRoas    = annualSpend > 0 ? annualCA / annualSpend : 0;
  const annualRoiPct  = annualSpend > 0 ? (annualCA * effectiveMarge / 100 - annualSpend) / annualSpend * 100 : 0;
  const maxMonthLeads = Math.max(...seasonalMonths.map(m => m.leads), 1);

  // Cycle de vente : un lead du mois i se conclut ~ (cycleVente − 1) mois plus
  // tard. Sur une fenêtre de 12 mois, les cohortes des derniers mois encaissent
  // en année 2. Le CA « réalisé année 1 » exclut donc ces cohortes décalées,
  // alors que le budget, lui, est bien dépensé sur les 12 mois.
  const cv = Math.round(cycleVente);
  const realizedCohorts = Math.max(1, 13 - cv); // nb de mois dont le CA tombe en année 1
  const caRealizedY1 = seasonalMonths.slice(0, realizedCohorts).reduce((s, m) => s + m.ca, 0);
  const cycleShiftsCA = biz.hasClosing && cv > 1; // pas de décalage en e-commerce (achat immédiat)

  // Revenu récurrent : annualCA mesure la LTV cumulée des clients acquis sur
  // l'année (valeur générée). Le CA réellement FACTURÉ en année 1 se limite aux
  // mois d'abonnement effectivement courus dans la fenêtre de 12 mois — après le
  // délai du cycle de vente et plafonné par la durée de vie client.
  const billedY1 = recurring
    ? mrr * seasonalMonths.reduce((s, m, i) => {
        const startM = i + (cv - 1);                         // 1er mois facturé pour la cohorte i
        const monthsBilled = Math.max(0, Math.min(lifetime, 12 - startM));
        return s + m.clients * monthsBilled;
      }, 0)
    : caRealizedY1;
  // Montre la nuance « généré vs encaissé année 1 » dès qu'elle est significative.
  const showRealizedSplit = recurring ? billedY1 < annualCA - 0.5 : cycleShiftsCA;

  const stages = [
    { label: ch.funnel[0], value: impr },
    { label: ch.funnel[1], value: clicks },
    { label: biz.conversionStage, value: leads },
    ...(biz.hasClosing ? [{ label: biz.finalStage, value: clients }] : []),
  ];

  // ── Export dropdown — close on outside click ──────────────
  useEffect(() => {
    if (!exportMenu) return;
    const close = (e) => {
      if (exportBtnRef.current && !exportBtnRef.current.contains(e.target))
        setExportMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportMenu]);

  const captureCanvas = () =>
    import("html2canvas").then(({ default: html2canvas }) =>
      html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: "#1a2e25",
        useCORS: true,
        logging: false,
        onclone: (_, el) => { el.style.paddingBottom = "32px"; },
      })
    );

  const handleExportPng = async () => {
    setExportMenu(false);
    setExporting(true);
    try {
      await document.fonts.ready;
      const canvas = await captureCanvas();
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${exportFileName}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setExportMenu(false);
    setExporting(true);
    try {
      await document.fonts.ready;
      const canvas = await captureCanvas();
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG",
        (pdfW - imgW) / 2, (pdfH - imgH) / 2, imgW, imgH);
      pdf.save(`${exportFileName}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  // ── Share ─────────────────────────────────────────────────
  const handleShare = async () => {
    const encoded = btoa(JSON.stringify({ channel, sector, mode, budget, tLeads, cpc, ctr, conv, billing, cpm, support, businessType, contactTypes, geoScope, geoZone, panierMoyen, revenueType, mrr, lifetime, marge, margeEnabled, closing, cycleVente, seasonalityEnabled, startMonth, highSeasonMonths, highSeasonMultiplier, prospect, website }));
    const linkId = genLinkId();
    const url = `${window.location.origin}/?s=${encoded}&t=${linkId}`;
    // Référence le lien dans le suivi local pour pouvoir consulter ses statistiques.
    const store = loadTracking();
    if (!store[linkId]) store[linkId] = {
      label: prospect || "Sans nom",
      website: website || "",
      espace: "—",
      createdAt: new Date().toISOString(),
      state: encoded,
      visits: [],
    };
    saveTracking(store);
    // Enregistre aussi le rapport côté serveur (back-office multi-poste).
    fetch("/api/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId, label: prospect || "Sans nom", website: website || "", espace: "—", state: encoded }),
    }).catch(() => {});
    setShareUrl(url);
    try { await navigator.clipboard.writeText(url); } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const logoRef = useRef();
  const handleLogo = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setLogo(ev.target.result);
    r.readAsDataURL(f);
  };

  const fetchLogoFromWebsite = (url) => {
    if (!url) return;
    let domain;
    try {
      domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    } catch {
      domain = url.replace(/^www\./, "").split("/")[0];
    }
    if (!domain) return;
    const img = new Image();
    img.onload = () => setLogo(`https://logo.clearbit.com/${domain}`);
    img.onerror = () => setLogo(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    img.src = `https://logo.clearbit.com/${domain}`;
  };

  // Inject Google Fonts
  useEffect(() => {
    if (document.getElementById("sim-gf")) return;
    const el = document.createElement("link");
    el.id = "sim-gf"; el.rel = "stylesheet";
    el.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(el);
  }, []);

  const cpcDisplay = `${cpc.toFixed(ch.cpcDigits ?? 1)} €`;
  const cpmDisplay = `${cpm.toFixed(ch.cpmDigits ?? 1)} €`;

  const S = {
    label: { fontSize: 9, fontWeight: 600, letterSpacing: "0.16em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 10 },
    pill: (active) => ({ padding: "6px 13px", borderRadius: 20, fontSize: 11, cursor: "pointer", transition: "all 0.14s", background: active ? "rgba(255,255,255,0.1)" : "transparent", border: `1px solid ${active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)"}`, color: active ? "#fff" : "rgba(255,255,255,0.38)" }),
    chBtn: (active, color) => ({ padding: "7px 15px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.14s", background: active ? color : "rgba(255,255,255,0.04)", border: `1px solid ${active ? color : "rgba(255,255,255,0.07)"}`, color: active ? "#fff" : "rgba(255,255,255,0.42)" }),
    modeBtn: (active, color) => ({ flex: 1, padding: "8px 6px", borderRadius: 7, fontSize: 11.5, fontWeight: 500, cursor: "pointer", background: active ? color : "transparent", border: "none", color: active ? "#fff" : "rgba(255,255,255,0.36)", transition: "all 0.18s" }),
  };

  const hInput = { background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 6, padding: "8px 11px", color: "#1a3a2a", fontSize: 13, outline: "none", flex: 1, minWidth: 0, boxSizing: "border-box", fontFamily: "'Inter',sans-serif" };
  const hOutBtn = { background: "transparent", border: `1px solid ${G3}`, borderRadius: 6, padding: "8px 14px", color: G2, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif" };
  const hIconBtn = { ...hOutBtn, width: 34, height: 34, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: G, color: CREAM, fontFamily: "'Inter',sans-serif" }}>
      {/* ── HEADER ── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 20px", minHeight: 80, display: "flex", alignItems: "center", gap: 18, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 230, height: 60, flexShrink: 0 }}>
          <div style={{ backgroundImage: "url(/logo-sonate.png)", backgroundRepeat: "no-repeat", backgroundSize: "248px auto", backgroundPosition: "-4px -10px", width: "100%", height: "100%" }} role="img" aria-label="Sonate" />
          <span style={{ position: "absolute", top: 2, right: 0, fontSize: 8, fontWeight: 800, letterSpacing: "0.14em", color: ORANGE, lineHeight: 1 }}>Simulateur SEA/SMA</span>
        </div>
        <div style={{ width: 1, height: 40, background: "#e0e0e0", flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 260 }}>
          <input value={prospect} onChange={e => setProspect(e.target.value)} placeholder="Nom de l'entreprise" style={hInput} />
          <input value={website} onChange={e => setWebsite(e.target.value)} onBlur={e => fetchLogoFromWebsite(e.target.value)} placeholder="URL du site" style={hInput} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {canSave && (
            <button onClick={handleShare} title={copied ? "Enregistré !" : "Enregistrer"} style={{ ...hIconBtn, border: `1px solid ${copied ? "#4caf50" : G3}`, color: copied ? "#4caf50" : G2 }}>
              {copied ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              )}
            </button>
          )}
          {user && (
            <button onClick={openMyReports} title="Mes rapports" style={hIconBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
            </button>
          )}
          {onOpenBackOffice && (
            <button onClick={onOpenBackOffice} title="Back-office" style={hIconBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
          )}
          <button onClick={handleExportPdf} disabled={exporting} style={{ background: ORANGE, border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: exporting ? "default" : "pointer", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif", opacity: exporting ? 0.7 : 1 }}>↓ {exporting ? "Export…" : "Exporter PDF"}</button>
          {consultation && <span style={{ fontSize: 11, color: "#8a9e98", whiteSpace: "nowrap" }}>Mode consultation</span>}
          {user?.role === "Lecteur" && <span style={{ fontSize: 11, color: "#8a9e98", whiteSpace: "nowrap" }}>Lecture seule</span>}
          {user && (
            <button onClick={onLogout} title={`Déconnexion (${user.name || user.email})`} style={{ ...hOutBtn, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Déconnexion
            </button>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT PANEL (cream) ── */}
        <div className="scroll-light" style={{ width: 380, minWidth: 380, overflowY: "auto", borderRight: `1px solid ${L_BORD}`, padding: "16px 16px 28px", background: CREAM }}>
              {/* Canal */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...S.label, color: "rgba(0,0,0,0.4)" }}>Canal d'acquisition</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {Object.entries(CFG.channels).map(([k, c]) => (
                    <button key={k} onClick={() => setChannel(k)} style={{
                      ...S.chBtn(channel === k, c.color),
                      ...(channel !== k ? { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.5)" } : {}),
                    }}>{c.label}</button>
                  ))}
                </div>
              </div>

              {/* Secteur d'activité */}
              <Fold title="Secteur d'activité">
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {Object.entries(CFG.sectors).map(([k, l]) => (
                    <button key={k} onClick={() => setSector(k)} style={{
                      ...S.pill(sector === k),
                      ...(sector !== k ? { background: "transparent", border: "1px solid rgba(0,0,0,0.15)", color: "rgba(0,0,0,0.45)" } : { background: "rgba(0,0,0,0.1)", border: "1px solid rgba(0,0,0,0.2)", color: "rgba(0,0,0,0.8)" }),
                    }}>{l}</button>
                  ))}
                </div>
              </Fold>

              <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", marginBottom: 14 }} />

              {/* Type de business */}
              <Fold title="Type de business">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(BUSINESS_TYPES).map(([k, b]) => (
                    <button key={k} onClick={() => { setBusinessType(k); setContactTypes([b.defaultContact]); }} style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                      padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                      fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s",
                      ...(businessType === k
                        ? { background: accent, border: `1px solid ${accent}`, color: "#fff" }
                        : { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.55)" }),
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{b.label}</span>
                      <span style={{ fontSize: 10, opacity: 0.8 }}>{b.hint} · {b.priorityContact}</span>
                    </button>
                  ))}
                </div>
              </Fold>

              {/* Type de contact (pré-rempli selon le type de business, sélection multiple) */}
              <Fold title="Type de contact">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(biz.contactOptions ?? Object.keys(CONTACT_TYPES)).map((k) => {
                    const active = contactTypes.includes(k);
                    return (
                      <button key={k} onClick={() => setContactTypes(curr => curr.includes(k)
                        ? (curr.length > 1 ? curr.filter(x => x !== k) : curr)
                        : [...curr, k])} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600,
                        transition: "all 0.15s",
                        ...(active
                          ? { background: accent, border: `1px solid ${accent}`, color: "#fff" }
                          : { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.5)" }),
                      }}>
                        <span style={{
                          width: 13, height: 13, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          border: `1px solid ${active ? "#fff" : "rgba(0,0,0,0.3)"}`, background: active ? "rgba(255,255,255,0.15)" : "transparent",
                        }}>
                          {active && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </span>
                        {CONTACT_TYPES[k]?.label ?? k}
                      </button>
                    );
                  })}
                </div>
              </Fold>

              {/* Zone géographique */}
              <Fold title="Zone géographique">
                <div style={{ display: "flex", gap: 6 }}>
                  {[["france", "Toute la France"], ["localisee", "Localisée"]].map(([k, l]) => (
                    <button key={k} onClick={() => setGeoScope(k)} style={{
                      flex: 1, padding: "8px 6px", borderRadius: 8, cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600,
                      transition: "all 0.15s",
                      ...(geoScope === k
                        ? { background: accent, border: `1px solid ${accent}`, color: "#fff" }
                        : { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.5)" }),
                    }}>{l}</button>
                  ))}
                </div>
                {geoScope === "localisee" && (
                  <select value={geoZone} onChange={e => setGeoZone(e.target.value)}
                    style={{ marginTop: 8, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "8px 10px", color: "#0F332B", fontSize: 12, width: "100%", boxSizing: "border-box", outline: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                    <option value="" disabled>Choisir une région</option>
                    {Object.entries(FRENCH_REGIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                )}
              </Fold>

              {/* Durée du cycle de vente — sans objet pour l'e-commerce (achat immédiat) */}
              {businessType !== "ecommerce" && (
                <div style={{ marginBottom: 16 }}>
                  <Slider label="Durée du cycle de vente" value={cycleVente} min={1} max={12}
                    step={1} onChange={setCycleVente} accent={accent}
                    display={`${cycleVente} mois`}
                    labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />
                </div>
              )}

              {/* Mode toggle */}
              <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: 9, padding: 4, display: "flex", marginBottom: 14, border: "1px solid rgba(0,0,0,0.1)" }}>
                {[["budget", `Budget → ${biz.conversionStage}`], ["leads", `${biz.conversionStage} → Budget`]].map(([m, l]) => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    ...S.modeBtn(mode === m, accent),
                    ...(mode !== m ? { color: "rgba(0,0,0,0.45)" } : {}),
                  }}>{l}</button>
                ))}
              </div>

              {/* Primary input */}
              <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: 11, padding: "18px 18px 14px", marginBottom: 12, border: "1px solid rgba(0,0,0,0.08)" }}>
                {mode === "budget" ? (
                  <>
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginBottom: 5 }}>Budget mensuel (€)</div>
                    <input type="number" value={budget} onChange={e => setBudget(Math.min(50000, Math.max(1, Number(e.target.value))))}
                      style={{ background: "transparent", border: "none", outline: "none", fontFamily: "'Manrope',sans-serif", fontWeight: 800, fontSize: 34, color: "#0F332B", letterSpacing: "-0.03em", width: "100%" }} />
                    <input type="range" min={100} max={50000} step={100} value={budget}
                      onChange={e => setBudget(Number(e.target.value))}
                      style={{ width: "100%", marginTop: 10, accentColor: accent }} />
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginBottom: 5 }}>{`${biz.objectiveLabel} / mois`}</div>
                    <input type="number" value={tLeads} onChange={e => setTLeads(Math.min(500, Math.max(1, Number(e.target.value))))}
                      style={{ background: "transparent", border: "none", outline: "none", fontFamily: "'Manrope',sans-serif", fontWeight: 800, fontSize: 34, color: "#0F332B", letterSpacing: "-0.03em", width: "100%" }} />
                    <input type="range" min={1} max={500} step={1} value={tLeads}
                      onChange={e => setTLeads(Number(e.target.value))}
                      style={{ width: "100%", marginTop: 10, accentColor: accent }} />
                  </>
                )}
              </div>

              {/* Garde-fou : budget démesuré au regard de la zone géographique */}
              {budgetHighForZone && (
                <div style={{ marginBottom: 12, padding: "10px 12px", background: "#a6402a14", borderRadius: 8, border: "1px solid #a6402a40", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: "#a6402a", fontSize: 12, lineHeight: 1.4 }}>⚠</span>
                  <span style={{ fontSize: 10.5, color: "#7a3520", lineHeight: 1.5 }}>
                    {fmtC(spend)}/mois sur {FRENCH_REGIONS[geoZone]} (~{Math.round(regionShare * 100)}% de la population française) : budget élevé au regard du marché adressable localement, risque de saturer les enchères. Envisager d'élargir la zone ciblée ou de réduire le budget.
                  </span>
                </div>
              )}

              {/* Sliders */}
              <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: 11, padding: 16, border: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ ...S.label, color: "rgba(0,0,0,0.4)", marginBottom: 14 }}>Paramètres du canal</div>

                {/* Mode de facturation */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ ...S.label, color: "rgba(0,0,0,0.45)", marginBottom: 7 }}>Mode de facturation</div>
                  <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: 9, padding: 4, display: "flex", border: "1px solid rgba(0,0,0,0.1)" }}>
                    {[["cpc", "CPC", "coût par clic"], ["cpm", "CPM", "coût / 1000 impr."]].map(([m, l, t]) => (
                      <button key={m} onClick={() => setBilling(m)} title={t} style={{
                        ...S.modeBtn(billing === m, accent),
                        ...(billing !== m ? { color: "rgba(0,0,0,0.45)" } : {}),
                      }}>{l}</button>
                    ))}
                  </div>
                </div>

                {billing === "cpc"
                  ? (ch.cpcLabel && (
                    <Slider label={ch.cpcLabel} value={cpc} min={ch.cpcStep} max={ch.cpcMax}
                      step={ch.cpcStep} onChange={setCpc} accent={accent} display={cpcDisplay}
                      labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />
                  ))
                  : (
                    <Slider label={ch.cpmLabel ?? "CPM (€)"} value={cpm} min={ch.cpmStep ?? 0.5} max={ch.cpmMax ?? 60}
                      step={ch.cpmStep ?? 0.5} onChange={setCpm} accent={accent} display={cpmDisplay}
                      labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />
                  )}
                {ch.showCtr && (
                  <Slider label={ch.ctrLabel} value={ctr} min={0.1} max={ch.ctrMax}
                    step={0.1} onChange={setCtr} accent={accent} display={`${ctr.toFixed(1)} %`}
                    labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />
                )}
                {/* Cohérence des leviers : CPC, CTR et CPM sont liés
                    (CPM = CPC × CTR × 10). On affiche la métrique implicite du
                    mode non sélectionné pour éviter un trio incohérent. */}
                {ch.showCtr && (
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: -4, marginBottom: 14 }}>
                    {billing === "cpc"
                      ? `≈ CPM ${(cpc * ctr * 10).toFixed(1)} € à ce CTR`
                      : `≈ CPC ${ctr > 0 ? (cpm / (ctr * 10)).toFixed(2) : "—"} € à ce CTR`}
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ ...S.label, color: "rgba(0,0,0,0.45)", marginBottom: 7 }}>Support de conversion</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {Object.entries(CONVERSION_SUPPORTS).map(([k, s]) => (
                      <button key={k} onClick={() => {
                        setSupport(k);
                        const base = getDefaultValues(channel, sector)?.conversionRate ?? conv;
                        setConv(Math.round(base * s.factor * 10) / 10);
                      }} style={{
                        flex: 1, padding: "8px 6px", borderRadius: 8, cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600,
                        transition: "all 0.15s",
                        ...(support === k
                          ? { background: accent, border: `1px solid ${accent}`, color: "#fff" }
                          : { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.5)" }),
                      }}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <Slider label="Taux de conversion (%)" value={conv} min={0.1} max={20}
                  step={0.1} onChange={setConv} accent={accent} display={`${conv.toFixed(1)} %`}
                  labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />
                {biz.hasClosing && (
                  <div>
                    <Slider label={biz.closingLabel} value={closing} min={1} max={100}
                      step={0.5} onChange={setClosing} accent={accent} display={`${closing.toFixed(1)} %`}
                      labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />
                    {biz.closingHint && (
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: -4 }}>{biz.closingHint}</div>
                    )}
                  </div>
                )}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  {/* Type de revenu : panier unique (ponctuel) ou abonnement (récurrent → LTV) */}
                  <div style={{ ...S.label, color: "rgba(0,0,0,0.45)", marginBottom: 7 }}>Type de revenu</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {[["ponctuel", "Ponctuel"], ["recurrent", "Récurrent"]].map(([k, l]) => (
                      <button key={k} onClick={() => setRevenueType(k)} style={{
                        flex: 1, padding: "8px 6px", borderRadius: 8, cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, transition: "all 0.15s",
                        ...(revenueType === k
                          ? { background: accent, border: `1px solid ${accent}`, color: "#fff" }
                          : { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.5)" }),
                      }}>{l}</button>
                    ))}
                  </div>

                  {!recurring ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "rgba(0,0,0,0.45)" }}>Panier moyen (€)</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: accent }}>{panierMoyen.toLocaleString("fr-FR")} €</span>
                      </div>
                      <input type="range" min={1} max={10000} step={1} value={panierMoyen}
                        onChange={e => setPanierMoyen(Number(e.target.value))}
                        style={{ width: "100%", accentColor: accent }} />
                      <input type="number" value={panierMoyen} min={1}
                        onChange={e => setPanierMoyen(Math.max(1, Number(e.target.value)))}
                        style={{ marginTop: 6, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, padding: "4px 8px", color: "#0F332B", fontSize: 12, width: "100%", outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "rgba(0,0,0,0.45)" }}>Revenu mensuel / client (€)</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: accent }}>{mrr.toLocaleString("fr-FR")} €</span>
                      </div>
                      <input type="range" min={1} max={2000} step={1} value={mrr}
                        onChange={e => setMrr(Number(e.target.value))}
                        style={{ width: "100%", accentColor: accent }} />
                      <input type="number" value={mrr} min={1}
                        onChange={e => setMrr(Math.max(1, Number(e.target.value)))}
                        style={{ marginTop: 6, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, padding: "4px 8px", color: "#0F332B", fontSize: 12, width: "100%", outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
                      <div style={{ marginTop: 12 }}>
                        <Slider label="Durée de vie client (mois)" value={lifetime} min={1} max={60}
                          step={1} onChange={setLifetime} accent={accent} display={`${lifetime} mois`}
                          labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: -4 }}>
                        Valeur vie client (LTV) : <strong>{fmtC(mrr * lifetime)}</strong> ({mrr.toLocaleString("fr-FR")} € × {lifetime} mois)
                      </div>
                    </>
                  )}

                  <div style={{ marginTop: 14, background: "rgba(0,0,0,0.04)", borderRadius: 11, padding: 16, border: "1px solid rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: margeEnabled ? 10 : 0 }}>
                      <span style={{ ...S.label, color: "rgba(0,0,0,0.4)", marginBottom: 0 }}>Marge brute</span>
                      <button onClick={() => setMargeEnabled(v => !v)} title={margeEnabled ? "Désactiver" : "Activer"}
                        style={{ width: 38, height: 20, borderRadius: 11, border: "none", cursor: "pointer", flexShrink: 0,
                          background: margeEnabled ? accent : "rgba(0,0,0,0.18)", position: "relative", transition: "background .2s" }}>
                        <span style={{ position: "absolute", top: 3, left: margeEnabled ? 21 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .2s", display: "block" }} />
                      </button>
                    </div>
                    {margeEnabled && (
                      <>
                        <Slider label="Marge brute (%)" value={marge} min={1} max={100}
                          step={1} onChange={setMarge} accent={accent} display={`${Math.round(marge)} %`}
                          labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />
                        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: -4 }}>
                          Montant qui reste hors achat du produit vendu, à définir selon la règle de marge appliquée par le client.
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Saisonnalité */}
              <div style={{ marginTop: 14, background: "rgba(0,0,0,0.04)", borderRadius: 11, padding: 16, border: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: seasonalityEnabled ? 14 : 0 }}>
                  <span style={{ ...S.label, color: "rgba(0,0,0,0.4)", marginBottom: 0 }}>Saisonnalité</span>
                  <button onClick={() => setSeasonalityEnabled(v => !v)} title={seasonalityEnabled ? "Désactiver" : "Activer"}
                    style={{ width: 38, height: 20, borderRadius: 11, border: "none", cursor: "pointer", flexShrink: 0,
                      background: seasonalityEnabled ? accent : "rgba(0,0,0,0.18)", position: "relative", transition: "background .2s" }}>
                    <span style={{ position: "absolute", top: 3, left: seasonalityEnabled ? 21 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .2s", display: "block" }} />
                  </button>
                </div>

                {seasonalityEnabled && (
                  <>
                    {/* Préréglages */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      {Object.keys(SEASON_PRESETS).map(p => {
                        const active = JSON.stringify(highSeasonMonths) === JSON.stringify(SEASON_PRESETS[p]);
                        return (
                          <button key={p} onClick={() => setHighSeasonMonths([...SEASON_PRESETS[p]])} style={{
                            flex: 1, padding: "5px 6px", borderRadius: 6, fontSize: 11, textTransform: "capitalize",
                            fontWeight: active ? 700 : 500, cursor: "pointer",
                            ...(active ? { background: accent, border: `1px solid ${accent}`, color: "#fff" }
                                       : { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.5)" }),
                          }}>{p}</button>
                        );
                      })}
                    </div>

                    {/* Mois de haute saison */}
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", marginBottom: 6 }}>Cliquer les mois de haute saison</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4, marginBottom: 14 }}>
                      {MONTH_NAMES.map((m, i) => (
                        <button key={i} onClick={() => { const next = [...highSeasonMonths]; next[i] = !next[i]; setHighSeasonMonths(next); }} style={{
                          padding: "5px 2px", borderRadius: 4, fontSize: 10, fontWeight: highSeasonMonths[i] ? 700 : 400, cursor: "pointer", transition: "all .15s",
                          ...(highSeasonMonths[i] ? { background: accent, border: `1px solid ${accent}`, color: "#fff" }
                                                  : { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.5)" }),
                        }}>{m}</button>
                      ))}
                    </div>

                    {/* Coefficient haute saison */}
                    <Slider label="Coefficient haute saison" value={highSeasonMultiplier} min={1.5} max={6}
                      step={0.5} onChange={setHighSeasonMultiplier} accent={accent} display={`×${highSeasonMultiplier.toFixed(1)}`}
                      labelColor="rgba(0,0,0,0.45)" trackBg="rgba(0,0,0,0.1)" />

                    {/* Mois de démarrage */}
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", marginBottom: 6 }}>Mois de démarrage de la campagne</div>
                    <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}
                      style={{ width: "100%", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "7px 8px", color: "#0F332B", fontSize: 12, outline: "none", fontFamily: "'DM Sans',sans-serif" }}>
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                  </>
                )}
              </div>

            </div>

        {/* ── RIGHT PANEL (dark) ── */}
        <div ref={contentRef} className="scroll-dark" style={{ flex: 1, overflowY: "auto", padding: "14px 18px 28px", background: G }}>

          {/* Report header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: G2, borderRadius: 10, padding: "14px 20px", border: `1px solid ${G3}`, marginBottom: 14 }}>
            <div>
              <div style={{ color: "#5a7a6a", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>
                Simulation SEA · {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </div>
              <div style={{ color: CREAM, fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{prospect || "Nom de l'entreprise"}</div>
              <div style={{ color: "#7a9e8e", fontSize: 12, marginTop: 4 }}>
                {website}{website ? " · " : ""}{CFG.sectors[sector]} · {ch.label}
                {geoScope === "localisee" && geoZone ? ` · ${FRENCH_REGIONS[geoZone]}` : ""}
              </div>
            </div>
            <div style={{ color: ORANGE, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>SEA</div>
          </div>

          {/* BLOC 1 — main KPIs */}
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1, backgroundColor: G5, borderRadius: 12, padding: "24px 22px", border: `2px solid ${ORANGE}` }}>
              <div style={{ color: "#7a9e8e", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{recurring ? "Valeur client générée / an" : "CA généré / an"}</div>
              <div style={{ color: ORANGE, fontSize: 40, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmtC(annualCA)}</div>
              {showRealizedSplit ? (
                <div style={{ color: "#5a7a6a", fontSize: 12, marginTop: 8 }}>
                  dont <span style={{ color: CREAM, fontWeight: 700 }}>{fmtC(billedY1)}</span> {recurring ? "facturés" : "encaissés"} en année 1
                  <span style={{ display: "block", color: "#5a7a6a", marginTop: 2 }}>
                    {recurring
                      ? `LTV cumulée (${lifetime} mois de vie client) — le reste s'étale sur les années suivantes`
                      : `cycle de vente ${cv} mois — le reste bascule en année 2`}
                  </span>
                </div>
              ) : (
                <div style={{ color: "#5a7a6a", fontSize: 12, marginTop: 8 }}>{recurring ? "LTV cumulée des clients acquis" : "somme des 12 mois"}{seasonalityEnabled ? " (saisonnalité incluse)" : ""}</div>
              )}
            </div>
            <div style={{ flex: 1, display: "flex", gap: 10 }}>
              <div style={{ flex: 1, backgroundColor: G5, borderRadius: 12, padding: "24px 22px", border: `1px solid ${G3}` }}>
                <div style={{ color: "#7a9e8e", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>ROAS</div>
                <div style={{ color: CREAM, fontSize: 40, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>×{roas.toFixed(1)}</div>
                <div style={{ color: "#5a7a6a", fontSize: 12, marginTop: 8 }}>{recurring ? "valeur vie / 1 € investi (LTV:CAC)" : "CA pour 1 € investi"}</div>
              </div>
              <div style={{ flex: 1, backgroundColor: G5, borderRadius: 12, padding: "24px 22px", border: `1px solid ${roiPct >= 0 ? G3 : "#a6402a"}` }}>
                <div style={{ color: "#7a9e8e", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>ROI net</div>
                <div style={{ color: roiPct >= 0 ? "#4caf50" : ORANGE, fontSize: 40, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{roiPct >= 0 ? "+" : ""}{Math.round(roiPct)}%</div>
                <div style={{ color: "#5a7a6a", fontSize: 12, marginTop: 8 }}>
                  {margeEnabled ? `après marge ${Math.round(marge)}%` : "sur CA brut, marge non appliquée"} · {roiPct >= 0 ? "rentable" : "non rentable"}
                </div>
              </div>
            </div>
          </div>

          {/* BLOC 2 — secondary KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
            <KPICard label={`${mode === "budget" ? biz.generatedLabel : biz.objectiveLabel} / mois`} value={fmtLeads(leads)} sub={`${biz.cplShort} ${fmtC(cpl)}`} />
            <KPICard label={ch.funnel[1] + " / mois"} value={fmtN(clicks)} sub={`${ctr.toFixed(1)}% de CTR`} />
            <KPICard label={ch.funnel[0] + " / mois"} value={fmtN(impr)} sub="volume estimé" />
            <KPICard label="Budget mensuel" value={fmtC(spend)} accent />
          </div>

          {/* BLOC 3 — funnel */}
          <div style={{ backgroundColor: G5, borderRadius: 10, padding: 16, marginBottom: 14, border: `1px solid ${G3}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: CREAM, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>
              <span style={{ color: ORANGE, fontSize: 10 }}>◆</span> Entonnoir de conversion
              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                {Object.entries(BUSINESS_TYPES).map(([k, b]) => (
                  <button key={k} onClick={() => { setBusinessType(k); setContactTypes([b.defaultContact]); }} style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                    border: `1px solid ${businessType === k ? ORANGE : G3}`, background: businessType === k ? `${ORANGE}22` : "transparent",
                    color: businessType === k ? ORANGE : "#5a7a6a",
                  }}>{b.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {[["month", "/ Mois"], ["year", "/ An"]].map(([p, l]) => (
                <button key={p} onClick={() => setFunnelPeriod(p)} style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 14px", borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${funnelPeriod === p ? "#3b82f6" : G3}`, background: funnelPeriod === p ? "#3b82f622" : "transparent",
                  color: funnelPeriod === p ? "#3b82f6" : "#5a7a6a",
                }}>{l}</button>
              ))}
            </div>
            {(() => {
              const mult = funnelPeriod === "year" ? 12 : 1;
              const caLabel = funnelPeriod === "year" ? "CA / an" : "CA / mois";
              const caVal = funnelPeriod === "year" ? annualCA : caPotentiel;
              const fStages = [
                { label: ch.funnel[0], value: fmtN(impr * mult) },
                { label: ch.funnel[1], value: fmtN(clicks * mult) },
                { label: biz.conversionStage, value: fmtLeads(leads * mult) },
                ...(biz.hasClosing ? [{ label: biz.finalStage, value: fmtLeads(clients * mult) }] : []),
                { label: caLabel, value: fmtC(caVal) },
              ];
              const fRates = [
                impr > 0 ? `↓ ${fmtP(clicks / impr * 100)}` : "-",
                clicks > 0 ? `↓ ${fmtP(leads / clicks * 100)}` : "-",
                ...(biz.hasClosing ? [`↓ ${closing}%`] : []),
                recurring ? `× ${fmtN(clientValue)}€ LTV` : `× ${panierMoyen}€`,
              ];
              return <ConversionFunnel stages={fStages} rates={fRates} />;
            })()}
            {/* CPL/CPA par mois d'apprentissage */}
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              {learningTable.map(r => (
                <div key={r.label} style={{ flex: 1, minWidth: 80, background: G2, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                  <div style={{ color: "#5a7a6a", fontSize: 10, marginBottom: 2 }}>{biz.cplShort} {r.label}</div>
                  <div style={{ color: ORANGE, fontWeight: 700, fontSize: 15 }}>{fmtC(r.cpl)}</div>
                </div>
              ))}
            </div>
            {shareUrl && (
              <div style={{ marginTop: 14, padding: "9px 12px", background: G2, borderRadius: 7, border: `1px solid ${G3}` }}>
                <div style={{ fontSize: 8, color: "#5a7a6a", letterSpacing: "0.12em", marginBottom: 3 }}>LIEN DE PARTAGE</div>
                <div style={{ fontSize: 10, color: ORANGE, fontFamily: "monospace", wordBreak: "break-all" }}>{shareUrl}</div>
              </div>
            )}
          </div>

              {/* Courbe d'apprentissage — évolution du CPL sur les premiers mois */}
              <div style={{ marginTop: 14, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 700, fontSize: 13, color: "#F6F1E8" }}>
                    Courbe d'apprentissage
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                    Évolution du {biz.cplShort} sur les premiers mois
                  </div>
                </div>

                <LearningCurve data={learningData} color={accent} />

                {/* Tableau mois par mois */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Mois", "Évolution", biz.cplShort].map((h, i) => (
                      <span key={i} style={{ fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", textAlign: i === 0 ? "left" : i === 1 ? "center" : "right" }}>{h}</span>
                    ))}
                  </div>
                  {learningTable.map((r, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 8, padding: "7px 0", borderTop: i ? "1px solid rgba(255,255,255,0.05)" : "none", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                        {r.label}{r.tag && <span style={{ color: accent, fontSize: 9, marginLeft: 6 }}>· {r.tag}</span>}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center", color: r.isBase ? "rgba(255,255,255,0.35)" : accent }}>{r.deltaLabel}</span>
                      <span style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 700, fontSize: 12, textAlign: "right", color: "#F6F1E8" }}>{Math.round(r.cpl).toLocaleString("fr-FR")} €</span>
                    </div>
                  ))}
                </div>

                {/* Note explicative */}
                <div style={{ marginTop: 14, padding: "10px 12px", background: accent + "14", borderRadius: 8, border: `1px solid ${accent}33`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: accent, fontSize: 12, lineHeight: 1.4 }}>ⓘ</span>
                  <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                    La phase d'apprentissage algorithmique dure ~2 à 6 semaines. Les gains de {biz.cplShort} des premiers mois viennent surtout de l'optimisation continue (mots-clés, audiences, créas) et se stabilisent autour de −25 % à maturité.
                  </span>
                </div>
                {/* Garde-fou : signal insuffisant pour l'algorithme */}
                {lowSignal && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "#a6402a22", borderRadius: 8, border: "1px solid #a6402a66", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#e8843a", fontSize: 12, lineHeight: 1.4 }}>⚠</span>
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
                      ≈ {fmtLeads(leads)} {biz.conversionStage.toLowerCase()}/mois, sous le seuil de ~{MIN_SIGNAL_CONV} conversions/mois requis pour que l'algorithme optimise correctement. En dessous, la baisse de {biz.cplShort} ci-dessus est incertaine : prévoir plus de budget ou élargir le ciblage.
                    </span>
                  </div>
                )}
              </div>

              {/* Projection sur 12 mois — pondérée par la saisonnalité */}
              <div style={{ marginTop: 14, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 700, fontSize: 13, color: "#F6F1E8" }}>
                    Projection sur 12 mois
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                    {seasonalityEnabled
                      ? `Montée en charge + saisonnalité (×${highSeasonMultiplier.toFixed(1)} en haute saison)`
                      : `Montée en charge incluse · activez la saisonnalité pour pondérer les mois`}
                  </div>
                </div>

                {/* Barres mensuelles */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 130, marginTop: 16 }}>
                  {seasonalMonths.map((m, i) => {
                    const h = Math.max((m.leads / maxMonthLeads) * 100, 2);
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                        {m.high && (
                          <div style={{ fontSize: 8, fontWeight: 700, color: accent, marginBottom: 3 }}>{Math.round(m.leads).toLocaleString("fr-FR")}</div>
                        )}
                        <div style={{ width: "100%", height: `${h}%`, minHeight: 2, borderRadius: "3px 3px 0 0",
                          background: m.high ? accent : accent + "55", transition: "height .4s cubic-bezier(0.34,1.56,0.64,1)" }} />
                        <div style={{ fontSize: 8.5, color: m.high ? accent : "rgba(255,255,255,0.4)", fontWeight: m.high ? 700 : 400, marginTop: 5 }}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Récap annuel */}
                <div style={{ display: "flex", marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {[
                    { l: `${biz.conversionStage} / an`, v: Math.round(annualLeads).toLocaleString("fr-FR") },
                    ...(biz.hasClosing ? [{ l: `${biz.finalStage} / an`, v: Math.round(annualClients).toLocaleString("fr-FR") }] : []),
                    { l: "Budget 12 mois", v: `${Math.round(annualSpend).toLocaleString("fr-FR")} €` },
                    { l: recurring ? "Valeur générée 12 mois" : "CA cumulé 12 mois", v: `${Math.round(annualCA).toLocaleString("fr-FR")} €` },
                    { l: "ROAS 12 mois", v: `x${annualRoas.toFixed(2)}` },
                    { l: "ROI net 12 mois", v: `${annualRoiPct >= 0 ? "+" : ""}${Math.round(annualRoiPct)}%` },
                  ].map((s, i, arr) => (
                    <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.27)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 700, fontSize: 14, color: accent }}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {seasonalityEnabled && (
                  <div style={{ marginTop: 14, padding: "10px 12px", background: accent + "14", borderRadius: 8, border: `1px solid ${accent}33`, fontSize: 10.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                    Démarrage en {MONTH_NAMES[startMonth]}. Volume et budget des mois de haute saison pondérés ×{highSeasonMultiplier.toFixed(1)} ; les premiers mois intègrent la montée en charge (CPL décroissant).
                  </div>
                )}
              </div>
        </div>
      </div>

      {/* Mes rapports — rapports des espaces dont l'utilisateur est membre */}
      {myReportsOpen && (
        <div onMouseDown={() => setMyReportsOpen(false)} className="scroll-dark" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px", overflowY: "auto" }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: G, borderRadius: 14, border: `1px solid ${G3}`, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${G3}` }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: CREAM }}>Mes rapports</div>
              <button onClick={() => setMyReportsOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "16px 22px 22px" }}>
              {myReports === null ? (
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>Chargement…</div>
              ) : myReports.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                  Aucun rapport dans vos espaces pour l'instant.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {myReports.map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: G5, border: `1px solid ${G3}`, borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: CREAM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.prospect}</div>
                        <div style={{ fontSize: 11, color: "#8a9e98", marginTop: 2 }}>
                          {r.espace && r.espace !== "—" ? `${r.espace} · ` : ""}{r.vues || 0} vue{r.vues > 1 ? "s" : ""}{r.temps ? ` · ${fmtDuration(r.temps)}` : ""}
                        </div>
                      </div>
                      <button onClick={() => { if (r.state) window.location.href = `${window.location.origin}/?s=${r.state}`; }}
                        disabled={!r.state}
                        style={{ ...hOutBtn, flexShrink: 0, opacity: r.state ? 1 : 0.4, cursor: r.state ? "pointer" : "default", color: CREAM, borderColor: G3, background: "rgba(255,255,255,0.06)" }}>
                        Ouvrir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panneau de suivi des consultations */}
      {trackingOpen && (() => {
        const store = loadTracking();
        const entries = Object.entries(store)
          .map(([id, e]) => ({
            id, label: e.label, createdAt: e.createdAt,
            visits: (e.visits || []).slice().sort((a, b) => new Date(b.ts) - new Date(a.ts)),
          }))
          .map(e => ({ ...e, count: e.visits.length, total: e.visits.reduce((s, v) => s + (v.duration || 0), 0) }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return (
          <div onMouseDown={() => setTrackingOpen(false)} className="scroll-dark" style={{
            position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px", overflowY: "auto",
          }}>
            <div onMouseDown={e => e.stopPropagation()} style={{
              width: "100%", maxWidth: 600, background: "#0F332B", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden",
            }}>
              {/* En-tête */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 800, fontSize: 16, color: "#F6F1E8" }}>Suivi des consultations</div>
                <button onClick={() => setTrackingOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 20, lineHeight: 1 }}>×</button>
              </div>

              <div style={{ padding: "16px 22px 22px" }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 16, padding: "9px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                  Les statistiques sont enregistrées localement dans ce navigateur. Vous voyez les ouvertures de vos liens réalisées sur cet appareil ; un suivi des visites du prospect sur son propre appareil nécessiterait un serveur.
                </div>

                {entries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                    Aucun lien généré pour l'instant.<br />
                    <span style={{ fontSize: 11 }}>Cliquez sur « Générer lien » pour créer un lien suivi.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {entries.map(e => (
                      <div key={e.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 700, fontSize: 14, color: "#F6F1E8" }}>{e.label || "Sans nom"}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: accent + "1A", padding: "2px 9px", borderRadius: 12 }}>
                            {e.count} visite{e.count > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: e.count ? 10 : 0 }}>
                          Créé le {fmtDate(e.createdAt)}{e.total > 0 ? ` · ${fmtDuration(e.total)} cumulées` : ""}
                        </div>
                        {e.count > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {e.visits.map((v, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                <span style={{ color: "rgba(255,255,255,0.55)" }}>{fmtDate(v.ts)}</span>
                                <span style={{ color: accent, fontWeight: 600 }}>{fmtDuration(v.duration)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {entries.length > 0 && (
                  <button onClick={() => { saveTracking({}); setTrackingTick(t => t + 1); }} style={{
                    marginTop: 16, width: "100%", padding: "9px", borderRadius: 8, cursor: "pointer",
                    background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)", fontSize: 11.5,
                  }}>
                    Vider le suivi
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
