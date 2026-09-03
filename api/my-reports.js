// GET /api/my-reports — rapports créés par l'utilisateur connecté, plus ceux
// des espaces dont il est membre. Accessible à tout compte connecté
// (Lecteur / Éditeur / Admin).
import { listSpaces, listReports, dbConfigured } from "./_db.js";
import { getUser } from "./_auth.js";

export default async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });
  if (!dbConfigured()) return res.status(200).json({ reports: [] });

  try {
    const spaces = await listSpaces();
    const myNames = new Set(
      spaces.filter(s => (s.members || []).some(m => m.email === user.email)).map(s => s.name)
    );
    const reports = (await listReports()).filter(r => r.createdBy === user.email || myNames.has(r.espace));
    return res.status(200).json({ reports });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
