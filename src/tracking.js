// Suivi des consultations de liens partagés — stockage 100 % local (localStorage).
// Chaque lien généré reçoit un identifiant (param ?t=). À l'ouverture d'un lien,
// on enregistre une visite (date + durée). Limite assumée : les données restent
// dans le navigateur courant — un suivi inter‑appareils nécessiterait un backend.
export const TRACK_KEY = "sim-link-tracking";

export function loadTracking() {
  try { return JSON.parse(localStorage.getItem(TRACK_KEY)) || {}; } catch { return {}; }
}

export function saveTracking(store) {
  try { localStorage.setItem(TRACK_KEY, JSON.stringify(store)); } catch (_) {}
}

export function genLinkId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function fmtDuration(sec) {
  if (!sec || sec < 1) return "< 1 s";
  if (sec < 60) return `${Math.round(sec)} s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export function fmtDateShort(iso) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
}

// État du simulateur ⇄ texte base64 du lien partagé (`?s=`).
// Encodé en UTF-8 : `btoa` seul plantait sur un caractère hors Latin-1
// (apostrophe typographique, « œ », emoji) dans le nom d'un prospect.
// Le décodage lit aussi les anciens liens, encodés en Latin-1 : leurs octets
// accentués ne forment pas de l'UTF-8 valide, et on retombe sur la lecture brute.
// Les anciens liens n'encodaient pas non plus le base64 dans l'URL : un « + »
// y revient en espace. Le base64 n'a jamais d'espace, on remet donc le « + ».
export function encodeState(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

export function decodeState(str) {
  const bin = atob(String(str).replace(/ /g, "+"));
  try {
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return JSON.parse(bin);
  }
}
