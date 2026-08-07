import type { Asset, RiskProfile } from "./types";

/**
 * Matrice de risque interne.
 *
 * Le risque mesuré sur l'historique d'une ligne (volatilité, pire baisse)
 * ne dit pas tout : deux supports de volatilité comparable n'exposent pas
 * aux mêmes aléas. Une crypto ajoute un risque réglementaire et de
 * liquidité, un fonds émergent un risque pays et de change, un titre vif
 * un risque spécifique d'émetteur qu'un indice large dilue.
 *
 * Cette matrice croise la nature du support avec le profil de
 * l'investisseur et produit un coefficient d'adéquation appliqué au
 * poids de la ligne dans le plan. Elle n'est pas affichée : c'est un
 * correctif de fond, pas une information de plus à lire.
 */

/** Classes de risque, indépendantes de la volatilité observée. */
type RiskClass =
  | "monetaire"
  | "obligataire"
  | "actions-large"
  | "actions-region"
  | "actions-emergents"
  | "actions-thematique"
  | "titre-vif"
  | "immobilier"
  | "crypto";

/**
 * Coefficient d'adéquation par classe et par profil.
 *
 * 1 = neutre. En dessous, le support est surexposé au regard du profil
 * et voit son poids réduit ; au-dessus, il est cohérent avec le profil
 * et légèrement favorisé. Les écarts restent modérés : la matrice
 * corrige, elle ne décide pas à la place des autres critères.
 */
const MATRIX: Record<RiskClass, Record<RiskProfile, number>> = {
  //                    prudent  équilibré  dynamique  offensif
  monetaire: { prudent: 1.15, equilibre: 1.0, dynamique: 0.85, offensif: 0.7 },
  obligataire: { prudent: 1.2, equilibre: 1.1, dynamique: 0.9, offensif: 0.75 },
  "actions-large": { prudent: 0.9, equilibre: 1.05, dynamique: 1.15, offensif: 1.15 },
  "actions-region": { prudent: 0.8, equilibre: 0.95, dynamique: 1.05, offensif: 1.1 },
  "actions-emergents": { prudent: 0.6, equilibre: 0.8, dynamique: 1.0, offensif: 1.15 },
  "actions-thematique": { prudent: 0.6, equilibre: 0.8, dynamique: 1.0, offensif: 1.15 },
  "titre-vif": { prudent: 0.55, equilibre: 0.75, dynamique: 0.95, offensif: 1.15 },
  immobilier: { prudent: 1.0, equilibre: 1.05, dynamique: 1.0, offensif: 0.9 },
  crypto: { prudent: 0.4, equilibre: 0.6, dynamique: 0.85, offensif: 1.2 },
};

const EMERGING = /émergent|emergent|emerging|asie|asia|chine|china|inde|india|brésil|bresil|latam/i;
const THEMATIC = /nasdaq|tech|small|russell|santé|sante|energie|énergie|luxe|robot|clean|semi|water|eau|défense|defense/i;
const BROAD = /monde|world|acwi|msci world|s&p ?500|sp ?500|stoxx|eurostoxx|cac|msci europe|développé|developpe/i;
const BONDS = /oblig|bond|aggregate|govies|treasury|fonds ?€|fonds ?euro/i;

/** Déduit la classe de risque d'une ligne à partir de ce qu'on en sait. */
export function riskClassOf(asset: Asset): RiskClass {
  const text = [
    asset.data["name"],
    asset.data["sector"],
    asset.data["region"],
    asset.data["ticker"],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  switch (asset.type) {
    case "crypto":
      return "crypto";
    case "immo":
      return "immobilier";
    case "livret":
      return "monetaire";
    case "cash":
      return "monetaire";
    case "av":
      return "obligataire";
    case "pea": {
      if (BONDS.test(text)) return "obligataire";
      if (EMERGING.test(text)) return "actions-emergents";
      if (THEMATIC.test(text)) return "actions-thematique";
      if (BROAD.test(text)) return "actions-large";
      // Ni indice large ni thème identifié : probablement un titre isolé,
      // dont le risque spécifique n'est pas dilué.
      const isEtf = /etf|ucits|indiciel|tracker/i.test(text);
      return isEtf ? "actions-region" : "titre-vif";
    }
    default:
      return "monetaire";
  }
}

/**
 * Coefficient d'adéquation d'une ligne au profil, entre 0,4 et 1,2.
 * Appliqué au poids dans le plan, sans être affiché.
 */
export function suitabilityFactor(asset: Asset, profile: RiskProfile): number {
  const cls = riskClassOf(asset);
  return MATRIX[cls]?.[profile] ?? 1;
}
