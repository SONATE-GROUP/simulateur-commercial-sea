import { useState, useEffect } from "react";
import Simulator from "../marketing-simulator.jsx";
import BackOffice from "./BackOffice.jsx";
import InviteAccept from "./InviteAccept.jsx";
import ResetPassword from "./ResetPassword.jsx";
import Login from "./Login.jsx";

// Routage minimal par chemin (API History, sans dépendance) : /back-office ↔ /.
const pathToView = (p) => (p === "/back-office" ? "backoffice" : "simulator");
const viewToPath = (v) => (v === "backoffice" ? "/back-office" : "/");

export default function App() {
  const [view, setView] = useState(() => pathToView(window.location.pathname));
  const [auth, setAuth] = useState(undefined); // undefined = chargement, null = non connecté

  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const resetToken = params.get("reset");
  const isShared = params.has("s"); // lien partagé → consultation publique (prospect)
  const needsAuth = !inviteToken && !resetToken && !isShared;

  useEffect(() => {
    if (!needsAuth) return;
    let alive = true;
    fetch("/api/me", { headers: { "X-Requested-With": "fetch" } })
      .then(r => (r.ok ? r.json() : null))
      .then(u => { if (alive) setAuth(u); })
      .catch(() => { if (alive) setAuth(null); });
    return () => { alive = false; };
  }, [needsAuth]);

  const logout = async () => {
    try { await fetch("/api/logout", { method: "POST", headers: { "X-Requested-With": "fetch" } }); } catch (_) { /* */ }
    setAuth(null);
  };

  // Met à jour l'URL en même temps que l'écran, et suit les boutons précédent/suivant.
  const navigate = (v) => {
    setView(v);
    const path = viewToPath(v);
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
  };
  useEffect(() => {
    const onPop = () => setView(pathToView(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Suivi du temps passé par l'utilisateur connecté : battements réguliers qui
  // ne comptent que le temps onglet visible. La durée est cumulée côté serveur.
  useEffect(() => {
    if (!needsAuth || !auth?.email) return;
    let last = Date.now();
    const beat = () => {
      const sec = Math.round((Date.now() - last) / 1000);
      last = Date.now();
      if (sec <= 0) return;
      fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
        body: JSON.stringify({ duration: sec }),
        keepalive: true,
      }).catch(() => {});
    };
    const tick = () => { if (document.visibilityState === "visible") beat(); };
    const iv = setInterval(tick, 30000);
    const onVis = () => {
      if (document.visibilityState === "hidden") beat(); // cumule le temps visible écoulé
      else last = Date.now();                            // reprise : on ne compte pas le temps masqué
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", beat);
    return () => {
      clearInterval(iv);
      beat();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", beat);
    };
  }, [needsAuth, auth?.email]);

  // 1) Activation d'une invitation (destinataire sans compte).
  if (inviteToken) return <InviteAccept token={inviteToken} />;

  // 1bis) Réinitialisation de mot de passe (lien reçu par email).
  if (resetToken) return <ResetPassword token={resetToken} />;

  // 2) Lien partagé → consultation publique, sans connexion.
  if (isShared) return <Simulator consultation />;

  // 3) Accès au simulateur : connexion requise.
  if (auth === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a2e25", color: "rgba(255,255,255,0.5)", fontFamily: "'Inter',sans-serif" }}>Chargement…</div>;
  }
  if (!auth) return <Login onAuthed={setAuth} />;

  return view === "backoffice"
    ? <BackOffice onBack={() => navigate("simulator")} />
    : <Simulator
        user={auth}
        onLogout={logout}
        onOpenBackOffice={auth.role === "Admin" ? () => navigate("backoffice") : undefined}
      />;
}
