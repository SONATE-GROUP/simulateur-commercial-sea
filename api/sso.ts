// api/sso.ts
//
// Point d'échange du ticket SSO émis par le portail « Ma Sonate » (lot 6 de la
// fusion du Simulateur SEA). Copie de `TABLATURE/api/sso.ts` (lui-même portage
// d'`ECHO/api/sso.js`, qui fait foi pour le raisonnement), sans les projets :
// le Simulateur SEA n'a pas de ticket client (ADR 0005 du portail, D3).
//
//   GET  /sso?ticket=…           la personne arrive du portail, on la fait entrer
//   POST /api/sso?action=claim   la SPA récupère la session déposée juste avant
//
// ─────────────────────────────────────────────────────────────────────────────
// L'ORDRE DES CONTRÔLES N'EST PAS ARBITRAIRE :
//   1. refus de tout `alg` autre que HS256 : un jeton ne choisit pas son
//      algorithme ;
//   2. signature HMAC-SHA256 avec SIMULATEUR_SEA_SHARED_SECRET (un secret par outil) ;
//   3. ver / iss / aud / exp (1 à 3 : `verifyTicket` ci-dessous) ;
//   4. CONSOMMATION DU `jti`, l'usage unique, que seul l'outil peut imposer ;
//   5. l'identité : `sub` EST l'id Auth, commun avec le portail. Pas de table
//      de correspondance ;
//   6. session posée, puis redirection vers une URL PROPRE.
//
// UNE SEULE FORME DE TICKET : la console de l'équipe (`kind: 'staff'`), SANS
// compte. Un ticket client ou d'aperçu est REFUSÉ : l'outil est réservé à
// l'équipe (D3), et le portail ne devrait jamais en frapper un (l'outil n'est
// dans aucune Sonate). Ce que la personne voit ensuite, c'est la RLS du schéma
// `simulateur_sea` qui le décide (`simulateur_sea.tool_role`), pas cette fonction.
//
// POURQUOI LA CONSOMMATION DU `jti` VIENT AVANT LES RECHERCHES EN BASE : c'est
// la seule étape qui doit gagner une course. Deux requêtes portant le même
// ticket (double clic, préchargement de lien, rejeu) sont départagées avant
// qu'une seule puisse aboutir. Un ticket brûlé par un refus ultérieur n'est pas
// un problème : le refus, lui, est définitif.
//
// EN CAS D'ÉCHEC ON REDIRIGE, ON NE REND PAS DU JSON. Un humain est au bout du
// clic : il atterrit sur l'app avec `?sso=<motif>`, et l'app le lui dit. Les
// motifs sont volontairement GROSSIERS ; le détail va au journal
// (`portal_sso_log`), pas dans l'URL, qui ne doit pas servir d'oracle.
//
// ⚠️ AUCUN IMPORT, ET ÇA DOIT LE RESTER : la fonction tourne sur Vercel (Edge),
// et la recette (`scripts/check-sso.mjs`) l'importe telle quelle dans Node, qui
// retire les types mais ne résout pas un import relatif sans extension.
// `crypto`, `atob`, `TextEncoder`, `fetch`, `Request` et `Response` sont des
// globaux partout.

export const config = { runtime: 'edge' }

// Vercel pose les variables serveur dans `process.env`. Le dépôt n'a pas
// `@types/node` : le front n'en a pas l'usage.
declare const process: { env: Record<string, string | undefined> }

/**
 * Lues à chaque requête, pas au chargement du module : la recette pose ses
 * variables après l'import.
 *
 * ⚠️ `SUPABASE_SERVICE_KEY` n'est JAMAIS préfixée `VITE_` : Vite recopierait
 * dans le bundle du navigateur toute variable qui l'est.
 */
function settings() {
  return {
    url: process.env.SUPABASE_URL ?? '',
    anon: process.env.SUPABASE_ANON ?? '',
    service: process.env.SUPABASE_SERVICE_KEY ?? '',
    // Secret de signature, PARTAGÉ avec le portail : même valeur des deux côtés,
    // distincte par environnement (un ticket de dev n'ouvre jamais la prod).
    secret: process.env.SIMULATEUR_SEA_SHARED_SECRET ?? '',
  }
}

/** Durée de vie du code de reprise. Le temps d'une redirection, pas plus. */
const HANDOFF_TTL_SECONDS = 120

const COOKIE_CODE = 'simulateur_sea_sso_code' // HttpOnly : le code lui-même
const COOKIE_MARKER = 'simulateur_sea_sso' // lisible : dit à la SPA qu'il y a à prendre

const DB_SCHEMA = 'simulateur_sea'

/* ========================================================================== */
/*  Le ticket : COPIE de `lib/tool-sso.ts` du portail                          */
/* ========================================================================== */
//
// Une copie, pas une réécriture : deux implémentations écrites séparément
// divergent au premier détail (ordre des tests, tolérance d'horloge, `exp` non
// numérique), et la divergence se voit le jour où plus personne n'entre. À
// toute évolution du contrat côté portail : reporter ici et relancer
// `npm run check:sso`, dont la première partie vérifie des tickets frappés par
// le portail lui-même.

/** Contrat v1 : on AJOUTE une claim, on n'en renomme ni n'en retire jamais. */
export const TICKET_VERSION = 1

/** Émetteur attendu : le portail, quel que soit son hébergement. */
export const TICKET_ISSUER = 'ma.sonate.group'

/**
 * Audience attendue : le slug de `core.tools`, figé à vie (D6). Volontairement
 * NON configurable : une audience réglable à l'exécution est une audience
 * qu'un déploiement mal configuré élargit sans que personne le remarque.
 */
export const TICKET_AUDIENCE = 'simulateur-sea'

/** Tolérance d'horloge entre les deux hébergements, en secondes. */
export const TICKET_CLOCK_SKEW_SECONDS = 5

/** Rôles d'un ticket de console (miroir de `STAFF_TOOL_ROLES` du portail). */
export const STAFF_TOOL_ROLES = ['admin', 'member']

export interface TicketClaims {
  ver: number
  iss: string
  aud: string
  /** L'utilisateur RÉEL : en aperçu, c'est le staff, jamais le client. */
  sub: string
  /** Le compte Ma Sonate ; vide pour un ticket de console. */
  tenant: string
  role: string
  account_status: string
  entitlements: string[]
  iat: number
  exp: number
  jti: string
  trace_id: string
  preview?: true
  kind?: 'staff'
  tool_role?: string
  email?: string
}

export type TicketVerdict =
  | { valid: true; claims: TicketClaims }
  | { valid: false; reason: string }

const encoder = new TextEncoder()

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/')
  const padding = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : ''
  const binary = atob(base64 + padding)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage)
}

/** Identifiant aléatoire en hexadécimal : sert aux codes de reprise. */
export function randomId(bytes = 24): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Valide un ticket. L'ORDRE EST UN CHOIX : l'algorithme d'abord, la signature
 * ensuite, le contenu en dernier. Lire une claim avant d'avoir validé la
 * signature, c'est faire confiance à du texte fourni par l'appelant.
 *
 * ⚠️ NE VÉRIFIE PAS LE REJEU : c'est `consumeJti`, plus bas, et il est
 * obligatoire.
 */
export async function verifyTicket(
  token: string,
  secret: string,
  options: { audience: string; now?: number },
): Promise<TicketVerdict> {
  const now = typeof options.now === 'number' ? options.now : Math.floor(Date.now() / 1000)
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length !== 3 || !secret) return { valid: false, reason: 'malformed' }

  const [rawHeader, rawPayload, rawSignature] = parts

  let header: { alg?: unknown }
  let claims: TicketClaims
  try {
    const decoder = new TextDecoder()
    header = JSON.parse(decoder.decode(fromBase64Url(rawHeader)))
    claims = JSON.parse(decoder.decode(fromBase64Url(rawPayload)))
  } catch {
    return { valid: false, reason: 'malformed' }
  }
  if (!header || typeof header !== 'object' || !claims || typeof claims !== 'object') {
    return { valid: false, reason: 'malformed' }
  }

  // Avant toute chose : la confusion d'algorithme (`alg: none`).
  if (header.alg !== 'HS256') return { valid: false, reason: 'bad_algorithm' }

  let signatureOk = false
  try {
    const key = await hmacKey(secret, ['verify'])
    signatureOk = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(rawSignature),
      encoder.encode(`${rawHeader}.${rawPayload}`),
    )
  } catch {
    return { valid: false, reason: 'malformed' }
  }
  if (!signatureOk) return { valid: false, reason: 'bad_signature' }

  // La signature tient : le contenu est authentique, on peut le lire.
  if (claims.ver !== TICKET_VERSION) return { valid: false, reason: 'bad_version' }
  if (claims.iss !== TICKET_ISSUER) return { valid: false, reason: 'bad_issuer' }
  if (claims.aud !== options.audience) return { valid: false, reason: 'bad_audience' }
  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    return { valid: false, reason: 'expired' }
  }
  if (typeof claims.iat !== 'number' || claims.iat > now + TICKET_CLOCK_SKEW_SECONDS) {
    return { valid: false, reason: 'not_yet_valid' }
  }
  // Ticket de console : aucun compte, mais un rôle et une adresse obligatoires.
  // Il ne se combine NI avec un compte NI avec l'aperçu.
  if (claims.kind !== undefined) {
    const staffOk =
      claims.kind === 'staff' &&
      claims.tenant === '' &&
      claims.preview === undefined &&
      STAFF_TOOL_ROLES.includes(claims.tool_role as string) &&
      typeof claims.email === 'string' &&
      claims.email.includes('@')
    if (!staffOk) return { valid: false, reason: 'bad_staff' }
  } else if (typeof claims.tenant !== 'string' || !claims.tenant) {
    return { valid: false, reason: 'no_tenant' }
  }
  // Sans `jti`, rien à consommer, donc rien qui empêche le rejeu.
  if (typeof claims.jti !== 'string' || !claims.jti) return { valid: false, reason: 'no_jti' }
  if (typeof claims.sub !== 'string' || !claims.sub) return { valid: false, reason: 'no_subject' }

  return { valid: true, claims }
}

/**
 * Le compte est-il actif ? MIROIR de `isAccountActive` du portail, y compris
 * son parti pris : une liste de REFUS, un statut inconnu passe. Diverger d'une
 * source d'autorité, même dans le sens prudent, c'est créer une seconde
 * autorité.
 */
export function accountStatusActive(status: unknown): boolean {
  return status !== 'suspended' && status !== 'churned'
}

/* ========================================================================== */
/*  Aiguillage                                                                 */
/* ========================================================================== */

/**
 * Le routage se fait sur `action`, PAS sur le chemin. Sur Vercel, `/sso`
 * arrive ici par une réécriture vers `/api/sso` (`vercel.json`), et le
 * `pathname` que voit la fonction est celui de la DESTINATION.
 */
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)

  if (url.searchParams.get('action') === 'claim') {
    if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
    return claim(req)
  }

  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée' }, 405)
  return exchange(url)
}

/* ========================================================================== */
/*  Échange du ticket                                                          */
/* ========================================================================== */

interface TraceEntry {
  trace_id?: string | null
  jti?: string | null
  portal_account_id?: string | null
  portal_user_id?: string | null
  user_email?: string | null
  preview?: boolean
  outcome: 'ok' | 'refus'
  reason?: string | null
}

async function exchange(url: URL): Promise<Response> {
  const cfg = settings()
  if (!cfg.url || !cfg.service || !cfg.anon || !cfg.secret) {
    console.error('[sso] configuration incomplète (URL / ANON / SERVICE_KEY / SECRET)')
    return refuse('indisponible')
  }

  const token = url.searchParams.get('ticket')
  if (!token) return refuse('absent')

  // ── 1 à 3 : algorithme, signature, contrat ────────────────────────────────
  const verdict = await verifyTicket(token, cfg.secret, { audience: TICKET_AUDIENCE })
  if (!verdict.valid) {
    await trace({ outcome: 'refus', reason: verdict.reason })
    // `expired` est le seul motif distingué : le seul où réessayer a un sens.
    return refuse(verdict.reason === 'expired' ? 'expire' : 'invalide')
  }

  const c = verdict.claims
  const base: Omit<TraceEntry, 'outcome'> = {
    trace_id: c.trace_id || null,
    jti: c.jti,
    portal_account_id: c.tenant || null,
    portal_user_id: c.sub,
    preview: c.preview === true,
  }

  // ── L'équipe seule (D3) ────────────────────────────────────────────────────
  // Avant le jti : un ticket qui n'a rien à faire ici n'a pas à être consommé.
  if (c.kind !== 'staff') {
    await trace({ ...base, outcome: 'refus', reason: 'ticket_non_equipe' })
    return refuse('equipe')
  }

  // ── Statut du compte, tel que le portail l'a frappé ───────────────────────
  // Gardé pour suivre le contrat commun : un ticket de console porte le statut
  // `staff`, qui passe.
  if (!accountStatusActive(c.account_status)) {
    await trace({ ...base, outcome: 'refus', reason: `statut:${c.account_status}` })
    return refuse('suspendu')
  }

  // ── 4 : consommation du `jti` ─────────────────────────────────────────────
  if (!(await consumeJti(c))) {
    await trace({ ...base, outcome: 'refus', reason: 'rejeu' })
    return refuse('rejeu')
  }

  // ── 5 : l'identité. L'Auth est COMMUNE avec le portail ─────────────────────
  const email = await emailOf(c.sub)
  if (!email) {
    await trace({ ...base, outcome: 'refus', reason: 'utilisateur_inconnu' })
    return refuse('inconnu')
  }
  const ctx = { ...base, user_email: email }

  // ── 6 : poser la session, puis rediriger vers une URL propre ──────────────
  const minted = await mintSession(email)
  if (!minted.session) {
    await trace({ ...ctx, outcome: 'refus', reason: `session:${minted.reason}` })
    return refuse(minted.reason === 'compte_absent' ? 'inconnu' : 'indisponible')
  }

  const code = randomId()
  const posed = await insertRow('portal_handoff', {
    code,
    session: minted.session,
    expires_at: new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000).toISOString(),
  })
  if (!posed) {
    await trace({ ...ctx, outcome: 'refus', reason: 'depot_impossible' })
    return refuse('indisponible')
  }

  // ⚠️ ATTENDUES : dans un runtime edge, une écriture lancée sans `await`
  // n'arrive jamais (l'isolat meurt avec la réponse).
  await Promise.all([
    trace({ ...ctx, outcome: 'ok', reason: `console:${c.tool_role}` }),
    purge(),
  ])

  // La destination ne porte NI le ticket, NI les jetons. La SPA réclame la
  // session, puis ouvre le simulateur.
  return redirect('/', cookies(url, code))
}

/** L'adresse d'une personne de l'Auth commune, par son id. */
async function emailOf(userId: string): Promise<string> {
  const { url, service } = settings()
  if (!userId) return ''
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  }).catch(() => null)
  if (!res || !res.ok) return ''
  const u = (await res.json().catch(() => ({}))) as { email?: string }
  return String(u.email || '').toLowerCase().trim()
}

/* ========================================================================== */
/*  Reprise de la session par la SPA                                           */
/* ========================================================================== */

/**
 * ⚠️ CETTE RÉPONSE CONTIENT DES JETONS DE SESSION. Aucun en-tête CORS : la SPA
 * est servie par la même origine, et un `Access-Control-Allow-Origin` permissif
 * offrirait la session à n'importe quel site visité ensuite.
 */
async function claim(req: Request): Promise<Response> {
  const code = readCookie(req, COOKIE_CODE)
  if (!code) return json({ error: 'absent' }, 401)

  const efface = clearCookies()
  const { url, service } = settings()
  if (!url || !service) return json({ error: 'indisponible' }, 500, efface)

  const now = new Date().toISOString()

  // Le filtre `claimed_at=is.null` DANS la mise à jour rend la reprise unique :
  // c'est la base qui départage deux appels simultanés, pas une lecture suivie
  // d'une écriture.
  const res = await rest(`portal_handoff?code=eq.${enc(code)}&claimed_at=is.null&expires_at=gt.${enc(now)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ claimed_at: now }),
  })
  const rows = res && res.ok ? ((await res.json().catch(() => [])) as Array<Record<string, unknown>>) : []
  if (!rows.length) return json({ error: 'invalide' }, 401, efface)

  // La ligne porte des jetons : une fois lue, elle n'a plus de raison d'exister.
  // ATTENDU, pour la même raison que plus haut.
  await rest(`portal_handoff?code=eq.${enc(code)}`, { method: 'DELETE' })

  return json({ session: rows[0].session }, 200, efface)
}

/* ========================================================================== */
/*  Session Supabase                                                           */
/* ========================================================================== */

type MintedSession =
  | { session: { access_token: string; refresh_token: string; user: unknown }; reason: null }
  | { session: null; reason: string }

/**
 * Frappe une session pour un compte EXISTANT, sans mot de passe : l'API
 * d'administration produit un lien magique (sans l'envoyer), puis on échange
 * aussitôt son jeton contre une session. C'est le seul chemin qui rend un
 * couple de jetons identique à celui d'une connexion ordinaire : la SPA n'a
 * rien à savoir de la provenance.
 *
 * ⚠️ NE CRÉE JAMAIS DE COMPTE : `generate_link` en `magiclink` échoue sur une
 * adresse inconnue, et c'est voulu.
 */
async function mintSession(email: string): Promise<MintedSession> {
  const { url, service } = settings()
  const genRes = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: service, Authorization: `Bearer ${service}` },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).catch(() => null)

  if (!genRes || !genRes.ok) {
    const detail = genRes ? await genRes.text().catch(() => '') : 'réseau'
    console.error('[sso] generate_link:', genRes && genRes.status, detail.slice(0, 200))
    const absent = !!genRes && (genRes.status === 422 || genRes.status === 404)
    return { session: null, reason: absent ? 'compte_absent' : 'lien_refuse' }
  }

  const gen = (await genRes.json().catch(() => ({}))) as Record<string, unknown>
  // Selon la version de GoTrue, à plat ou sous `properties` : on lit les deux.
  const props = ((gen.properties as Record<string, unknown> | undefined) ?? gen) as {
    hashed_token?: string
    email_otp?: string
  }
  const hashed = props.hashed_token
  const otp = props.email_otp
  if (!hashed && !otp) {
    console.error('[sso] generate_link : ni hashed_token ni email_otp')
    return { session: null, reason: 'lien_illisible' }
  }

  let session = hashed ? await verifyOtp({ type: 'magiclink', token_hash: hashed }) : null
  // Repli sur le code à usage unique, pour un GoTrue qui n'accepte pas `token_hash`.
  if (!session && otp) session = await verifyOtp({ type: 'magiclink', token: otp, email })

  return session ? { session, reason: null } : { session: null, reason: 'echange_refuse' }
}

async function verifyOtp(body: Record<string, string>) {
  const { url, anon } = settings()
  const res = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon },
    body: JSON.stringify(body),
  }).catch(() => null)
  if (!res || !res.ok) {
    if (res) console.warn('[sso] verify:', res.status, (await res.text().catch(() => '')).slice(0, 200))
    return null
  }
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    user?: unknown
  }
  // `user` est exigé autant que les jetons : une session sans lui laisserait la
  // SPA avec un jeton valide et personne de connecté.
  if (!data.access_token || !data.refresh_token || !data.user) return null
  return { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user }
}

/* ========================================================================== */
/*  Accès base : toujours en service_role, ces tables sont fermées             */
/* ========================================================================== */

/**
 * ⚠️ SANS LES EN-TÊTES DE PROFIL, PostgREST cherche dans `public`, qui n'a pas
 * ces tables : `Accept-Profile` pour les lectures, `Content-Profile` pour les
 * écritures. On pose toujours les deux.
 */
function rest(path: string, init: RequestInit = {}): Promise<Response | null> {
  const { url, service } = settings()
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      'Accept-Profile': DB_SCHEMA,
      'Content-Profile': DB_SCHEMA,
      apikey: service,
      Authorization: `Bearer ${service}`,
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  }).catch(() => null)
}

async function insertRow(table: string, row: Record<string, unknown>): Promise<boolean> {
  const res = await rest(table, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  })
  if (!res || !res.ok) {
    if (res) console.error(`[sso] insert ${table}:`, res.status, (await res.text().catch(() => '')).slice(0, 200))
    return false
  }
  return true
}

/**
 * Consomme le `jti`. Rend `true` une seule fois par ticket.
 *
 * `resolution=ignore-duplicates` produit un `ON CONFLICT DO NOTHING` : la ligne
 * revient à l'inséreur, un tableau vide à tous les autres. C'est la base qui
 * arbitre ; un `select` suivi d'un `insert` laisserait passer deux requêtes
 * simultanées.
 */
async function consumeJti(c: TicketClaims): Promise<boolean> {
  const res = await rest('portal_ticket_jti', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify({
      jti: c.jti,
      portal_account_id: c.tenant || null,
      trace_id: c.trace_id || null,
      expires_at: new Date(c.exp * 1000).toISOString(),
    }),
  })
  if (!res || !res.ok) {
    if (res) console.error('[sso] consommation jti:', res.status)
    // Une base injoignable ne doit pas se traduire par « usage unique désactivé ».
    return false
  }
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length === 1
}

/** Journal. Ne doit JAMAIS faire échouer une bascule par ailleurs valide. */
async function trace(entry: TraceEntry): Promise<void> {
  try {
    await insertRow('portal_sso_log', {
      trace_id: entry.trace_id || null,
      jti: entry.jti || null,
      portal_account_id: entry.portal_account_id || null,
      portal_user_id: entry.portal_user_id || null,
      user_email: entry.user_email || null,
      preview: entry.preview === true,
      outcome: entry.outcome,
      reason: entry.reason || null,
    })
  } catch (e) {
    console.error('[sso] journal indisponible:', (e as Error).message)
  }
}

/**
 * Purge des lignes périmées depuis un jour. Ici plutôt que dans un cron : une
 * bascule est un clic humain, et deux DELETE sur des colonnes indexées ne se
 * mesurent pas à ce volume. Le journal, lui, se garde.
 */
function purge(): Promise<unknown> {
  const limite = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  return Promise.all([
    rest(`portal_ticket_jti?expires_at=lt.${enc(limite)}`, { method: 'DELETE' }),
    rest(`portal_handoff?expires_at=lt.${enc(limite)}`, { method: 'DELETE' }),
  ]).catch(() => {})
}

/* ========================================================================== */
/*  HTTP                                                                       */
/* ========================================================================== */

const enc = encodeURIComponent

/**
 * `Secure` partout SAUF en local. Le test porte sur le nom d'hôte, pas sur le
 * protocole : derrière la réécriture Vercel, la fonction peut voir `http:`
 * alors que le navigateur est en `https:`. Sur localhost, `Secure` ferait
 * ignorer le cookie sans aucun message.
 */
function cookies(url: URL, code: string): string[] {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)
  const commun = `Path=/; Max-Age=${HANDOFF_TTL_SECONDS}; SameSite=Lax;${local ? '' : ' Secure;'}`
  return [
    `${COOKIE_CODE}=${code}; ${commun} HttpOnly`,
    // Non-HttpOnly À DESSEIN : le seul moyen pour la SPA de savoir qu'une
    // session l'attend. Il ne porte aucun secret.
    `${COOKIE_MARKER}=1; ${commun}`,
  ]
}

function clearCookies(): string[] {
  const mort = 'Path=/; Max-Age=0; SameSite=Lax'
  return [`${COOKIE_CODE}=; ${mort}; HttpOnly`, `${COOKIE_MARKER}=; ${mort}`]
}

function readCookie(req: Request, name: string): string | null {
  const brut = req.headers.get('cookie') || ''
  for (const morceau of brut.split(';')) {
    const [cle, ...reste] = morceau.trim().split('=')
    if (cle === name) return reste.join('=') || null
  }
  return null
}

function refuse(motif: string): Response {
  return redirect(`/?sso=${motif}`, clearCookies())
}

/**
 * `Location` RELATIF, volontairement : derrière la réécriture, l'origine vue
 * par la fonction n'est pas forcément celle du navigateur, et une redirection
 * vers la mauvaise origine perdrait le cookie qu'on vient de poser.
 */
function redirect(cible: string, setCookies: string[] = []): Response {
  const headers = new Headers({
    Location: cible,
    // Une réponse qui pose une session ne se met jamais en cache.
    'Cache-Control': 'no-store, max-age=0',
    'Referrer-Policy': 'no-referrer',
  })
  setCookies.forEach((c) => headers.append('Set-Cookie', c))
  return new Response(null, { status: 302, headers })
}

function json(data: unknown, status = 200, setCookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' })
  setCookies.forEach((c) => headers.append('Set-Cookie', c))
  return new Response(JSON.stringify(data), { status, headers })
}
