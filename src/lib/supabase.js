import { createClient } from "@supabase/supabase-js";

// Le Simulateur SEA vit dans le schéma `simulateur_sea` des projets Supabase du
// portail Ma Sonate (masonate-dev, -staging, -prod). Le schéma se pose une fois
// ici : tous les `.from()` et `.rpc()` le suivent.
//
// Sans configuration (variables absentes), `supabase` vaut null : un lien
// partagé s'affiche quand même, seule sa visite n'est pas comptée.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey
  ? createClient(url, anonKey, { db: { schema: "simulateur_sea" } })
  : null;
