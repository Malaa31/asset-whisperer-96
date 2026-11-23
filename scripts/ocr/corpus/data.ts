import { INSTRUMENTS, type Instrument } from "../../../src/lib/ocr/instruments";

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
    between: (min: number, max: number) => min + next() * (max - min),
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
  };
}
export type Rng = ReturnType<typeof rng>;

export interface GeneratedPosition {
  instrument: Instrument;
  quantite: number;
  pru: number;
  cours: number;
  valorisation: number;
  plusValue: number;
  variationJour: number;
}

export interface GeneratedPortfolio {
  enveloppe: "PEA" | "CTO";
  positions: GeneratedPosition[];
  especes: number;
  total: number;
}

const cents = (value: number) => Math.round(value * 100) / 100;

export function generatePortfolio(
  random: Rng,
  options: { enveloppe?: "PEA" | "CTO"; count: number; fractional?: boolean; decimals?: number },
): GeneratedPortfolio {
  const enveloppe = options.enveloppe ?? (random.chance(0.6) ? "PEA" : "CTO");
  const pool = INSTRUMENTS.filter((instrument) => (enveloppe === "PEA" ? instrument.pea : true));
  const chosen = random.shuffle(pool).slice(0, options.count);
  const positions = chosen.map((instrument): GeneratedPosition => {
    const cours = cents(instrument.price * random.between(0.75, 1.3)) || 0.01;
    const pru = cents(cours * random.between(0.6, 1.25)) || 0.01;
    let quantite: number;
    if (options.fractional && random.chance(0.5)) {
      const decimals = options.decimals ?? random.int(1, 6);
      quantite = Number(
        (random.between(0.05, 40) / Math.max(1, instrument.price / 100)).toFixed(decimals),
      );
      if (quantite <= 0) quantite = 1;
    } else {
      const budget = random.between(150, 15_000);
      quantite = Math.max(1, Math.round(budget / Math.max(cours, 0.5)));
      if (quantite > 2500) quantite = random.int(500, 2500);
    }
    const valorisation = cents(quantite * cours);
    return {
      instrument,
      quantite,
      pru,
      cours,
      valorisation,
      plusValue: cents(valorisation - quantite * pru),
      variationJour: Math.round(random.between(-3.5, 3.5) * 100) / 100,
    };
  });
  const especes = random.chance(0.5) ? cents(random.between(0, 900)) : 0;
  const total = cents(
    positions.reduce((sum, position) => sum + position.valorisation, 0) + especes,
  );
  return { enveloppe, positions, especes, total };
}

export interface GeneratedSavings {
  libelle: "Livret A" | "LDDS" | "LEP";
  numero: string;
  solde: number;
  taux: number;
  plafond: number;
  interets: number;
  operations: Array<{ date: string; label: string; amount: number }>;
}

const OP_LABELS = [
  "Virement depuis compte courant",
  "Versement programmé",
  "Intérêts annuels",
  "Virement vers compte courant",
  "Remise de chèque",
];

export function generateSavings(
  random: Rng,
  libelle: GeneratedSavings["libelle"] = "Livret A",
): GeneratedSavings {
  const plafond = libelle === "Livret A" ? 22950 : libelle === "LDDS" ? 12000 : 10000;
  const solde = cents(random.between(50, plafond));
  const taux = libelle === "LEP" ? 2.7 : 1.7;
  const operations = Array.from({ length: random.int(2, 5) }, (_, index) => {
    const day = random.int(1, 28);
    const month = ((10 - index + 12) % 12) + 1;
    const label = random.pick(OP_LABELS);
    const amount = cents(random.between(10, 1500)) * (label.includes("vers compte") ? -1 : 1);
    return {
      date: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/2026`,
      label,
      amount,
    };
  });
  return {
    libelle,
    numero: String(random.int(10_000_000, 99_999_999)) + String(random.int(100, 999)),
    solde,
    taux,
    plafond,
    interets: cents(solde * (taux / 100) * random.between(0.2, 0.9)),
    operations,
  };
}

/** Montant à la française : « 1 234,56 », séparateur de milliers au choix. */
export function frNumber(value: number, decimals = 2, thousands = " "): string {
  const sign = value < 0 ? "-" : "";
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

/** Quantité affichée telle quelle (décimales utiles seulement). */
export function frQuantity(value: number, thousands = " "): string {
  const text = String(value);
  const [integer, fraction] = text.split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return fraction ? `${grouped},${fraction}` : grouped;
}
