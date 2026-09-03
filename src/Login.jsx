import { useState } from "react";

const G = "#1a2e25", G2 = "#142218", G5 = "#233d30", G3 = "#2d4a3e";
const CREAM = "#f5f0e8", ORANGE = "#e8571a", MUTED = "rgba(255,255,255,0.5)";

export default function Login({ onAuthed, onBack }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  const submit = async () => {
    if (!email || !password) return;
    if (isSignup && password.length < 8) { setError("Mot de passe d'au moins 8 caractères."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch(isSignup ? "/api/signup" : "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
        body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) onAuthed(d);
      else setError(d.error || (isSignup ? "Création impossible." : "Connexion refusée."));
    } catch (_) {
      setError("Service indisponible (fonctionne une fois déployé sur Vercel).");
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    if (!email) return;
    setBusy(true); setError("");
    try {
      await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Réponse volontairement générique côté serveur : on ne révèle jamais
      // si un compte existe pour cet email.
      setForgotSent(true);
    } catch (_) {
      setError("Service indisponible (fonctionne une fois déployé sur Vercel).");
    } finally {
      setBusy(false);
    }
  };

  const backToLogin = () => { setMode("login"); setError(""); setForgotSent(false); setPassword(""); };

  const input = { width: "100%", boxSizing: "border-box", background: G2, border: `1px solid ${G3}`, borderRadius: 9, padding: "12px 14px", color: CREAM, fontSize: 14, outline: "none", fontFamily: "'Inter',sans-serif", marginBottom: 12 };

  return (
    <div style={{ minHeight: "100vh", background: G, color: CREAM, fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, background: G5, borderRadius: 16, border: `1px solid ${G3}`, padding: "32px 34px", boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em" }}>Sonate</div>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", color: ORANGE, textTransform: "uppercase", marginTop: 2, marginBottom: 6 }}>Simulateur SEA/SMA</div>

        {isForgot ? (
          forgotSent ? (
            <>
              <div style={{ color: MUTED, fontSize: 13.5, marginBottom: 22, lineHeight: 1.6 }}>
                Si un compte existe pour <strong style={{ color: CREAM }}>{email}</strong>, un email avec un lien de réinitialisation vient d'être envoyé (valable 1 heure).
              </div>
              <button onClick={backToLogin} style={{ width: "100%", padding: "13px", borderRadius: 9, border: "none", background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                Retour à la connexion
              </button>
            </>
          ) : (
            <>
              <div style={{ color: MUTED, fontSize: 13.5, marginBottom: 22 }}>
                Indiquez votre email, vous recevrez un lien pour choisir un nouveau mot de passe.
              </div>
              <input value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitForgot()} placeholder="Email" style={input} />
              {error && <div style={{ color: ORANGE, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
              <button onClick={submitForgot} disabled={busy || !email} style={{ width: "100%", padding: "13px", borderRadius: 9, border: "none", background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy || !email ? 0.7 : 1, fontFamily: "'Inter',sans-serif" }}>
                {busy ? "…" : "Envoyer le lien"}
              </button>
              <button onClick={backToLogin} style={{ width: "100%", marginTop: 14, padding: 0, background: "transparent", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                ← Retour à la connexion
              </button>
            </>
          )
        ) : (
          <>
            <div style={{ color: MUTED, fontSize: 13.5, marginBottom: 22 }}>
              {isSignup ? "Créez votre compte pour accéder au simulateur." : "Connectez-vous pour accéder au simulateur."}
            </div>

            {isSignup && (
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Votre nom (optionnel)" style={input} />
            )}
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={input} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()} placeholder={isSignup ? "Mot de passe (8 car. min.)" : "Mot de passe"} style={input} />
            {!isSignup && (
              <button onClick={() => { setMode("forgot"); setError(""); }} style={{ display: "block", marginBottom: 12, padding: 0, background: "transparent", border: "none", color: MUTED, fontSize: 12.5, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                Mot de passe oublié ?
              </button>
            )}
            {error && <div style={{ color: ORANGE, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

            <button onClick={submit} disabled={busy} style={{ width: "100%", padding: "13px", borderRadius: 9, border: "none", background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "'Inter',sans-serif" }}>
              {busy ? "…" : isSignup ? "Créer mon compte" : "Se connecter"}
            </button>

            <button onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); }} style={{ width: "100%", marginTop: 14, padding: 0, background: "transparent", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              {isSignup
                ? <>Déjà un compte ? <span style={{ color: ORANGE, fontWeight: 600 }}>Se connecter</span></>
                : <>Pas de compte ? <span style={{ color: ORANGE, fontWeight: 600 }}>Créer un compte</span></>}
            </button>

            {onBack && (
              <button onClick={onBack} style={{ width: "100%", marginTop: 10, padding: "8px", borderRadius: 9, border: "none", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 12.5, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                ← Retour au simulateur
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
