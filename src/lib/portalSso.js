import { supabase } from "./supabase";

// Arrivée depuis le portail Ma Sonate (lot 6 de la fusion). Copie de
// `TABLATURE/src/lib/portalSso.ts`, sans les projets.
//
// La fonction `/sso` (`api/sso.ts`) a validé un ticket signé de 60 s, frappé
// une session Supabase côté serveur et déposé un code dans un cookie HttpOnly.
// Ce code, la SPA ne peut pas le lire : c'est tout l'intérêt. Son seul signal
// est le marqueur ci-dessous, qui ne porte aucun secret et dit seulement
// « viens voir ».
const PORTAL_MARKER = "simulateur_sea_sso";

// Ce qu'on dit quand `/sso` a refusé l'entrée (`?sso=<motif>`).
const SSO_MESSAGES = {
  absent: "Lien d'accès incomplet. Repartez de Ma Sonate.",
  invalide: "Ce lien d'accès n'est pas valide. Repartez de Ma Sonate.",
  expire: "Ce lien d'accès a expiré : il ne vaut qu'une minute. Relancez l'ouverture depuis Ma Sonate.",
  rejeu: "Ce lien d'accès a déjà servi. Relancez l'ouverture depuis Ma Sonate.",
  suspendu: "L'accès est suspendu.",
  equipe: "Le Simulateur SEA est réservé à l'équipe Sonate.",
  inconnu: "Votre compte n'est pas encore ouvert dans le Simulateur SEA. Demandez l'accès à un administrateur de Ma Sonate.",
  indisponible: "La connexion depuis Ma Sonate est momentanément indisponible. Réessayez dans un instant.",
};

// Le motif de refus, lu UNE fois au chargement du module puis retiré de
// l'adresse : sans ça, il survivrait à un rechargement et réapparaîtrait après
// une connexion réussie. Lu ici plutôt que dans un composant, que le mode
// strict de React rend deux fois.
export const SSO_REFUSAL = (() => {
  try {
    const u = new URL(window.location.href);
    const motif = u.searchParams.get("sso");
    if (!motif) return null;
    u.searchParams.delete("sso");
    window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
    return SSO_MESSAGES[motif] ?? SSO_MESSAGES.invalide;
  } catch {
    return null;
  }
})();

function hasPortalHandoff() {
  try {
    return document.cookie.split(";").some(c => c.trim().startsWith(`${PORTAL_MARKER}=1`));
  } catch {
    return false;
  }
}

async function boot() {
  if (!supabase) return { fromPortal: false, failed: false };
  const before = (await supabase.auth.getSession()).data.session;

  if (hasPortalHandoff()) {
    try {
      const res = await fetch("/api/sso?action=claim", { method: "POST", credentials: "same-origin" });
      const data = res.ok ? await res.json() : null;
      const s = data?.session;
      if (s?.access_token && s?.refresh_token) {
        // Une session venue du portail REMPLACE celle qui traînait, elle ne s'y
        // ajoute pas : sinon on resterait connecté sous une autre identité que
        // celle du ticket qu'on vient de présenter.
        const { data: set, error } = await supabase.auth.setSession({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
        });
        if (!error && set.session) return { fromPortal: true, failed: false };
      }
    } catch {
      /* réseau : on retombe sur la session d'avant */
    }
    return { fromPortal: false, failed: true };
  }

  // Jeton renouvelé au démarrage : il fige pour une heure le statut d'équipe
  // (claims posées par le hook du portail). Un échec réseau ne déconnecte pas.
  if (before) await supabase.auth.refreshSession();
  return { fromPortal: false, failed: false };
}

let started = null;

// Démarrage de la session : reprise depuis le portail s'il y a un marqueur,
// sinon jeton renouvelé. UNE fois par chargement de page, même si React monte
// deux fois le composant (mode strict) : la reprise est à usage unique.
export function bootSession() {
  started ??= boot();
  return started;
}
