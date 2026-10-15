import { useState } from "react";
import { supabase } from "./lib/supabase";
import { PORTAL_CONSOLE_URL, PORTAL_FORGOT_URL } from "./lib/portal";

const G = "#1a2e25", G2 = "#142218", G5 = "#233d30", G3 = "#2d4a3e";
const CREAM = "#f5f0e8", ORANGE = "#e8571a", MUTED = "rgba(255,255,255,0.5)";

// Connexion avec le compte Ma Sonate. L'équipe passe d'abord par le bouton
// « Se connecter avec Ma Sonate » (Google, comme sur le portail) ; le mot de
// passe du portail reste accepté. Aucun compte ne naît ici : les accès se
// donnent dans l'écran Équipe du portail. Mot de passe oublié : celui du portail.
export default function Login({ notice }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password || !supabase) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError(err.message === "Invalid login credentials" ? "Adresse ou mot de passe incorrect." : err.message);
    setBusy(false);
  };

  const input = { width: "100%", boxSizing: "border-box", background: G2, border: `1px solid ${G3}`, borderRadius: 9, padding: "12px 14px", color: CREAM, fontSize: 14, outline: "none", fontFamily: "'Inter',sans-serif", marginBottom: 12 };
  const primary = { display: "block", boxSizing: "border-box", width: "100%", padding: "13px", borderRadius: 9, border: "none", background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "center", textDecoration: "none", fontFamily: "'Inter',sans-serif" };
  const secondary = { ...primary, background: "transparent", border: `1px solid ${G3}`, color: CREAM };

  return (
    <div style={{ minHeight: "100vh", background: G, color: CREAM, fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, background: G5, borderRadius: 16, border: `1px solid ${G3}`, padding: "32px 34px", boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em" }}>Sonate</div>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: ORANGE, textTransform: "uppercase", marginTop: 2, marginBottom: 6 }}>Simulateur SEA/SMA</div>

        {notice && (
          <div style={{ background: "rgba(232,87,26,0.12)", border: "1px solid rgba(232,87,26,0.35)", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5, margin: "12px 0 4px" }}>{notice}</div>
        )}

        <div style={{ color: MUTED, fontSize: 13.5, margin: "12px 0 22px" }}>
          Connectez-vous avec votre compte <strong style={{ color: CREAM }}>Ma Sonate</strong>.
        </div>

        {PORTAL_CONSOLE_URL && (
          <>
            <a href={PORTAL_CONSOLE_URL} style={primary}>Se connecter avec Ma Sonate</a>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", color: "rgba(255,255,255,0.3)", fontSize: 11.5 }}>
              <span style={{ height: 1, flex: 1, background: G3 }} />ou avec le mot de passe du portail<span style={{ height: 1, flex: 1, background: G3 }} />
            </div>
          </>
        )}

        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoComplete="email" style={input} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="Mot de passe" autoComplete="current-password" style={input} />
        {PORTAL_FORGOT_URL && (
          <a href={PORTAL_FORGOT_URL} style={{ display: "block", marginBottom: 12, color: MUTED, fontSize: 12.5, textDecoration: "none" }}>
            Mot de passe oublié ?
          </a>
        )}
        {error && <div style={{ color: ORANGE, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

        <button onClick={submit} disabled={busy || !email || !password} style={{ ...(PORTAL_CONSOLE_URL ? secondary : primary), cursor: busy ? "default" : "pointer", opacity: busy || !email || !password ? 0.6 : 1 }}>
          {busy ? "…" : "Se connecter"}
        </button>

        <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${G3}`, color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 1.5 }}>
          Réservé à l'équipe Sonate. L'accès se donne dans Ma Sonate, Admin → Équipe.
        </div>
      </div>
    </div>
  );
}
