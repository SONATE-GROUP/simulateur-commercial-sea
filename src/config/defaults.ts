export const SECTORS = {
  saas: "SaaS / Tech",
  industrie: "Industrie",
  finance: "Finance / Banque",
  assurance: "Assurance / Mutuelle",
  immo: "Immobilier",
  batiment: "Bâtiment / BTP",
  energie: "Énergie / Rénovation",
  artisanat: "Artisanat / Dépannage",
  auto: "Automobile",
  sante: "Santé / Médical",
  juridique: "Juridique / Avocats",
  rh: "RH / Recrutement",
  conseil: "Conseil / Services",
  formation: "Éducation / Formation",
  tourisme: "Tourisme / Hôtellerie",
  restauration: "Restauration / CHR",
  beaute: "Beauté / Bien-être",
  mode: "Mode / Luxe",
  ecom: "E-commerce",
};

// Valeurs par défaut réalistes par canal × secteur : CPC moyen (€), CTR moyen (%),
// taux de conversion moyen (%) et budget mensuel indicatif (€).
export const CHANNEL_SECTOR_DEFAULTS = {
  "google-ads": {
    saas: { cpc: 8, ctr: 4, conversionRate: 3.5, budget: 5000 },
    industrie: { cpc: 3, ctr: 4, conversionRate: 2.5, budget: 3000 },
    finance: { cpc: 12, ctr: 5, conversionRate: 2, budget: 8000 },
    assurance: { cpc: 15, ctr: 5, conversionRate: 2.5, budget: 8000 },
    immo: { cpc: 4, ctr: 5, conversionRate: 3, budget: 4000 },
    batiment: { cpc: 5, ctr: 4.5, conversionRate: 3.5, budget: 3500 },
    energie: { cpc: 8, ctr: 4.5, conversionRate: 3, budget: 5000 },
    artisanat: { cpc: 6, ctr: 5, conversionRate: 5, budget: 2500 },
    auto: { cpc: 2.5, ctr: 5, conversionRate: 3, budget: 3000 },
    sante: { cpc: 4, ctr: 4.5, conversionRate: 3, budget: 3000 },
    juridique: { cpc: 10, ctr: 4, conversionRate: 3.5, budget: 5000 },
    rh: { cpc: 5, ctr: 4.5, conversionRate: 3, budget: 3500 },
    conseil: { cpc: 6, ctr: 4, conversionRate: 3, budget: 6000 },
    formation: { cpc: 5, ctr: 4.5, conversionRate: 3.5, budget: 3500 },
    tourisme: { cpc: 1.5, ctr: 5, conversionRate: 2.5, budget: 2500 },
    restauration: { cpc: 1.5, ctr: 5, conversionRate: 3, budget: 1500 },
    beaute: { cpc: 2, ctr: 5, conversionRate: 3, budget: 2000 },
    mode: { cpc: 1, ctr: 5, conversionRate: 2.5, budget: 2000 },
    ecom: { cpc: 1.2, ctr: 5, conversionRate: 2.5, budget: 2000 },
  },
  "meta-ads": {
    saas: { cpc: 2.5, ctr: 1.5, conversionRate: 2, budget: 4000 },
    industrie: { cpc: 1.5, ctr: 1.2, conversionRate: 1.5, budget: 2000 },
    finance: { cpc: 3.5, ctr: 1.2, conversionRate: 1.5, budget: 5000 },
    assurance: { cpc: 4, ctr: 1.2, conversionRate: 2, budget: 5000 },
    immo: { cpc: 1.8, ctr: 1.8, conversionRate: 2.5, budget: 3500 },
    batiment: { cpc: 1.8, ctr: 1.8, conversionRate: 3, budget: 2500 },
    energie: { cpc: 2.5, ctr: 1.5, conversionRate: 2.5, budget: 3500 },
    artisanat: { cpc: 1.5, ctr: 1.5, conversionRate: 3, budget: 1500 },
    auto: { cpc: 1, ctr: 2, conversionRate: 2.5, budget: 2500 },
    sante: { cpc: 1.5, ctr: 1.8, conversionRate: 2.5, budget: 2000 },
    juridique: { cpc: 3, ctr: 1.2, conversionRate: 2, budget: 3000 },
    rh: { cpc: 2, ctr: 1.5, conversionRate: 2, budget: 2500 },
    conseil: { cpc: 2, ctr: 1.4, conversionRate: 2, budget: 3500 },
    formation: { cpc: 1.8, ctr: 1.8, conversionRate: 3, budget: 2500 },
    tourisme: { cpc: 0.7, ctr: 2.2, conversionRate: 2.5, budget: 2000 },
    restauration: { cpc: 0.6, ctr: 2.5, conversionRate: 3, budget: 1200 },
    beaute: { cpc: 0.9, ctr: 2.2, conversionRate: 3, budget: 1800 },
    mode: { cpc: 0.7, ctr: 2.2, conversionRate: 2.8, budget: 2000 },
    ecom: { cpc: 0.8, ctr: 2, conversionRate: 2.5, budget: 1500 },
  },
  "linkedin-ads": {
    saas: { cpc: 10, ctr: 0.6, conversionRate: 3, budget: 8000 },
    industrie: { cpc: 9, ctr: 0.5, conversionRate: 2, budget: 5000 },
    finance: { cpc: 14, ctr: 0.5, conversionRate: 2, budget: 10000 },
    assurance: { cpc: 14, ctr: 0.5, conversionRate: 2, budget: 9000 },
    immo: { cpc: 8, ctr: 0.5, conversionRate: 2, budget: 7000 },
    batiment: { cpc: 9, ctr: 0.5, conversionRate: 2, budget: 5000 },
    energie: { cpc: 10, ctr: 0.5, conversionRate: 2, budget: 6000 },
    artisanat: { cpc: 7, ctr: 0.4, conversionRate: 1.5, budget: 2000 },
    auto: { cpc: 8, ctr: 0.5, conversionRate: 1.5, budget: 4000 },
    sante: { cpc: 9, ctr: 0.5, conversionRate: 2, budget: 4000 },
    juridique: { cpc: 13, ctr: 0.5, conversionRate: 2.5, budget: 7000 },
    rh: { cpc: 12, ctr: 0.7, conversionRate: 3, budget: 6000 },
    conseil: { cpc: 11, ctr: 0.6, conversionRate: 2.5, budget: 9000 },
    formation: { cpc: 10, ctr: 0.6, conversionRate: 3, budget: 5000 },
    tourisme: { cpc: 7, ctr: 0.4, conversionRate: 1, budget: 3000 },
    restauration: { cpc: 6, ctr: 0.4, conversionRate: 1, budget: 2000 },
    beaute: { cpc: 6, ctr: 0.4, conversionRate: 1.5, budget: 2500 },
    mode: { cpc: 8, ctr: 0.4, conversionRate: 1, budget: 3000 },
    ecom: { cpc: 9, ctr: 0.5, conversionRate: 1.5, budget: 4500 },
  },
  "tiktok-ads": {
    saas: { cpc: 1.5, ctr: 1, conversionRate: 1.5, budget: 3000 },
    industrie: { cpc: 1, ctr: 0.8, conversionRate: 1, budget: 1500 },
    finance: { cpc: 2, ctr: 0.8, conversionRate: 1, budget: 3500 },
    assurance: { cpc: 2.2, ctr: 0.8, conversionRate: 1, budget: 3500 },
    immo: { cpc: 1.2, ctr: 1.2, conversionRate: 1.5, budget: 2500 },
    batiment: { cpc: 1, ctr: 1.3, conversionRate: 1.8, budget: 1800 },
    energie: { cpc: 1.5, ctr: 1.2, conversionRate: 1.5, budget: 2500 },
    artisanat: { cpc: 0.8, ctr: 1.4, conversionRate: 2, budget: 1200 },
    auto: { cpc: 0.6, ctr: 1.8, conversionRate: 2, budget: 2000 },
    sante: { cpc: 1, ctr: 1.5, conversionRate: 1.5, budget: 1500 },
    juridique: { cpc: 1.8, ctr: 0.9, conversionRate: 1, budget: 2000 },
    rh: { cpc: 1.3, ctr: 1, conversionRate: 1.5, budget: 2000 },
    conseil: { cpc: 1.4, ctr: 1, conversionRate: 1.5, budget: 2500 },
    formation: { cpc: 0.9, ctr: 1.6, conversionRate: 2, budget: 2000 },
    tourisme: { cpc: 0.5, ctr: 2, conversionRate: 2, budget: 1500 },
    restauration: { cpc: 0.4, ctr: 2.2, conversionRate: 2.5, budget: 1000 },
    beaute: { cpc: 0.5, ctr: 2, conversionRate: 2.5, budget: 1500 },
    mode: { cpc: 0.4, ctr: 2.5, conversionRate: 2.5, budget: 1800 },
    ecom: { cpc: 0.5, ctr: 1.8, conversionRate: 2, budget: 1200 },
  },
};

// Cycle de vente typique par secteur (en mois). Sert à pré-remplir le sélecteur
// "Durée du cycle de vente" : achat immédiat (1) pour le B2C/e-commerce, cycles
// longs (6) pour l'industrie ou l'immobilier.
export const SECTOR_SALES_CYCLE = {
  saas: 3,
  industrie: 6,
  finance: 4,
  assurance: 2,
  immo: 6,
  batiment: 3,
  energie: 3,
  artisanat: 1,
  auto: 2,
  sante: 1,
  juridique: 2,
  rh: 2,
  conseil: 3,
  formation: 2,
  tourisme: 1,
  restauration: 1,
  beaute: 1,
  mode: 1,
  ecom: 1,
};

// Marge brute typique par secteur (en %), servant à pré-remplir le curseur
// "Marge brute" pour le calcul du ROI net. Ce sont des ordres de grandeur
// (marge sur coût de revient) : élevés pour les services/logiciels (peu de COGS),
// faibles pour les activités à fort contenu matières (BTP, énergie, négoce auto).
// Toujours ajustable au cas par cas selon le client.
export const SECTOR_MARGIN = {
  saas: 80,
  industrie: 35,
  finance: 75,
  assurance: 70,
  immo: 65,
  batiment: 30,
  energie: 35,
  artisanat: 45,
  auto: 25,
  sante: 65,
  juridique: 80,
  rh: 70,
  conseil: 75,
  formation: 70,
  tourisme: 55,
  restauration: 65,
  beaute: 65,
  mode: 50,
  ecom: 45,
};

// Support de conversion : applique un FACTEUR au taux de conversion calibré par
// secteur, plutôt qu'une valeur absolue qui écraserait la spécificité sectorielle.
// Le site internet sert de référence (×1) ; une landing dédiée convertit mieux.
export const CONVERSION_SUPPORTS = {
  landing: { label: "Landing Page", factor: 1.2 },
  site: { label: "Site internet", factor: 1 },
};

// Type de business : adapte la terminologie et la logique de conversion.
//  - urgence    : contact principalement par appel (serrurier, dépannage…)
//  - lead       : formulaire classique → lead qualifié, puis closing commercial
//  - ecommerce  : logique panier, la conversion EST une vente (pas de closing)
export const BUSINESS_TYPES = {
  urgence: {
    label: "Business d'urgence",
    hint: "serrurier, dépannage…",
    priorityContact: "Appel téléphonique",
    defaultContact: "appel",
    contactOptions: ["appel", "formulaire", "rdv", "chat"],
    conversionStage: "Appels",
    generatedLabel: "Appels générés",
    objectiveLabel: "Objectif appels",
    contactCostLabel: "Coût par appel",
    cplShort: "CPA",
    volumeNote: "par appel reçu",
    finalStage: "Clients",
    finalSingular: "client",
    hasClosing: true,
    closingLabel: "Taux de transformation (%)",
  },
  lead: {
    label: "Lead",
    hint: "formulaire classique",
    priorityContact: "Formulaire / Lead",
    defaultContact: "formulaire",
    contactOptions: ["formulaire", "appel", "rdv", "chat"],
    conversionStage: "Leads",
    generatedLabel: "Leads générés",
    objectiveLabel: "Objectif leads",
    contactCostLabel: "Coût par lead",
    cplShort: "CPL",
    volumeNote: "par lead qualifié",
    finalStage: "Clients",
    finalSingular: "client",
    hasClosing: true,
    closingLabel: "Taux de closing (%)",
  },
  ecommerce: {
    label: "E-commerce",
    hint: "logique panier",
    priorityContact: "Achat en ligne (panier)",
    defaultContact: "achat",
    contactOptions: ["achat", "clickcollect", "appel"],
    conversionStage: "Commandes",
    generatedLabel: "Commandes générées",
    objectiveLabel: "Objectif commandes",
    contactCostLabel: "Coût par commande",
    cplShort: "CPA",
    volumeNote: "par commande",
    finalStage: "Ventes",
    finalSingular: "vente",
    hasClosing: false,
    closingLabel: null,
  },
};

// Type de contact : canal(aux) d'entrée du prospect / mode de conversion.
// Sélection multiple (un business peut recevoir des leads par plusieurs canaux
// à la fois). Les options proposées dépendent du type de business (cf.
// contactOptions ci-dessus), et le défaut est pré-rempli (defaultContact).
export const CONTACT_TYPES = {
  formulaire: { label: "Formulaire" },
  appel: { label: "Appel téléphonique" },
  rdv: { label: "Prise de RDV" },
  chat: { label: "Conversation chat" },
  achat: { label: "Achat en ligne" },
  clickcollect: { label: "Click & collect" },
};

export function getSupportFactor(support) {
  return CONVERSION_SUPPORTS[support]?.factor ?? 1;
}

// Taux de conversion = taux sectoriel de référence × facteur du support choisi.
export function getSupportConversionRate(channel, sector, support) {
  const base = CHANNEL_SECTOR_DEFAULTS[channel]?.[sector]?.conversionRate;
  if (base == null) return null;
  return Math.round(base * getSupportFactor(support) * 10) / 10;
}

export function getDefaultValues(channel, sector) {
  return CHANNEL_SECTOR_DEFAULTS[channel]?.[sector] ?? null;
}

export function getSectorSalesCycle(sector) {
  return SECTOR_SALES_CYCLE[sector] ?? 1;
}

export function getSectorMargin(sector) {
  return SECTOR_MARGIN[sector] ?? 70;
}
