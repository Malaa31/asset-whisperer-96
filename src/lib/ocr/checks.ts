import { isValidIsin } from "@/lib/position-parser";

/**
 * Contrôles de cohérence d'une ligne importée. Chaque champ douteux reçoit un motif,
 * affiché en orange dans l'écran de vérification.
 */

export type CheckedField = "nom" | "isin" | "quantite" | "pru" | "cours" | "valeur" | "total";
export type FieldFlags = Partial<Record<CheckedField, string>>;

export interface CheckablePosition {
  nom: string;
  isin: string | null;
  quantite: number | null;
  pru: number | null;
  cours: number | null;
  valeur: number | null;
  /** Le nom a été rattaché à un titre du référentiel. */
  nomReconnu?: boolean;
  /** Le cours a été déduit (valorisation / quantité), pas lu. */
  coursDeduit?: boolean;
}

export function checkPosition(position: CheckablePosition): FieldFlags {
  const flags: FieldFlags = {};
  const { quantite, cours, valeur, pru } = position;
  if (position.isin && !isValidIsin(position.isin))
    flags.isin = "ISIN invalide (clé de contrôle fausse)";
  if (!position.isin && position.nomReconnu === false)
    flags.nom = "Titre non reconnu : vérifie le nom ou choisis la ligne existante";
  if (quantite === null || quantite <= 0) flags.quantite = "Quantité manquante";
  if (valeur === null || valeur <= 0) flags.valeur = "Valorisation manquante";
  if (quantite && cours && valeur && !position.coursDeduit) {
    const gap = Math.abs(quantite * cours - valeur) / Math.max(valeur, 0.01);
    if (gap > 0.02) {
      const motif = "Quantité × cours ne donne pas la valorisation";
      flags.quantite = motif;
      flags.cours = motif;
      flags.valeur = motif;
    }
  }
  if (position.coursDeduit) flags.cours = "Cours déduit de la valorisation, pas lu";
  if (pru !== null && pru <= 0) flags.pru = "PRU invalide";
  return flags;
}

/** Le total affiché doit couvrir la somme des lignes (le reste = espèces ou lignes hors écran). */
export function checkTotal(total: number | null, values: Array<number | null>): string | null {
  if (total === null) return null;
  const sum = values.reduce<number>((acc, value) => acc + (value ?? 0), 0);
  if (sum > total + 0.05) return "La somme des lignes dépasse le total affiché";
  return null;
}
