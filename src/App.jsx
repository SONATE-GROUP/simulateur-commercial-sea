import { useState, useEffect } from "react";
import Simulator from "../marketing-simulator.jsx";
import BackOffice from "./BackOffice.jsx";
import Login from "./Login.jsx";
import { supabase } from "./lib/supabase";
import { bootSession, SSO_REFUSAL } from "./lib/portalSso";
import { getToolRole } from "./lib/reports";
import { PORTAL_URL } from "./lib/portal";

// Routage minimal par chemin (API History, sans dépendance) : /back-office ↔ /.
const pathToView = (p) => (p === "/back-office" ? "backoffice" : "simulator");
const viewToPath = (v) => (v === "backoffice" ? "/back-office" : "/");

// Libellés de l'interface pour les deux niveaux de l'écran Équipe du portail.
const ROLE_LABELS = { admin: "Admin", member: "Éditeur" };

const REPRISE_ECHOUEE = "La connexion depuis Ma Sonate n'a pas abouti. Relancez l'ouverture depuis Ma Sonate.";

const screen = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a2e25", color: "rgba(255,255,255,0.5)", fontFamily: "'Inter',sans-serif" };

// L'Auth est celle du portail Ma Sonate (ADR 0005 du portail) : on entre par
// la console de l'équipe (ticket signé, `api/sso.ts`) ou par le mot de passe
// du portail. Les invitations, l'inscription et le mot de passe oublié du
// simulateur ont disparu : les accès se donnent dans l'écran Équipe.
export default function App() {
  const [view, setView] = useState(() => pathToView(window.location.pathname));
  const [session, setSession] = useState(undefined); // undefined = chargement, null = non connecté
  const [role, setRole] = useState(undefined);       // undefined = chargement, null = pas d'accès
  const [notice, setNotice] = useState(SSO_REFUSAL);

  const isShared = new URLSearchParams(window.location.search).has("s"); // lien partagé → consultation publique (prospect)

  useEffect(() => {
    if (isShared || !supabase) { setSession(null); return; }
    let alive = true;
    bootSession().then(async (boot) => {
      if (!alive) return;
      if (boot.failed) setNotice(REPRISE_ECHOUEE);
      const { data } = await supabase.auth.getSession();
      if (alive) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [isShared]);

  // Le rôle dans l'outil, relu à chaque nouvelle session : un accès retiré
  // dans l'écran Équipe l'est dès le chargement suivant.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) { setRole(undefined); return; }
    let alive = true;
    getToolRole().then(r => { if (alive) setRole(r); }).catch(() => { if (alive) setRole(null); });
    return () => { alive = false; };
  }, [userId]);

  const logout = async () => {
    try { await supabase?.auth.signOut(); } catch (_) { /* */ }
    setSession(null);
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

  // 1) Lien partagé → consultation publique, sans connexion.
  if (isShared) return <Simulator consultation />;

  // 2) Accès au simulateur : connexion Ma Sonate requise.
  if (session === undefined || (session && role === undefined)) {
    return <div style={screen}>Chargement…</div>;
  }
  if (!session) return <Login notice={notice} />;
  if (!role) {
    return (
      <div style={{ ...screen, flexDirection: "column", gap: 14, padding: 24, textAlign: "center" }}>
        <div style={{ color: "#F6F1E8", fontSize: 16, fontWeight: 600 }}>Votre compte n'a pas accès au Simulateur SEA.</div>
        <div style={{ maxWidth: 440, lineHeight: 1.6, fontSize: 13.5 }}>
          Connecté en tant que {session.user.email}. L'accès se donne dans Ma Sonate, Admin → Équipe.
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
          {PORTAL_URL && <a href={PORTAL_URL} style={{ color: "#FF6B3D" }}>Ouvrir Ma Sonate</a>}
          <button onClick={logout} style={{ background: "none", border: "none", color: "#FF6B3D", cursor: "pointer", fontSize: 13, padding: 0 }}>Se déconnecter</button>
        </div>
      </div>
    );
  }

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
    role: ROLE_LABELS[role] || role,
    isAdmin: role === "admin",
  };

  return view === "backoffice" && user.isAdmin
    ? <BackOffice user={user} onBack={() => navigate("simulator")} onLogout={logout} />
    : <Simulator
        user={user}
        onLogout={logout}
        onOpenBackOffice={user.isAdmin ? () => navigate("backoffice") : undefined}
      />;
}
