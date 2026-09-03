// /api/reset-password — mot de passe oublié, en un seul fichier (le plan
// Vercel Hobby limite à 12 fonctions serverless, cf. admin.js).
//   GET  ?token=…              → statut du lien (pending/expired/used/invalid)
//   POST { email }             → envoie un lien de réinitialisation par email
//   POST { token, password }   → applique le nouveau mot de passe
//
// Variables Brevo : BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME (opt).
import { randomBytes } from "crypto";
import { getUserRaw, updateUserPassword, hashPassword, dbConfigured, getReset, upsertReset, setResetUsed } from "./_db.js";

// Plus court qu'une invitation (7 jours) : action sensible sur un compte existant.
const RESET_TTL_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method === "GET") return status(req, res);
  if (req.method === "POST") return post(req, res);
  return res.status(405).json({ error: "Méthode non autorisée." });
}

async function status(req, res) {
  const token = req.query?.token;
  if (!token) return res.status(400).json({ error: "Token requis." });
  if (!dbConfigured()) return res.status(200).json({ status: "unknown" });

  let r;
  try { r = await getReset(token); } catch (e) { return res.status(500).json({ error: String(e) }); }
  if (!r) return res.status(404).json({ status: "invalid" });

  const expired = r.expiresAt && Date.now() > new Date(r.expiresAt).getTime();
  return res.status(200).json({ status: r.usedAt ? "used" : expired ? "expired" : "pending" });
}

async function post(req, res) {
  if (!dbConfigured()) return res.status(500).json({ error: "Backend non configuré (base Turso manquante)." });
  const { email, token, password } = req.body || {};

  // Étape 1 : demande de réinitialisation — réponse générique dans tous les
  // cas, pour ne jamais révéler si un compte existe pour cet email.
  if (email && !token) {
    try {
      const user = await getUserRaw(email);
      if (user) {
        const resetToken = randomBytes(24).toString("hex");
        const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
        await upsertReset(resetToken, { email: user.email, sentAt: new Date().toISOString(), expiresAt, usedAt: null });
        await sendResetEmail(req, user.email, resetToken).catch(() => {});
      }
    } catch (_) { /* on répond quand même génériquement */ }
    return res.status(200).json({ ok: true });
  }

  // Étape 2 : application du nouveau mot de passe.
  if (token && password) {
    if (String(password).length < 8) return res.status(400).json({ error: "Mot de passe d'au moins 8 caractères requis." });

    let r;
    try { r = await getReset(token); } catch (e) { return res.status(500).json({ error: String(e) }); }
    if (!r) return res.status(404).json({ error: "Lien introuvable ou déjà utilisé." });
    if (r.usedAt) return res.status(409).json({ error: "Ce lien a déjà été utilisé." });
    if (r.expiresAt && Date.now() > new Date(r.expiresAt).getTime()) return res.status(410).json({ error: "Ce lien a expiré." });

    try {
      const user = await getUserRaw(r.email);
      if (!user) return res.status(404).json({ error: "Compte introuvable." });
      await updateUserPassword(r.email, hashPassword(String(password)));
      await setResetUsed(token, new Date().toISOString());
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Requête invalide." });
}

async function sendResetEmail(req, email, token) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Sonate";
  if (!apiKey || !senderEmail) return; // Brevo non configuré : la demande reste silencieuse (réponse déjà générique)

  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = `${proto}://${req.headers.host}/?reset=${token}`;

  const html = `<!doctype html><html><body style="margin:0;background:#f5f0e8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1e3328">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Réinitialisez votre mot de passe pour le Simulateur SEA/SMA Sonate.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3ddd0">
        <tr><td style="background:#1a2e25;padding:24px 32px">
          <div style="font-size:24px;font-weight:800;color:#f5f0e8;letter-spacing:-0.02em">Sonate</div>
          <div style="font-size:10px;letter-spacing:0.18em;color:#e8571a;text-transform:uppercase;margin-top:3px">Simulateur SEA/SMA</div>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:20px;color:#1a2e25">Réinitialisation du mot de passe</h1>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6">Bonjour,</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Une demande de réinitialisation de mot de passe a été faite pour ce compte. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 22px"><tr><td style="border-radius:8px;background:#e8571a"><a href="${url}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Choisir un nouveau mot de passe</a></td></tr></table>
          <p style="margin:0 0 18px;font-size:13px;color:#4a6a5a;word-break:break-all">Ou copiez ce lien dans votre navigateur :<br><a href="${url}" style="color:#e8571a">${url}</a></p>
          <p style="margin:0;font-size:13px;color:#8a9e98">Ce lien expire dans 1 heure.</p>
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #eee;font-size:12px;color:#8a9e98">— L'équipe Sonate</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = `Réinitialisation du mot de passe — Simulateur SEA/SMA Sonate\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nChoisir un nouveau mot de passe : ${url}\n\nCe lien expire dans 1 heure.\n\n— L'équipe Sonate`;

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email }],
      subject: "Réinitialisation de votre mot de passe — Simulateur SEA/SMA",
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}`);
}
