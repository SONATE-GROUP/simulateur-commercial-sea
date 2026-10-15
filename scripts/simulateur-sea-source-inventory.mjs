// Inventaire Turso du Simulateur SEA — LECTURE SEULE (SELECT uniquement).
// N'affiche aucune adresse : seulement des comptes, des domaines et des volumes.
import { createClient } from "@libsql/client/web";

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const q = async (sql) => (await db.execute(sql)).rows;
const domain = (e) => String(e || "").split("@")[1]?.toLowerCase() || "(vide)";
const tally = (arr) => Object.entries(arr.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);

const tables = (await q("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).map(r => r.name);
console.log("Tables :", tables.join(", "));
for (const t of tables) console.log(`  ${t} : ${(await q(`SELECT count(*) n FROM "${t}"`))[0].n} lignes`);
for (const t of tables) console.log(`  colonnes ${t} :`, (await q(`PRAGMA table_info("${t}")`)).map(c => c.name).join(", "));

const users = await q("SELECT email, role, password_hash, last_login, login_count, created_at FROM users");
console.log("\nComptes par domaine :", tally(users.map(u => domain(u.email))));
console.log("Comptes par rôle :", tally(users.map(u => u.role || "(vide)")));
console.log("Domaine × rôle :", tally(users.map(u => `${domain(u.email)} / ${u.role}`)));
console.log("Avec mot de passe :", users.filter(u => u.password_hash).length);
console.log("Jamais connectés :", users.filter(u => !u.last_login).length);
const lower = users.map(u => String(u.email).toLowerCase());
console.log("Doublons d'email à la casse près :", lower.length - new Set(lower).size);
console.log("Emails avec majuscules :", users.filter(u => u.email !== String(u.email).toLowerCase()).length);
console.log("Dernière connexion la plus récente :", users.map(u => u.last_login).filter(Boolean).sort().pop());

const invites = await q("SELECT role, sent_at, expires_at, activated_at FROM invites");
const now = new Date().toISOString();
console.log("\nInvitations : activées", invites.filter(i => i.activated_at).length,
  "/ en attente", invites.filter(i => !i.activated_at && (!i.expires_at || i.expires_at > now)).length,
  "/ expirées", invites.filter(i => !i.activated_at && i.expires_at && i.expires_at <= now).length);

const spaces = await q("SELECT id, name, members FROM spaces");
const memberEmails = spaces.flatMap(s => { try { return JSON.parse(s.members || "[]").map(m => m.email || m.id); } catch { return []; } });
console.log("\nEspaces :", spaces.length, "— membres au total :", memberEmails.length, "— par domaine :", tally(memberEmails.map(domain)));
const spaceNames = new Set(spaces.map(s => s.name));
const dupNames = spaces.length - spaceNames.size;
console.log("Noms d'espace en double :", dupNames);
const userSet = new Set(lower);
console.log("Membres sans compte :", memberEmails.filter(e => !userSet.has(String(e).toLowerCase())).length);

const reports = await q("SELECT espace, created_by, created_at, length(state) ls, visits FROM reports");
console.log("\nRapports :", reports.length);
console.log("  sans espace (—/vide) :", reports.filter(r => !r.espace || r.espace === "—").length);
console.log("  espace inconnu :", reports.filter(r => r.espace && r.espace !== "—" && !spaceNames.has(r.espace)).length);
console.log("  sans auteur :", reports.filter(r => !r.created_by).length);
console.log("  auteur sans compte :", reports.filter(r => r.created_by && !userSet.has(String(r.created_by).toLowerCase())).length);
console.log("  auteurs par domaine :", tally(reports.map(r => domain(r.created_by))));
const dates = reports.map(r => r.created_at).filter(Boolean).sort();
console.log("  du", dates[0], "au", dates.at(-1));
const visits = reports.map(r => { try { return Object.keys(JSON.parse(r.visits || "{}")).length; } catch { return -1; } });
console.log("  visites totales :", visits.filter(v => v >= 0).reduce((a, b) => a + b, 0), "— visits illisibles :", visits.filter(v => v < 0).length);
console.log("  taille state max (octets) :", Math.max(0, ...reports.map(r => r.ls || 0)));
const badState = reports.filter(r => r.ls == null).length;
console.log("  state vide :", badState);

const resets = await q("SELECT count(*) n FROM resets");
console.log("\nRéinitialisations en base :", resets[0].n);
