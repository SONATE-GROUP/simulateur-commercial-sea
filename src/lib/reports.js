import { supabase } from "./supabase";

// Accès aux rapports, dans le schéma `simulateur_sea` du portail Ma Sonate.
// Remplace les fonctions `api/*.js` et la base Turso. Les droits ne sont pas
// vérifiés ici : la RLS les applique (migration 0057 du portail).
//   · admin de l'outil : tout ; member : lit tout, écrit ses rapports ;
//   · un prospect sans compte n'appelle que `recordVisit`.

// Le compte « Sonate interne » : où va un rapport tant qu'aucun compte du
// portail ne lui est donné. Même identifiant que `simulateur_sea.internal_account_id()`.
export const INTERNAL_ACCOUNT_ID = "eeeeeeee-0000-0000-0000-000000000005";

const need = () => {
  if (!supabase) throw new Error("Base indisponible : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquent.");
  return supabase;
};

// Le rôle de la personne connectée dans l'outil : "admin", "member" ou null
// (pas d'accès). Lu dans l'écran Équipe du portail, à chaque appel.
export async function getToolRole() {
  const { data, error } = await need().rpc("tool_role");
  if (error) throw error;
  return data || null;
}

// Tous les rapports visibles, avec leurs statistiques de consultation, le nom
// de leur compte et l'adresse de leur auteur. Forme attendue par l'interface.
export async function listReports() {
  const db = need();
  const [reports, visits, accounts, authors] = await Promise.all([
    db.from("reports").select("id,label,website,state,account_id,created_by,created_at").order("created_at", { ascending: false }),
    db.from("report_visits").select("report_id,visited_at,duration"),
    db.rpc("report_accounts"),
    db.rpc("report_authors"),
  ]);
  for (const r of [reports, visits, accounts, authors]) if (r.error) throw r.error;

  const accountName = new Map((accounts.data || []).map(a => [a.report_id, a.account_name]));
  const authorEmail = new Map((authors.data || []).map(a => [a.user_id, a.email]));
  const visitsOf = new Map();
  for (const v of visits.data || []) {
    if (!visitsOf.has(v.report_id)) visitsOf.set(v.report_id, []);
    visitsOf.get(v.report_id).push(v);
  }

  return (reports.data || []).map(r => {
    const vs = visitsOf.get(r.id) || [];
    const last = vs.reduce((a, b) => (!a || new Date(b.visited_at) > new Date(a) ? b.visited_at : a), null);
    return {
      id: r.id,
      prospect: r.label || "Sans nom",
      website: r.website || "",
      accountId: r.account_id,
      accountName: accountName.get(r.id) || "",
      internal: r.account_id === INTERNAL_ACCOUNT_ID,
      vues: vs.length,
      temps: vs.reduce((s, v) => s + (v.duration || 0), 0),
      derniere: last,
      creation: r.created_at,
      state: r.state,
      createdById: r.created_by,
      createdBy: authorEmail.get(r.created_by) || null,
    };
  });
}

// Enregistre un rapport : création, ou mise à jour du même lien (même linkId).
// En deux temps plutôt qu'un upsert : le compte et l'auteur ne s'écrivent pas
// depuis le front (UPDATE accordé par colonne), et une mise à jour ne doit
// toucher que le contenu. Une mise à jour refusée par la RLS (rapport d'un
// autre) ne modifie aucune ligne : on le signale.
export async function saveReport({ id, label, website, state }) {
  const db = need();
  const content = { label: (label || "Sans nom").slice(0, 200), website: (website || "").slice(0, 500), state };
  const ins = await db.from("reports").insert({ id, ...content });
  if (!ins.error) return { created: true };
  if (ins.error.code !== "23505") throw ins.error;
  const upd = await db.from("reports").update(content).eq("id", id).select("id");
  if (upd.error) throw upd.error;
  if (!upd.data?.length) throw new Error("Ce rapport appartient à quelqu'un d'autre : seul un administrateur peut le modifier.");
  return { created: false };
}

// La consultation d'un lien partagé, par un prospect sans compte. Ne lève
// jamais : un suivi qui échoue ne doit pas gêner la lecture du rapport.
export async function recordVisit(reportId, visitId, duration) {
  if (!supabase) return false;
  try {
    const { data } = await supabase.rpc("record_visit", {
      p_report_id: reportId, p_visit_id: visitId, p_duration: Math.round(duration) || 0,
    });
    return data === true;
  } catch {
    return false;
  }
}

export async function deleteReport(id) {
  const { data, error } = await need().from("reports").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Suppression refusée : réservée aux administrateurs.");
}

// Rattacher un rapport à un autre compte du portail : admin, motif obligatoire.
export async function moveReport(id, accountId, reason) {
  const { error } = await need().rpc("move_report_account", {
    p_report_id: id, p_account_id: accountId, p_reason: reason,
  });
  if (error) throw error;
}

// Les comptes du portail qu'on peut donner à un rapport.
export async function listAccounts() {
  const { data, error } = await need().rpc("list_accounts");
  if (error) throw error;
  return data || [];
}
