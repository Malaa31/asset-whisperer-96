import type { Region, Sector } from "./classify";
import type { RiskProfile } from "./types";

/**
 * Paramètres du modèle, en un seul endroit.
 *
 * Ils étaient auparavant dispersés dans quatre fichiers, avec des
 * valeurs jumelles qui divergeaient à la première modification. Un
 * paramètre n'a de sens que s'il est unique : c'est ici qu'on le change,
 * nulle part ailleurs.
 */

/** Mois de revenus attendus en réserve de précaution, selon le profil. */
export const BUFFER_BY_PROFILE: Record<RiskProfile, number> = {
  prudent: 12,
  equilibre: 9,
  dynamique: 6,
  offensif: 4,
};

/** Budget de risque de base : volatilité visée et pire baisse tolérée. */
export const BASE_BUDGET: Record<RiskProfile, { sigma: number; dd: number }> = {
  prudent: { sigma: 5, dd: 10 },
  equilibre: { sigma: 9, dd: 15 },
  dynamique: { sigma: 13, dd: 22 },
  offensif: { sigma: 18, dd: 35 },
};

/** Répartition géographique de référence, à la capitalisation mondiale. */
export const ZONE_BASE: Record<string, number> = {
  "États-Unis": 0.62,
  Europe: 0.15,
  Japon: 0.06,
  Émergents: 0.11,
  "Autres dév.": 0.06,
};

/**
 * Cible géographique servant aux mesures de diversification : poids de
 * marché, part émergente relevée — leur poids boursier sous-estime leur
 * poids économique.
 */
export const REGION_TARGET: Partial<Record<Region, number>> = {
  "États-Unis": 0.6,
  Europe: 0.18,
  Émergents: 0.14,
  Japon: 0.05,
  "Autres dév.": 0.03,
};

/**
 * Cible sectorielle, proche de la répartition mondiale, technologie
 * ramenée sous son poids d'indice : elle y dépasse le quart, ce qui est
 * une concentration en soi.
 */
export const SECTOR_TARGET: Partial<Record<Sector, number>> = {
  Technologie: 0.22,
  Finance: 0.17,
  Santé: 0.13,
  Consommation: 0.18,
  Industrie: 0.12,
  Énergie: 0.05,
  Matériaux: 0.05,
  "Services publics": 0.04,
  Immobilier: 0.04,
};

/** Versement minimal : en deçà, les frais d'ordre dépassent un pour cent. */
export const MIN_TICKET = 25;

/** Plafond d'exposition sur une seule zone, part du portefeuille. */
export const MAX_ZONE = 0.45;

/** Plafond spécifique aux émergents, à une fois et demie leur poids. */
export const MAX_EM = 0.165;

/** Part maximale tolérée sur une ligne à échelle de risque élevée. */
export const SRRI_CAP: Record<RiskProfile, number> = {
  prudent: 0,
  equilibre: 0.15,
  dynamique: 0.25,
  offensif: 0.45,
};

/** Seuils du signal composite : au-dessus on renforce, en dessous on allège. */
export const SIGNAL_REINFORCE = 0.35;
export const SIGNAL_REDUCE = -0.15;

/** Nombre maximal de messages affichés dans la feuille du plan. */
export const MAX_PLAN_MESSAGES = 2;
