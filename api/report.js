// POST /api/report — upsert d'un rapport (créé par le simulateur quand un
// utilisateur génère un lien). Connexion requise ; interdit aux Lecteurs.
import { upsertReportMeta, dbConfigured } from "./_db.js";
import { getUser } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Connexion requise pour enregistrer." });
  if (user.role === "Lecteur") return res.status(403).json({ error: "Les lecteurs ne peuvent pas enregistrer de rapport." });

  if (!dbConfigured()) return res.status(200).json({ ok: false, skipped: true });

  const { linkId, label, website, espace, state } = req.body || {};
  if (!linkId) return res.status(400).json({ error: "linkId requis." });

  try {
    await upsertReportMeta(linkId, { label, website, espace, state, createdBy: user.email });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
  return res.status(200).json({ ok: true });
}
