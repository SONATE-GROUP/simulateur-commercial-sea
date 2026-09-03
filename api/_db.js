// Couche d'accès aux données (non routée) — Turso / libSQL (SQLite).
// Variables d'environnement : TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
import { createClient } from "@libsql/client/web";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const DB_URL = process.env.TURSO_DATABASE_URL;
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

export function dbConfigured() { return Boolean(DB_URL && DB_TOKEN); }

let _client = null;
function client() {
  if (!dbConfigured()) throw new Error("Turso non configuré (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN).");
  if (!_client) _client = createClient({ url: DB_URL, authToken: DB_TOKEN });
  return _client;
}

// Comptes promus automatiquement en rôle Admin à l'initialisation de la base.
// Idempotent : ne fait rien si l'utilisateur n'existe pas encore (il sera promu
// au prochain démarrage une fois le compte créé). Garantit un accès admin sans
// manipuler la base à la main.
const BOOTSTRAP_ADMINS = ["clotilde.mares@sonate.group"];

let _ready = null;
function ready() {
  if (!_ready) {
    _ready = (async () => {
      await client().batch([
        "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT, role TEXT, espace TEXT, password_hash TEXT, created_at TEXT)",
        "CREATE TABLE IF NOT EXISTS invites (token TEXT PRIMARY KEY, email TEXT, espace TEXT, role TEXT, sent_at TEXT, expires_at TEXT, activated_at TEXT)",
        "CREATE TABLE IF NOT EXISTS spaces (id TEXT PRIMARY KEY, name TEXT, created_at TEXT, role TEXT, members TEXT)",
        "CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, label TEXT, website TEXT, espace TEXT, state TEXT, created_at TEXT, visits TEXT)",
        "CREATE TABLE IF NOT EXISTS resets (token TEXT PRIMARY KEY, email TEXT, sent_at TEXT, expires_at TEXT, used_at TEXT)",
      ], "write");
      // Migrations additives : colonnes de suivi des connexions. SQLite n'a pas
      // de "ADD COLUMN IF NOT EXISTS" → on ignore l'erreur si déjà présente.
      for (const col of ["first_login TEXT", "last_login TEXT", "login_count INTEGER", "time_spent INTEGER"]) {
        try { await client().execute(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* colonne déjà présente */ }
      }
      for (const email of BOOTSTRAP_ADMINS) {
        await client().execute({ sql: "UPDATE users SET role='Admin' WHERE lower(email)=lower(?)", args: [email] });
      }
    })();
  }
  return _ready;
}
async function ex(sql, args = []) { await ready(); return client().execute({ sql, args }); }

// ── Users ──
export async function getUserRaw(email) { const r = await ex("SELECT * FROM users WHERE email=?", [email]); return r.rows[0] || null; }
export async function createUser(u) {
  await ex("INSERT INTO users(email,name,role,espace,password_hash,created_at) VALUES(?,?,?,?,?,?)",
    [u.email, u.name, u.role, u.espace || "", u.passwordHash, u.createdAt]);
}
export async function updateUserRole(email, role) { await ex("UPDATE users SET role=? WHERE email=?", [role, email]); }
export async function updateUserPassword(email, passwordHash) { await ex("UPDATE users SET password_hash=? WHERE email=?", [passwordHash, email]); }
export async function removeUser(email) { await ex("DELETE FROM users WHERE email=?", [email]); }
// Enregistre une connexion réussie : incrémente le compteur, met à jour la
// dernière connexion et fixe la première si elle n'existe pas encore.
export async function recordLogin(email, ts) {
  await ex(
    "UPDATE users SET login_count = COALESCE(login_count,0) + 1, last_login = ?, first_login = COALESCE(first_login, ?) WHERE email = ?",
    [ts, ts, email]
  );
}
// Cumule le temps passé (en secondes) par un utilisateur connecté.
export async function recordTimeSpent(email, seconds) {
  await ex("UPDATE users SET time_spent = COALESCE(time_spent,0) + ? WHERE email = ?", [Math.round(seconds), email]);
}
export async function listUsers() {
  const r = await ex("SELECT name,email,role,espace,created_at,first_login,last_login,login_count,time_spent FROM users ORDER BY created_at DESC");
  return r.rows.map(x => ({ name: x.name, email: x.email, role: x.role, espace: x.espace || "", createdAt: x.created_at, firstLogin: x.first_login || null, lastLogin: x.last_login || null, cnx: x.login_count || 0, temps: x.time_spent || 0 }));
}

// ── Invites ──
export async function getInvite(token) {
  const r = await ex("SELECT * FROM invites WHERE token=?", [token]); const x = r.rows[0];
  return x ? { token: x.token, email: x.email, espace: x.espace || "", role: x.role || "Lecteur", sentAt: x.sent_at, expiresAt: x.expires_at, activatedAt: x.activated_at || null } : null;
}
export async function upsertInvite(token, i) {
  await ex(`INSERT INTO invites(token,email,espace,role,sent_at,expires_at,activated_at) VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(token) DO UPDATE SET email=excluded.email,espace=excluded.espace,role=excluded.role,sent_at=excluded.sent_at,expires_at=excluded.expires_at,activated_at=excluded.activated_at`,
    [token, i.email, i.espace || "", i.role || "Lecteur", i.sentAt, i.expiresAt, i.activatedAt || null]);
}
export async function setInviteActivated(token, ts) { await ex("UPDATE invites SET activated_at=? WHERE token=?", [ts, token]); }
export async function removeInvite(token) { await ex("DELETE FROM invites WHERE token=?", [token]); }
export async function listInvites() {
  const r = await ex("SELECT * FROM invites ORDER BY sent_at DESC");
  return r.rows.map(x => {
    const expired = x.expires_at && Date.now() > new Date(x.expires_at).getTime();
    return { token: x.token, email: x.email, espace: x.espace || "", role: x.role || "Lecteur", sentAt: x.sent_at, expiresAt: x.expires_at, activatedAt: x.activated_at || null, status: x.activated_at ? "activated" : expired ? "expired" : "pending" };
  });
}

// ── Réinitialisation de mot de passe ──
export async function getReset(token) {
  const r = await ex("SELECT * FROM resets WHERE token=?", [token]); const x = r.rows[0];
  return x ? { token: x.token, email: x.email, sentAt: x.sent_at, expiresAt: x.expires_at, usedAt: x.used_at || null } : null;
}
export async function upsertReset(token, r) {
  await ex("INSERT INTO resets(token,email,sent_at,expires_at,used_at) VALUES(?,?,?,?,?)",
    [token, r.email, r.sentAt, r.expiresAt, r.usedAt || null]);
}
export async function setResetUsed(token, ts) { await ex("UPDATE resets SET used_at=? WHERE token=?", [ts, token]); }

// ── Spaces ──
function spaceOut(x) { let m = []; try { m = JSON.parse(x.members || "[]"); } catch { /* */ } return { id: x.id, name: x.name, createdAt: x.created_at, role: x.role || "Propriétaire", members: m }; }
export async function getSpace(id) { const r = await ex("SELECT * FROM spaces WHERE id=?", [id]); return r.rows[0] ? spaceOut(r.rows[0]) : null; }
export async function createSpace(s) { await ex("INSERT INTO spaces(id,name,created_at,role,members) VALUES(?,?,?,?,?)", [s.id, s.name, s.createdAt, s.role || "Propriétaire", JSON.stringify(s.members || [])]); }
export async function updateSpace(id, fields) {
  const cur = await getSpace(id); if (!cur) return null;
  const name = typeof fields.name === "string" && fields.name.trim() ? fields.name.trim() : cur.name;
  const members = Array.isArray(fields.members) ? fields.members : cur.members;
  await ex("UPDATE spaces SET name=?, members=? WHERE id=?", [name, JSON.stringify(members), id]);
  return { ...cur, name, members };
}
export async function removeSpace(id) { await ex("DELETE FROM spaces WHERE id=?", [id]); }
export async function listSpaces() { const r = await ex("SELECT * FROM spaces ORDER BY created_at DESC"); return r.rows.map(spaceOut); }

// ── Reports ──
async function getReportRaw(id) { const r = await ex("SELECT * FROM reports WHERE id=?", [id]); return r.rows[0] || null; }
export async function upsertReportMeta(id, m) {
  const cur = await getReportRaw(id);
  if (cur) {
    await ex("UPDATE reports SET label=?, website=?, espace=?, state=COALESCE(?,state) WHERE id=?",
      [m.label || cur.label || "Sans nom", m.website || cur.website || "", m.espace || cur.espace || "—", m.state || null, id]);
  } else {
    await ex("INSERT INTO reports(id,label,website,espace,state,created_at,visits) VALUES(?,?,?,?,?,?,?)",
      [id, m.label || "Sans nom", m.website || "", m.espace || "—", m.state || null, m.createdAt || new Date().toISOString(), "{}"]);
  }
}
export async function setReportVisit(id, visitId, duration) {
  const x = await getReportRaw(id); if (!x) return false;
  let v = {}; try { v = JSON.parse(x.visits || "{}"); } catch { /* */ }
  const cur = v[visitId] || { ts: new Date().toISOString(), duration: 0 };
  cur.duration = Math.max(cur.duration || 0, Number(duration) || 0);
  v[visitId] = cur;
  await ex("UPDATE reports SET visits=? WHERE id=?", [JSON.stringify(v), id]);
  return true;
}
export async function updateReportEspace(id, espace) { await ex("UPDATE reports SET espace=? WHERE id=?", [espace || "—", id]); }
export async function removeReport(id) { await ex("DELETE FROM reports WHERE id=?", [id]); }
export async function listReports() {
  const r = await ex("SELECT * FROM reports ORDER BY created_at DESC");
  return r.rows.map(x => {
    let v = {}; try { v = JSON.parse(x.visits || "{}"); } catch { /* */ }
    const visits = Object.values(v);
    const last = visits.length ? visits.reduce((a, b) => (new Date(b.ts) > new Date(a.ts) ? b : a)) : null;
    return { id: x.id, prospect: x.label || "Sans nom", website: x.website || "", espace: x.espace || "—", vues: visits.length, temps: visits.reduce((s, vv) => s + (vv.duration || 0), 0), derniere: last ? last.ts : null, creation: x.created_at, state: x.state || null };
  });
}

// ── Mots de passe ──
export function hashPassword(pw) { const salt = randomBytes(16).toString("hex"); const hash = scryptSync(pw, salt, 64).toString("hex"); return `${salt}:${hash}`; }
export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const h = scryptSync(pw, salt, 64); const hb = Buffer.from(hash, "hex");
  return h.length === hb.length && timingSafeEqual(h, hb);
}
