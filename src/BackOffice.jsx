import { useState, useEffect } from "react";
import { fmtDuration, fmtDate, decodeState as decode } from "./tracking";
import { SECTORS } from "./config/defaults";
import { listReports, listAccounts, moveReport, deleteReport } from "./lib/reports";
import { PORTAL_TEAM_URL } from "./lib/portal";

const decodeState = (st) => { try { return decode(st); } catch { return {}; } };

const BG = "#0F332B";
const SIDEBAR = "#0C2A23";
const CARD = "rgba(255,255,255,0.03)";
const CREAM = "#F6F1E8";
const ACCENT = "#FF6B3D";
const MUTED = "rgba(255,255,255,0.4)";
const BORDER = "rgba(255,255,255,0.08)";

const REPORTS_ICON = "M9 3h6a2 2 0 012 2v0H7v0a2 2 0 012-2zM7 5h10v15a1 1 0 01-1 1H8a1 1 0 01-1-1V5z";
const TEAM_ICON = "M12 12a4 4 0 100-8 4 4 0 000 8zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2";

function Icon({ d }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// Back-office des admins de l'outil. Depuis la fusion dans Ma Sonate (ADR 0005
// du portail) :
//   · l'« espace client » d'un rapport est son COMPTE du portail ; le changer
//     demande un motif, tracé côté portail ;
//   · les personnes et leurs accès se gèrent dans Ma Sonate, Admin → Équipe.
export default function BackOffice({ user, onBack, onLogout }) {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const [all, setAll] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [reports, accs] = await Promise.all([listReports(), listAccounts()]);
      setAll(reports); setAccounts(accs); setError("");
    } catch (e) {
      setAll([]); setError(e.message || "Chargement impossible.");
    }
  };
  useEffect(() => { load(); }, []);

  const rowsAll = all || [];
  const accountOptions = Array.from(new Map(rowsAll.map(e => [e.accountId, e.accountName])).entries())
    .sort((a, b) => a[1].localeCompare(b[1]));

  let rows = rowsAll.filter(e =>
    (!search || e.prospect.toLowerCase().includes(search.toLowerCase())) &&
    (!accountFilter || e.accountId === accountFilter)
  );
  rows.sort((a, b) => {
    if (sort === "vues") return b.vues - a.vues;
    if (sort === "ancien") return new Date(a.creation) - new Date(b.creation);
    return new Date(b.creation) - new Date(a.creation); // recent
  });

  const openReport = (e) => {
    if (!e.state) return;
    // Ouverture interne (sans &t=) : ne compte pas comme une consultation prospect.
    window.location.href = `${window.location.origin}/?s=${encodeURIComponent(e.state)}`;
  };
  const moveReportTo = async (e, accountId) => {
    if (!accountId || accountId === e.accountId) return;
    const target = accounts.find(a => a.id === accountId)?.name || "ce compte";
    const reason = window.prompt(`Rattacher « ${e.prospect} » à ${target}.\nMotif (10 caractères au moins) :`);
    if (reason === null) return;
    try { await moveReport(e.id, accountId, reason); await load(); }
    catch (err) { window.alert(err.message || "Rattachement refusé."); }
  };
  const removeReport = async (e) => {
    if (!window.confirm(`Supprimer le rapport « ${e.prospect} » ? Le lien partagé continuera de s'afficher, mais ses visites ne seront plus comptées.`)) return;
    try { await deleteReport(e.id); await load(); }
    catch (err) { window.alert(err.message || "Suppression refusée."); }
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 9,
    padding: "11px 14px", color: CREAM, fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif",
  };
  const actionBtn = (variant) => ({
    padding: "6px 13px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s", fontFamily: "'DM Sans',sans-serif",
    ...(variant === "ouvrir"
      ? { background: "rgba(255,255,255,0.08)", border: `1px solid ${BORDER}`, color: CREAM }
      : variant === "supprimer"
      ? { background: "transparent", border: "1px solid rgba(255,107,61,0.35)", color: ACCENT }
      : { background: "transparent", border: `1px solid ${BORDER}`, color: MUTED }),
  });
  const th = { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", textAlign: "left", padding: "0 10px 14px" };
  const td = { fontSize: 12.5, color: "rgba(255,255,255,0.75)", padding: "16px 10px", verticalAlign: "middle" };
  const navBtn = (active) => ({
    display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 9,
    cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: active ? 700 : 500,
    background: active ? "rgba(255,107,61,0.12)" : "transparent",
    border: active ? "1px solid rgba(255,107,61,0.3)" : "1px solid transparent",
    color: active ? ACCENT : "rgba(255,255,255,0.6)", transition: "all 0.15s", textDecoration: "none",
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: BG, fontFamily: "'DM Sans',sans-serif", color: CREAM }}>
      {/* ── Sidebar ── */}
      <aside style={{ width: 260, flexShrink: 0, background: SIDEBAR, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "22px 22px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: CREAM }}>Sonate</div>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", color: MUTED, marginTop: 2 }}>BACK-OFFICE</div>
        </div>

        <nav style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div style={navBtn(true)}><Icon d={REPORTS_ICON} />Rapports</div>
          {PORTAL_TEAM_URL && (
            <a href={PORTAL_TEAM_URL} target="_blank" rel="noreferrer" title="Les accès au simulateur se donnent dans Ma Sonate" style={navBtn(false)}>
              <Icon d={TEAM_ICON} />Équipe (Ma Sonate) ↗
            </a>
          )}
        </nav>

        <div style={{ padding: 14, borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onBack} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", borderRadius: 9,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700,
            background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: ACCENT,
          }}>
            ← Simulateur
          </button>
          <div style={{ padding: "12px 4px 2px" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{user.email}</div>
            <button onClick={onLogout} style={{ marginTop: 8, background: "transparent", border: "none", color: ACCENT, fontSize: 11.5, cursor: "pointer", padding: 0, fontFamily: "'DM Sans',sans-serif" }}>Se déconnecter</button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: "30px 38px 60px", maxWidth: 1500 }}>
        <h1 style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em", margin: 0, color: CREAM }}>Rapports enregistrés</h1>
        <div style={{ fontSize: 13.5, color: MUTED, marginTop: 6, marginBottom: 26 }}>
          {rowsAll.length} simulation{rowsAll.length > 1 ? "s" : ""} sauvegardée{rowsAll.length > 1 ? "s" : ""}
        </div>

        {error && <div style={{ color: ACCENT, fontSize: 13, marginBottom: 18 }}>{error}</div>}

        {/* Filtres */}
        <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un prospect…"
            style={{ ...inputStyle, flex: 1, minWidth: 240 }} />
          <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} style={{ ...inputStyle, minWidth: 180, cursor: "pointer" }}>
            <option value="">Tous les comptes</option>
            {accountOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...inputStyle, minWidth: 180, cursor: "pointer" }}>
            <option value="recent">Plus récent d'abord</option>
            <option value="ancien">Plus ancien d'abord</option>
            <option value="vues">Plus consultés</option>
          </select>
        </div>

        {all === null ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.35)", fontSize: 14 }}>Chargement…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
            {rowsAll.length === 0
              ? "Aucun rapport enregistré. Générez un lien depuis le simulateur pour le retrouver ici."
              : "Aucun rapport ne correspond à votre recherche."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={th}>Prospect</th>
                <th style={th}>Secteur</th>
                <th style={th}>Compte Ma Sonate</th>
                <th style={th}>Créé par</th>
                <th style={{ ...th, textAlign: "right" }}>Vues</th>
                <th style={{ ...th, textAlign: "right" }}>Temps passé</th>
                <th style={th}>Dernière consult.</th>
                <th style={th}>Création</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id} style={{ background: CARD }}>
                  <td style={{ ...td, borderRadius: "10px 0 0 10px" }}>
                    <div style={{ fontWeight: 700, color: CREAM }}>{e.prospect}</div>
                    {e.website && <div style={{ fontSize: 11.5, color: MUTED, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.website}</div>}
                  </td>
                  <td style={{ ...td, color: MUTED }}>{SECTORS[decodeState(e.state).sector] || "-"}</td>
                  <td style={td}>
                    <select value={e.accountId} onChange={ev => moveReportTo(e, ev.target.value)} title="Rattacher à un autre compte (motif demandé)"
                      style={{ ...actionBtn("deplacer"), cursor: "pointer", appearance: "auto", maxWidth: 200, color: e.internal ? MUTED : "rgba(255,255,255,0.8)" }}>
                      {!accounts.some(a => a.id === e.accountId) && <option value={e.accountId}>{e.accountName || "Compte inconnu"}</option>}
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, color: MUTED }}>{e.createdBy || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: e.vues ? "#5fb98a" : "rgba(255,255,255,0.25)" }}>{e.vues || "-"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{e.temps ? fmtDuration(e.temps) : <span style={{ color: "rgba(255,255,255,0.25)" }}>-</span>}</td>
                  <td style={td}>
                    {e.derniere
                      ? fmtDate(e.derniere)
                      : <span style={{ fontStyle: "italic", color: "rgba(255,255,255,0.3)" }}>Jamais consulté</span>}
                  </td>
                  <td style={{ ...td, color: MUTED }}>{fmtDate(e.creation)}</td>
                  <td style={{ ...td, borderRadius: "0 10px 10px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => openReport(e)} disabled={!e.state} style={{ ...actionBtn("ouvrir"), opacity: e.state ? 1 : 0.4, cursor: e.state ? "pointer" : "default" }}>Ouvrir</button>{" "}
                    <button onClick={() => removeReport(e)} style={actionBtn("supprimer")}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
