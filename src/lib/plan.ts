import { assetValue } from "./calc";
import { suitabilityFactor } from "./riskMatrix";
import type { Analysis } from "./signals";
import { TARGET_ALLOCATIONS, type Asset, type Profile, type RiskProfile } from "./types";

/**
 * Plan de versement mensuel.
 *
 * Le versement ne récompense pas les meilleures lignes : il rapproche le
 * portefeuille de l'allocation cible du profil en n'achetant que ce qui
 * manque. C'est le rééquilibrage par les flux, méthode courante en
 * gestion privée : elle évite de vendre — donc la fiscalité et les frais —
 * et corrige la dérive mois après mois.
 *
 * Trois niveaux successifs :
 *  1. l'épargne de précaution est complétée en priorité tant qu'elle est
 *     sous le seuil ;
 *  2. le reste se répartit entre poches selon leur écart à la cible,
 *     tempéré par la qualité des supports disponibles ;
 *  3. dans une poche, les lignes se départagent sur leur qualité passée
 *     ajustée du risque, leur tendance et leur adéquation au profil.
 */

/**
 * Seuil de l'épargne de précaution, en mois de revenus.
 * Il dépend du profil : accepter plus de risque suppose d'être moins
 * exposé à devoir vendre au mauvais moment, donc un matelas plus épais
 * pour un prudent qui vit mal la volatilité, plus mince pour un offensif
 * qui l'assume.
 */
export const BUFFER_BY_PROFILE: Record<RiskProfile, number> = {
  prudent: 12,
  equilibre: 9,
  dynamique: 6,
  offensif: 4,
};

/** Valeur par défaut, utilisée hors contexte de profil. */
export const BUFFER_MONTHS = 6;

export function bufferMonthsFor(risk: RiskProfile): number {
  return BUFFER_BY_PROFILE[risk] ?? BUFFER_MONTHS;
}

/** Part du versement réservée à la précaution tant qu'elle est incomplète. */
const BUFFER_SHARE = 0.35;

/** Dosage écart / qualité dans la répartition entre poches. */
const GAP_WEIGHT = 0.7;

/**
 * Part maximale d'une poche dans un versement mensuel.
 * Sans ce plafond, une poche partant de presque rien absorbe tout le
 * versement pendant des mois : le rattrapage doit s'étaler.
 */
const MAX_POCKET_SHARE = 0.5;

/** En dessous, un versement ne vaut pas les frais d'ordre. */
const MIN_TICKET = 20;

export type Pocket = "actions" | "securise" | "reels" | "precaution";

export const POCKET_LABELS: Record<Pocket, string> = {
  actions: "Actions",
  securise: "Sécurisé",
  reels: "Actifs réels",
  precaution: "Précaution",
};

/**
 * Allocation cible par profil, sur les seules poches où l'on verse.
 * Les cibles sont renormalisées sur les poches réellement détenues :
 * l'app ne suggère jamais d'ouvrir un support absent du patrimoine.
 */
const POCKET_TARGETS: Record<RiskProfile, Record<Pocket, number>> = {
  prudent: { actions: 25, securise: 45, reels: 10, precaution: 20 },
  equilibre: { actions: 50, securise: 30, reels: 10, precaution: 10 },
  dynamique: { actions: 70, securise: 15, reels: 10, precaution: 5 },
  offensif: { actions: 85, securise: 8, reels: 5, precaution: 2 },
};

/** Or, argent et autres métaux, quel que soit le type de ligne choisi. */
const METALS = /\b(or\b|gold|argent m[ée]tal|silver|platine|palladium|m[ée]taux|lingot)\b/i;

/**
 * Épargne de précaution : tout ce qui est mobilisable sans délai ni
 * perte — livrets réglementés, comptes courants, fonds euros d'assurance
 * vie, espèces d'un compte-titres ordinaire.
 *
 * Seules les liquidités d'un PEA, d'un PEE ou d'un PER en sont écartées :
 * un retrait anticipé y clôture le plan ou suppose un cas de déblocage,
 * elles ne couvrent donc pas un imprévu.
 */
export function isEmergencySavings(a: Asset): boolean {
  const label = `${a.data["name"] ?? ""} ${a.data["envelope"] ?? ""}`.toLowerCase();
  if (/\b(pea|pee|per)\b/.test(label)) return false;
  if (a.type === "livret" || a.type === "cash") return true;
  if (a.type === "av") return Number(a.data["fondsEurosAmount"] ?? 0) > 0;
  return false;
}

/** Poche d'une ligne, ou null si elle ne peut pas recevoir de versement. */
/**
 * Supports d'immobilier papier : parts de SCPI, OPCI, SCI. Contrairement
 * à un bien détenu en direct, ils s'achètent par fractions et peuvent
 * donc recevoir un versement mensuel.
 */
const PAPER_REALESTATE = /\b(scpi|opci|sci\b|pierre[- ]papier|papier|parts?)\b/i;

/**
 * Une ligne peut-elle recevoir un versement ?
 *
 * Un appartement, une maison, un terrain pèsent dans l'allocation mais
 * ne s'abondent pas : on n'ajoute pas cinquante euros par mois à un bien
 * détenu en direct. Seuls les supports divisibles sont des destinations.
 */
export function isContributable(a: Asset): boolean {
  if (a.type === "credit" || a.type === "cash" || a.type === "autre") return false;
  if (a.type === "immo") {
    const label = `${a.data["name"] ?? ""} ${a.data["type"] ?? ""} ${a.data["sector"] ?? ""}`;
    return PAPER_REALESTATE.test(label);
  }
  return pocketOf(a) !== null;
}

export function pocketOf(a: Asset): Pocket | null {
  const label = `${a.data["name"] ?? ""} ${a.data["sector"] ?? ""}`;
  if (METALS.test(label)) return "reels";
  if (a.type === "pea" || a.type === "crypto") return "actions";
  if (a.type === "immo") return "reels";
  if (a.type === "livret") return "precaution";
  if (a.type === "av") return Number(a.data["fondsEurosAmount"] ?? 0) > 0 ? "securise" : "actions";
  if (a.type === "autre") return "reels";
  // Compte courant et crédits : trésorerie ou passif, jamais une
  // destination de versement même s'ils comptent dans le matelas.
  return null;
}

export function isPlanCandidate(a: Asset): boolean {
  const p = pocketOf(a);
  // La précaution ne fait plus partie du versement : proposer d'y ajouter
  // une ligne serait trompeur, elle ne recevrait jamais rien.
  if (!p || p === "precaution") return false;
  return isContributable(a) && assetValue(a) >= 0;
}

export interface BufferStatus {
  amount: number;
  months?: number;
  /** Seuil retenu pour ce profil, en mois de revenus. */
  threshold: number;
  sufficient: boolean;
}

export function bufferStatus(assets: Asset[], profile: Profile | null): BufferStatus {
  const amount = assets.filter(isEmergencySavings).reduce((s, a) => s + assetValue(a), 0);
  const threshold = bufferMonthsFor(profile?.riskProfile ?? "equilibre");
  const income = profile?.incomeMonthly ?? 0;
  if (income <= 0) return { amount, threshold, sufficient: false };
  const months = amount / income;
  return { amount, months, threshold, sufficient: months >= threshold };
}

export interface PlanLine {
  assetId: string;
  label: string;
  pocket: Pocket;
  weight: number;
  amount: number;
  score: number;
  signal?: Analysis["signal"];
}

export interface PocketView {
  pocket: Pocket;
  current: number;
  target: number;
  share: number;
}

export interface PlanResult {
  lines: PlanLine[];
  buffer: BufferStatus;
  pockets: PocketView[];
  manual?: boolean;
  note?: string;
}

/**
 * Cibles du profil, renormalisées sur les poches réellement détenues.
 * Sans cela, une cible immobilier papier chez quelqu'un qui n'a aucune
 * SCPI laisserait une part du versement sans destination.
 */
function targetOf(risk: RiskProfile, held: Pocket[]): Record<Pocket, number> {
  const base = POCKET_TARGETS[risk] ?? POCKET_TARGETS.equilibre;
  const sum = held.reduce((s, p) => s + base[p], 0);
  const out: Record<Pocket, number> = { actions: 0, securise: 0, reels: 0, precaution: 0 };
  for (const p of held) out[p] = sum > 0 ? (base[p] / sum) * 100 : 100 / held.length;
  return out;
}

export function buildPlanFromHoldings(
  assets: Asset[],
  analyses: Map<string, Analysis>,
  profile: Profile | null,
  dca: number,
  excluded: string[] = [],
  manual?: Record<string, number>,
): PlanResult {
  const risk = profile?.riskProfile ?? "equilibre";
  const buffer = bufferStatus(assets, profile);

  // Deux ensembles distincts : tout ce qui pèse dans l'allocation, et le
  // sous-ensemble qui peut réellement recevoir le versement.
  const allByPocket = new Map<Pocket, Asset[]>();
  for (const a of assets) {
    const p = pocketOf(a);
    if (p && assetValue(a) > 0) allByPocket.set(p, [...(allByPocket.get(p) ?? []), a]);
  }

  const candidates = assets.filter((a) => isPlanCandidate(a) && !excluded.includes(a.id));
  if (!candidates.length || dca <= 0) {
    return {
      lines: [],
      buffer,
      pockets: [],
      note: "Aucune ligne ne peut recevoir de versement. Ajoutez un support d'investissement.",
    };
  }

  if (manual) {
    const chosen = candidates.filter((a) => (manual[a.id] ?? 0) > 0);
    const sum = chosen.reduce((s, a) => s + (manual[a.id] ?? 0), 0);
    if (chosen.length && sum > 0) {
      return {
        lines: chosen.map((a) => {
          const an = analyses.get(a.id);
          return {
            assetId: a.id,
            label: String(a.data["name"] ?? "Ligne"),
            pocket: pocketOf(a) ?? "actions",
            weight: Math.round(((manual[a.id] ?? 0) / sum) * 100),
            amount: Math.round((dca * (manual[a.id] ?? 0)) / sum),
            score: an?.score ?? 0,
            ...(an ? { signal: an.signal } : {}),
          };
        }),
        buffer,
        pockets: [],
        manual: true,
      };
    }
  }

  /**
   * Valeur nette d'une poche : les crédits sont déduits de l'actif qu'ils
   * financent. Un bien de 200 000 € grevé de 147 000 € d'encours ne pèse
   * pas 200 000 € dans l'allocation, mais 53 000 €. Raisonner en brut
   * surestime massivement l'immobilier et fausse tout le plan.
   */
  const debts = assets.filter((a) => a.type === "credit");
  const debtTotal = debts.reduce((s2, a) => s2 + Math.abs(assetValue(a)), 0);

  const byPocket = new Map<Pocket, Asset[]>();
  for (const a of candidates) {
    const p = pocketOf(a)!;
    byPocket.set(p, [...(byPocket.get(p) ?? []), a]);
  }
  // Les crédits immobiliers s'imputent sur la poche des actifs réels ;
  // au-delà, l'excédent réduit le patrimoine sans creuser une poche.
  const grossOf = (p: Pocket): number =>
    (allByPocket.get(p) ?? []).reduce((s2, a) => s2 + Math.max(0, assetValue(a)), 0);
  const valueOf = (p: Pocket): number =>
    p === "reels" ? Math.max(0, grossOf(p) - debtTotal) : grossOf(p);

  const ALL: Pocket[] = ["actions", "securise", "reels"];
  const invested = ALL.reduce((s, p) => s + valueOf(p), 0);

  // La cible s'applique à toutes les poches où l'utilisateur détient
  // quelque chose, qu'elles soient abondables ou non : un bien immobilier
  // pèse dans l'allocation même s'il ne peut recevoir aucun versement.
  const held = ALL.filter((p) => allByPocket.has(p) || byPocket.has(p));
  const target = targetOf(risk, held);

  // L'épargne de précaution n'entre pas dans le versement : c'est une
  // réserve à constituer, pas un placement à arbitrer. L'app se contente
  // de signaler si elle est insuffisante, et le versement va entièrement
  // aux supports d'investissement.
  const remaining = dca;
  const reserved = new Map<Pocket, number>();

  // ── 2. Écart à la cible, tempéré par la qualité des supports ──
  // Seules les poches disposant d'un support abondable peuvent recevoir.
  const investable = (["actions", "securise", "reels"] as Pocket[]).filter((p) =>
    byPocket.has(p),
  );
  const currentOf = (p: Pocket): number => (invested > 0 ? (valueOf(p) / invested) * 100 : 0);

  const gaps = investable.map((p) => {
    const current = invested > 0 ? (valueOf(p) / invested) * 100 : 0;
    const scores = (byPocket.get(p) ?? [])
      .map((a) => analyses.get(a.id)?.score)
      .filter((x): x is number => typeof x === "number");
    // Sans analyse, qualité neutre : un fonds euros n'a pas d'historique
    // de cours, il ne doit pas être écarté pour autant.
    const quality = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 50;
    // Le fonds euros et les livrets remplissent la même fonction
    // défensive. Un matelas déjà excédentaire couvre donc le besoin de
    // sécurisé : sans cette lecture, l'app ferait verser sur une
    // assurance vie alors que le Livret A déborde déjà.
    const defensiveNeed =
      p === "securise"
        ? Math.max(
            0,
            target["securise"] + target["precaution"] - current - currentOf("precaution"),
          )
        : Math.max(0, target[p] - current);
    return { pocket: p, current, gap: defensiveNeed, quality };
  });

  // Une poche déjà au-dessus de sa cible ne reçoit rien : la qualité de
  // ses supports ne justifie pas d'aggraver une surexposition. Elle ne
  // départage que les poches réellement en retard.
  const behind = gaps.filter((g) => g.gap > 0);
  const pool = behind.length ? behind : gaps;
  const gapSum = pool.reduce((s, g) => s + g.gap, 0);
  const qualSum = pool.reduce((s, g) => s + g.quality, 0);
  for (const g of pool) {
    const gapShare = gapSum > 0 ? g.gap / gapSum : 0;
    const qualShare = qualSum > 0 ? g.quality / qualSum : 1 / Math.max(1, pool.length);
    // Aucune poche en retard : la qualité décide seule.
    const share = gapSum > 0 ? GAP_WEIGHT * gapShare + (1 - GAP_WEIGHT) * qualShare : qualShare;
    reserved.set(g.pocket, share);
  }

  // Plafonnement, puis renormalisation sur les poches restantes.
  if (reserved.size > 1) {
    let excess = 0;
    for (const [p, share] of reserved) {
      if (share > MAX_POCKET_SHARE) {
        excess += share - MAX_POCKET_SHARE;
        reserved.set(p, MAX_POCKET_SHARE);
      }
    }
    if (excess > 0) {
      const room = [...reserved.entries()].filter(([, sh]) => sh < MAX_POCKET_SHARE);
      const roomSum = room.reduce((s2, [, sh]) => s2 + (MAX_POCKET_SHARE - sh), 0);
      for (const [p, sh] of room) {
        const add = roomSum > 0 ? (excess * (MAX_POCKET_SHARE - sh)) / roomSum : 0;
        reserved.set(p, sh + add);
      }
    }
  }
  for (const [p, share] of reserved) reserved.set(p, remaining * share);

  // ── 3. Répartition dans chaque poche ──
  const lines: PlanLine[] = [];
  for (const [pocket, amount] of reserved) {
    if (amount < MIN_TICKET) continue;
    const pool = (byPocket.get(pocket) ?? []).filter((a) => {
      const an = analyses.get(a.id);
      // On ne renforce pas une ligne qu'on envisage de réduire.
      return !an || an.signal !== "alleger";
    });
    if (!pool.length) continue;

    const weights = pool.map((a) => {
      const an = analyses.get(a.id);
      const score = an?.score ?? 50;
      // Le poids reste borné : la matrice d'adéquation module le score
      // sans jamais l'annuler ni le faire exploser. Sans ce garde-fou,
      // deux correctifs successifs peuvent se composer et faire
      // disparaître une ligne pourtant retenue.
      const w = Math.min(120, Math.max(10, score * suitabilityFactor(a, risk)));
      return { asset: a, w, score, an };
    });
    const wSum = weights.reduce((s, x) => s + x.w, 0);

    for (const x of weights) {
      const part = (amount * x.w) / wSum;
      if (part < MIN_TICKET && weights.length > 1) continue;
      lines.push({
        assetId: x.asset.id,
        label: String(x.asset.data["name"] ?? "Ligne"),
        pocket,
        weight: 0,
        amount: Math.round(part),
        score: x.score,
        ...(x.an ? { signal: x.an.signal } : {}),
      });
    }
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  for (const l of lines) l.weight = total > 0 ? Math.round((l.amount / total) * 100) : 0;
  lines.sort((a, b) => b.amount - a.amount);

  const pockets: PocketView[] = held.map((p) => ({
    pocket: p,
    current: invested > 0 ? (valueOf(p) / invested) * 100 : 0,
    target: target[p],
    share:
      total > 0
        ? (lines.filter((l) => l.pocket === p).reduce((s, l) => s + l.amount, 0) / total) * 100
        : 0,
  }));

  return {
    lines,
    buffer,
    pockets,
    ...(lines.length ? {} : { note: "Le versement est trop faible pour être réparti." }),
  };
}
