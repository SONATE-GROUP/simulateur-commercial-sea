// Recette de l'entrée par le portail Ma Sonate (lot 6) : `api/sso.ts`, puis le
// parcours de données du front (lot 4) avec la session obtenue.
// Copie de `TABLATURE/scripts/check-sso.mjs`, sans les projets : le Simulateur
// SEA n'accepte que les tickets de la console de l'équipe (ADR 0005 du portail).
//
// TROIS PARTIES :
//   1. la BIBLIOTHÈQUE : sans serveur, sans base. Le script frappe ses propres
//      tickets et les fait vérifier ; quand le dépôt du portail est présent
//      (`../MA SONATE GROUP`), il vérifie EN PLUS des tickets frappés par
//      `lib/tool-sso.ts` du portail (dérive entre la copie et l'original).
//   2. le GESTIONNAIRE : usage unique, session, reprise, journal, refus. Appelé
//      directement (Node retire les types de `api/sso.ts`), contre la pile
//      LOCALE du portail démarrée et seedée. Ignoré sans elle.
//   3. les DONNÉES : avec la session reprise, ce que fait le front
//      (`src/lib/reports.js`) : enregistrer, relire, visite anonyme.
//
// Usage (depuis SIMULATEUR SEA) :
//   (dans MA SONATE GROUP) npx supabase status -o env > /chemin/pile.env
//   node --env-file=/chemin/pile.env scripts/check-sso.mjs
//
// Le secret de signature est tiré au hasard. Le script crée ses propres
// données et les supprime à la fin, même en cas d'échec. Refuse de tourner sur
// une base qui n'est pas locale.
import { existsSync } from 'node:fs'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import handler, {
  TICKET_AUDIENCE,
  TICKET_ISSUER,
  TICKET_VERSION,
  verifyTicket,
} from '../api/sso.ts'

let ok = 0, ko = 0
const check = (l, c, d = '') => { console.log((c ? '✅ ' : '❌ ') + l + (d ? ' — ' + d : '')); if (c) ok++; else ko++ }

const SECRET = 'secret-de-recette-simulateur-sea-suffisamment-long'
const NOW = 1_800_000_000
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const sign = (claims, secret = SECRET, header = { alg: 'HS256', typ: 'JWT' }) => {
  const data = `${b64(header)}.${b64(claims)}`
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`
}
const claimsClient = (over = {}, now = NOW) => ({
  ver: TICKET_VERSION, iss: TICKET_ISSUER, aud: 'simulateur-sea',
  sub: '11111111-1111-4111-8111-111111111111',
  tenant: '22222222-2222-4222-8222-222222222222',
  role: 'client', account_status: 'client', entitlements: ['simulateur-sea'],
  iat: now, exp: now + 60, jti: randomUUID(), trace_id: 't', ...over,
})
const claimsStaff = (over = {}, now = NOW) => ({
  ...claimsClient({}, now), tenant: '', role: 'staff', account_status: 'staff', entitlements: [],
  kind: 'staff', tool_role: 'admin', email: 'admin@demo.sonate', ...over,
})
const verdict = (tok, opts = {}) =>
  verifyTicket(tok, opts.secret ?? SECRET, { audience: opts.audience ?? TICKET_AUDIENCE, now: opts.now ?? NOW + 1 })
const refus = async (label, tok, attendu, opts) => {
  const v = await verdict(tok, opts)
  check(label, !v.valid && v.reason === attendu, v.valid ? 'ACCEPTÉ' : v.reason)
}

/* ------------------------------------------------------------------ */
console.log('\n— La bibliothèque —')

check('audience figée sur simulateur-sea', TICKET_AUDIENCE === 'simulateur-sea')
const staff = await verdict(sign(claimsStaff()))
check('ticket de console : accepté par la bibliothèque', staff.valid, staff.valid ? '' : staff.reason)
await refus('autre secret', sign(claimsStaff(), 'un-autre-secret'), 'bad_signature')
await refus('périmé', sign(claimsStaff({}, NOW - 120)), 'expired')
await refus('⚠️ ticket destiné au simulateur intégré (`simulateur`)', sign(claimsStaff({ aud: 'simulateur' })), 'bad_audience')
await refus('⚠️ ticket destiné à Tablature', sign(claimsStaff({ aud: 'tablature' })), 'bad_audience')
await refus('frappé dans le futur', sign(claimsStaff({}, NOW + 3600)), 'not_yet_valid')
await refus('émetteur étranger', sign(claimsStaff({ iss: 'ailleurs' })), 'bad_issuer')
await refus('⚠️ `alg: none`', `${b64({ alg: 'none' })}.${b64(claimsStaff())}.`, 'bad_algorithm')
await refus('sans jti (rejouable à volonté)', sign(claimsStaff({ jti: '' })), 'no_jti')
await refus('⚠️ console qui vise aussi un compte', sign(claimsStaff({ tenant: '22222222-2222-4222-8222-222222222222' })), 'bad_staff')
await refus('console au rôle inconnu', sign(claimsStaff({ tool_role: 'owner' })), 'bad_staff')

const ICI = dirname(fileURLToPath(import.meta.url))
const PORTAIL = join(ICI, '..', '..', 'MA SONATE GROUP', 'lib', 'tool-sso.ts')
const portail = existsSync(PORTAIL) ? await import(PORTAIL) : null
if (!portail) {
  console.log(`   ⏭  contrôle croisé ignoré (${PORTAIL} absent)`)
} else {
  const now = Math.floor(Date.now() / 1000)
  const console_ = await portail.mintStaffTicket({
    toolSlug: 'simulateur-sea', userId: '66666666-6666-4666-8666-666666666666',
    email: 'admin@demo.sonate', toolRole: 'member',
  }, SECRET, now)
  const cv = await verifyTicket(console_.token, SECRET, { audience: 'simulateur-sea' })
  check('portail → simulateur : un ticket de console du portail est accepté', cv.valid && cv.claims.tool_role === 'member', cv.valid ? '' : cv.reason)
  const autre = await portail.mintStaffTicket({
    toolSlug: 'tablature', userId: '66666666-6666-4666-8666-666666666666',
    email: 'admin@demo.sonate', toolRole: 'admin',
  }, SECRET, now)
  const av = await verifyTicket(autre.token, SECRET, { audience: 'simulateur-sea' })
  check('⚠️ portail → simulateur : un ticket de console TABLATURE est refusé', !av.valid && av.reason === 'bad_audience')
  check('le portail range bien simulateur-sea parmi ses outils à ticket', portail.supportsTicket('simulateur-sea'))
  check('le portail cherche son secret dans SIMULATEUR_SEA_SHARED_SECRET',
    portail.sharedSecretEnvName('simulateur-sea') === 'SIMULATEUR_SEA_SHARED_SECRET')
}

/* ================================================================== */
/*  Parties 2 et 3 — ignorées sans la pile locale.                    */
/* ================================================================== */

const URL_ = process.env.API_URL, ANON = process.env.ANON_KEY, SVC = process.env.SERVICE_ROLE_KEY
const manque = []
if (!URL_ || !ANON || !SVC) manque.push('clés de la pile locale (supabase status -o env)')
if (URL_ && !['127.0.0.1', 'localhost'].includes(new URL(URL_).hostname)) manque.push('une pile LOCALE')
if (manque.length === 0) {
  try {
    await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })
  } catch {
    manque.push(`pile joignable sur ${URL_}`)
  }
}

if (manque.length) {
  console.log(`\n— Le gestionnaire /sso —\n   ⏭  ignoré (${manque.join(', ')}).`)
} else {
  console.log('\n— Le gestionnaire /sso —')
  const ROUTE_SECRET = randomBytes(32).toString('hex')
  Object.assign(process.env, {
    SUPABASE_URL: URL_, SUPABASE_ANON: ANON, SUPABASE_SERVICE_KEY: SVC, SIMULATEUR_SEA_SHARED_SECRET: ROUTE_SECRET,
  })

  const { createClient } = await import('@supabase/supabase-js')
  const sea = createClient(URL_, SVC, { auth: { persistSession: false }, db: { schema: 'simulateur_sea' } })
  const core = createClient(URL_, SVC, { auth: { persistSession: false }, db: { schema: 'core' } })

  const ADMIN_ID = '66666666-6666-6666-6666-666666666666'
  const DUPONT = 'aaaaaaaa-0000-0000-0000-000000000001'
  const VIEUX_JTI = 'recette-sso-simulateur-sea-vieux-jti'
  const RAPPORT = `recette${randomBytes(4).toString('hex')}`
  const DEBUT = new Date().toISOString()

  const { data: users } = await core.auth.admin.listUsers({ perPage: 200 })
  const CLIENT_ID = users.users.find((u) => u.email === 'client@demo.sonate')?.id
  check('seed : client@demo.sonate et admin@demo.sonate présents',
    !!CLIENT_ID && users.users.some((u) => u.id === ADMIN_ID))

  const { data: outil } = await core.from('tools').select('id').eq('slug', 'simulateur-sea').single()
  const { data: accesAvant } = await core.from('staff_tool_access')
    .select('tool_role').eq('user_id', ADMIN_ID).eq('tool_id', outil.id).maybeSingle()

  const jtis = []
  const codes = []
  const nettoyer = async () => {
    await sea.from('reports').delete().eq('id', RAPPORT)
    await sea.from('portal_ticket_jti').delete().in('jti', [...jtis, VIEUX_JTI])
    await sea.from('portal_handoff').delete().in('code', codes.length ? codes : ['-'])
    await sea.from('portal_sso_log').delete().in('jti', jtis.length ? jtis : ['-'])
    await sea.from('portal_sso_log').delete().is('jti', null).gte('created_at', DEBUT)
  }

  const now = () => Math.floor(Date.now() / 1000)
  const frappe = (claims, secret = ROUTE_SECRET) => { jtis.push(claims.jti); return sign(claims, secret) }
  const console_ = (over) => frappe(claimsStaff({ sub: ADMIN_ID, ...over }, now()))
  const HOTE = 'https://dev.simulateur-sea.sonate.group'
  const sso = async (ticket, hote = HOTE) => {
    const res = await handler(new Request(`${hote}/api/sso${ticket === null ? '' : `?ticket=${encodeURIComponent(ticket)}`}`))
    const cookies = res.headers.getSetCookie()
    const code = cookies.find((c) => c.startsWith('simulateur_sea_sso_code='))?.split(';')[0].split('=')[1] ?? ''
    if (code) codes.push(code)
    return { res, location: res.headers.get('location') ?? '', cookies, code }
  }
  const reprise = (code, method = 'POST') => handler(new Request(`${HOTE}/api/sso?action=claim`, {
    method, headers: code ? { cookie: `autre=1; simulateur_sea_sso_code=${code}; simulateur_sea_sso=1` } : {},
  }))
  const journal = async (jti) => (await sea.from('portal_sso_log').select('*').eq('jti', jti)).data?.[0]

  try {
    await nettoyer()
    await core.from('staff_tool_access').delete().eq('user_id', ADMIN_ID).eq('tool_id', outil.id)
    await core.from('staff_tool_access').insert({ user_id: ADMIN_ID, tool_id: outil.id, tool_role: 'admin' })
    await sea.from('portal_ticket_jti').insert({ jti: VIEUX_JTI, expires_at: new Date(Date.now() - 2 * 86400e3).toISOString() })

    // --- Le chemin nominal : la console de l'équipe ---
    const r1 = await sso(console_())
    const jti1 = jtis.at(-1)
    check('console : redirigé vers l’app (302 /)', r1.res.status === 302 && r1.location === '/', `${r1.res.status} ${r1.location}`)
    check('⚠️ l’URL d’arrivée ne porte ni ticket ni jeton', !/ticket|token/.test(r1.location))
    check('la réponse n’est pas mise en cache', /no-store/.test(r1.res.headers.get('cache-control') ?? ''))
    const cCode = r1.cookies.find((c) => c.startsWith('simulateur_sea_sso_code=')) ?? ''
    const cMarq = r1.cookies.find((c) => c.startsWith('simulateur_sea_sso=')) ?? ''
    check('cookie du code : HttpOnly, Secure, SameSite=Lax, 120 s',
      /HttpOnly/.test(cCode) && /Secure/.test(cCode) && /SameSite=Lax/.test(cCode) && /Max-Age=120/.test(cCode), cCode)
    check('marqueur lisible par la SPA (pas HttpOnly), sans secret', cMarq.startsWith('simulateur_sea_sso=1;') && !/HttpOnly/.test(cMarq))
    const { data: consomme } = await sea.from('portal_ticket_jti').select('jti').eq('jti', jti1)
    check('le jti est consommé en base', (consomme ?? []).length === 1)
    const { data: vieux } = await sea.from('portal_ticket_jti').select('jti').eq('jti', VIEUX_JTI)
    check('les jti périmés sont purgés au passage', (vieux ?? []).length === 0)
    const l1 = await journal(jti1)
    check('tracé : ok, personne, rôle de console',
      l1?.outcome === 'ok' && l1.portal_user_id === ADMIN_ID && l1.user_email === 'admin@demo.sonate' && l1.reason === 'console:admin',
      JSON.stringify(l1))

    // --- Reprise par la SPA ---
    check('reprise en GET : refusée (405)', (await reprise(r1.code, 'GET')).status === 405)
    check('reprise sans cookie : 401', (await reprise('')).status === 401)
    const c1 = await reprise(r1.code)
    const corps = await c1.json()
    check('reprise : la session', c1.status === 200 && !!corps.session?.access_token && !!corps.session?.refresh_token, `${c1.status}`)
    check('⚠️ reprise : aucun en-tête CORS (la réponse porte des jetons)', !c1.headers.get('access-control-allow-origin'))
    check('reprise : les deux cookies sont effacés', c1.headers.getSetCookie().filter((c) => /Max-Age=0/.test(c)).length === 2)
    check('reprise : la session est celle de `sub`', corps.session?.user?.id === ADMIN_ID)
    const { data: reste } = await sea.from('portal_handoff').select('code').eq('code', r1.code)
    check('⚠️ la ligne qui portait les jetons est effacée', (reste ?? []).length === 0)
    check('⚠️ seconde reprise du même code : 401', (await reprise(r1.code)).status === 401)

    // --- Rejeu ---
    const t2 = console_()
    await sso(t2)
    const rejeu = await sso(t2)
    check('⚠️ le MÊME ticket une seconde fois : refusé (rejeu)', rejeu.location === '/?sso=rejeu', rejeu.location)
    check('⚠️ et aucun code posé', !rejeu.code && rejeu.cookies.every((c) => /Max-Age=0/.test(c)))

    // --- Développement local : pas de `Secure` ---
    const loc = await sso(console_(), 'http://localhost:5173')
    check('sur localhost : cookie sans `Secure` (sinon ignoré sans un mot)', loc.code && !loc.cookies.some((c) => /Secure/.test(c)))

    // --- Ticket frappé par le portail lui-même ---
    if (portail) {
      const { token, claims } = await portail.mintStaffTicket({
        toolSlug: 'simulateur-sea', userId: ADMIN_ID, email: 'admin@demo.sonate', toolRole: 'admin',
      }, ROUTE_SECRET)
      jtis.push(claims.jti)
      const rpo = await sso(token)
      check('un ticket de console frappé par `lib/tool-sso.ts` du portail ouvre le simulateur', rpo.location === '/' && !!rpo.code, rpo.location)
    }

    // --- Refus ---
    const motif = async (label, ticket, attendu) => {
      const r = await sso(ticket)
      check(label, r.location === `/?sso=${attendu}` && !r.code, r.location)
    }
    await motif('⚠️ ticket CLIENT : refusé, l’outil est réservé à l’équipe (D3)', frappe(claimsClient({ sub: CLIENT_ID, tenant: DUPONT }, now())), 'equipe')
    await motif('⚠️ ticket d’APERÇU : refusé aussi', frappe(claimsClient({ sub: ADMIN_ID, tenant: DUPONT, preview: true }, now())), 'equipe')
    const lc = await journal(jtis.at(-1))
    check('refus d’un ticket non-équipe tracé', lc?.reason === 'ticket_non_equipe', lc?.reason)
    await motif('personne inconnue de l’Auth', console_({ sub: randomUUID() }), 'inconnu')
    await motif('⚠️ ticket Tablature présenté au simulateur', console_({ aud: 'tablature' }), 'invalide')
    await motif('⚠️ signé avec un autre secret', frappe(claimsStaff({ sub: ADMIN_ID }, now()), 'pas-le-bon-secret'), 'invalide')
    await motif('périmé', console_({ iat: now() - 120, exp: now() - 60 }), 'expire')
    await motif('sans ticket', null, 'absent')
    const post = await handler(new Request(`${HOTE}/api/sso?ticket=x`, { method: 'POST' }))
    check('échange en POST : refusé (405)', post.status === 405)

    const perime = randomBytes(24).toString('hex')
    codes.push(perime)
    await sea.from('portal_handoff').insert({
      code: perime, session: { access_token: 'x', refresh_token: 'y', user: {} },
      expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    check('⚠️ reprise d’un dépôt périmé : 401', (await reprise(perime)).status === 401)

    delete process.env.SIMULATEUR_SEA_SHARED_SECRET
    await motif('configuration incomplète : « indisponible »', console_(), 'indisponible')
    process.env.SIMULATEUR_SEA_SHARED_SECRET = ROUTE_SECRET

    /* ---------------------------------------------------------------- */
    console.log('\n— Les données, avec la session reprise —')
    const moi = createClient(URL_, ANON, {
      auth: { persistSession: false },
      db: { schema: 'simulateur_sea' },
      global: { headers: { Authorization: `Bearer ${corps.session?.access_token}` } },
    })
    const { data: role } = await moi.rpc('tool_role')
    check('rôle dans l’outil : admin (écran Équipe)', role === 'admin', String(role))
    const ins = await moi.from('reports').insert({ id: RAPPORT, label: 'Recette SSO', website: 'exemple.fr', state: 'e30=' })
    check('enregistrer un rapport', !ins.error, ins.error?.message ?? '')
    const { data: lu } = await moi.from('reports').select('created_by, account_id').eq('id', RAPPORT).single()
    check('… dont on est l’auteur, rangé sur « Sonate interne »',
      lu?.created_by === ADMIN_ID && lu?.account_id === 'eeeeeeee-0000-0000-0000-000000000005', JSON.stringify(lu))
    const doublon = await moi.from('reports').insert({ id: RAPPORT, label: 'x', state: 'e30=' })
    check('réenregistrer le même lien : conflit 23505, que le front transforme en mise à jour', doublon.error?.code === '23505', doublon.error?.code)
    const maj = await moi.from('reports').update({ label: 'Recette SSO (maj)' }).eq('id', RAPPORT).select('id')
    check('… et la mise à jour passe', (maj.data ?? []).length === 1, maj.error?.message ?? '')
    const { data: comptes } = await moi.rpc('report_accounts')
    check('le nom du compte du rapport est lisible', (comptes ?? []).some((c) => c.report_id === RAPPORT))

    const anonyme = createClient(URL_, ANON, { auth: { persistSession: false }, db: { schema: 'simulateur_sea' } })
    const { data: vu } = await anonyme.rpc('record_visit', { p_report_id: RAPPORT, p_visit_id: 'recettevisit1', p_duration: 12 })
    check('prospect sans compte : sa visite est comptée', vu === true)
    const { error: lectureAnon } = await anonyme.from('reports').select('id').limit(1)
    check('⚠️ prospect sans compte : ne lit aucun rapport', !!lectureAnon, lectureAnon?.code ?? 'LU')
    const { data: visites } = await moi.from('report_visits').select('duration').eq('report_id', RAPPORT)
    check('l’équipe voit la visite et sa durée', visites?.[0]?.duration === 12, JSON.stringify(visites))
  } finally {
    await nettoyer()
    await core.from('staff_tool_access').delete().eq('user_id', ADMIN_ID).eq('tool_id', outil.id)
    if (accesAvant) {
      await core.from('staff_tool_access').insert({ user_id: ADMIN_ID, tool_id: outil.id, tool_role: accesAvant.tool_role })
    }
    console.log('   ↩︎  rapport, jti, dépôts, journal de recette et accès d’équipe remis comme avant')
  }
}

console.log(`\n${ko === 0 ? '🎉' : '⚠️ '} ${ok} OK · ${ko} échec(s)`)
process.exit(ko === 0 ? 0 : 1)
