// Le portail Ma Sonate, dont le Simulateur SEA partage l'Auth.
//
// VITE_PORTAL_URL est une variable de BUILD, propre à chaque environnement
// (https://dev.ma.sonate.group, https://staging.ma.sonate.group,
// https://ma.sonate.group). Sans elle, les liens vers le portail
// n'apparaissent pas.
export const PORTAL_URL = String(import.meta.env.VITE_PORTAL_URL ?? "").replace(/\/+$/, "");

// Console de l'équipe : le portail connecte si besoin (Google), puis revient
// ici avec un ticket signé (route /sso, `api/sso.ts`).
export const PORTAL_CONSOLE_URL = PORTAL_URL ? `${PORTAL_URL}/api/tools/simulateur-sea/console` : "";

// Mot de passe oublié : celui du portail, le mot de passe est commun.
export const PORTAL_FORGOT_URL = PORTAL_URL ? `${PORTAL_URL}/auth/mot-de-passe-oublie` : "";

// Les accès à l'outil se donnent dans l'écran Équipe du portail.
export const PORTAL_TEAM_URL = PORTAL_URL ? `${PORTAL_URL}/admin/equipe` : "";
