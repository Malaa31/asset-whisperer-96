import type { Asset } from "@/lib/types";

export type ImportKind = "titres" | "solde";
export type Envelope = "PEA" | "CTO";
export type ImportAction = "update" | "create" | "ignore";

export interface PositionLine {
  nom: string;
  isin?: string | null;
  ticker?: string | null;
  quantite: number | null;
  pru?: number | null;
  cours?: number | null;
  valeur?: number | null;
  devise?: string | null;
  confiance: number;
}

export interface SavingsLine {
  etablissement?: string | null;
  libelle?: string | null;
  solde: number | null;
  date?: string | null;
  confiance: number;
}

export type ImportExtraction =
  | {
      kind: "titres";
      courtier?: string | null;
      enveloppe?: Envelope | "inconnu" | null;
      lignes: PositionLine[];
      avertissements: string[];
    }
  | {
      kind: "solde";
      etablissement?: string | null;
      libelle?: string | null;
      solde: number | null;
      date?: string | null;
      confiance: number;
      avertissements: string[];
    };

export interface ImportControl {
  index: number;
  libelle: string;
  avertissements: string[];
}

export type ImportDecision =
  | {
      kind: "titres";
      action: ImportAction;
      ligne: PositionLine;
      enveloppe: Envelope;
      assetId?: string;
    }
  | {
      kind: "solde";
      action: ImportAction;
      ligne: SavingsLine;
      assetId?: string;
    };

export function parseFrenchNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  let normalized = value
    .trim()
    .replace(/[\s\u00a0\u202f']/g, "")
    .replace(/[€$]/g, "")
    .replace(/−/g, "-");
  if (!normalized || !/^[+-]?[\d.,]+$/.test(normalized)) return null;

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
    if (normalized.includes(",")) return null;
  } else if ((normalized.match(/\./g) ?? []).length > 1) {
    normalized = normalized.replace(/\./g, "");
  } else if (/\.\d{3}$/.test(normalized)) {
    normalized = normalized.replace(".", "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function controlsForExtraction(extraction: ImportExtraction): ImportControl[] {
  if (extraction.kind === "solde") {
    return [
      {
        index: 0,
        libelle: extraction.libelle || extraction.etablissement || "Solde du livret",
        avertissements:
          extraction.confiance < 0.7 ? ["Confiance faible : vérifie le montant."] : [],
      },
    ];
  }

  return extraction.lignes.map((ligne, index) => {
    const avertissements: string[] = [];
    const prix = ligne.cours ?? ligne.pru;
    if (
      ligne.quantite !== null &&
      prix !== null &&
      prix !== undefined &&
      ligne.valeur !== null &&
      ligne.valeur !== undefined
    ) {
      const calculee = ligne.quantite * prix;
      const ecart = Math.abs(calculee - ligne.valeur) / Math.max(Math.abs(ligne.valeur), 0.01);
      if (ecart > 0.02)
        avertissements.push("Quantité × cours/PRU diffère de la valeur de plus de 2 %.");
    }
    if (!ligne.isin?.trim() && !ligne.ticker?.trim()) {
      avertissements.push("ISIN et ticker manquants.");
    }
    if (ligne.confiance < 0.7) avertissements.push("Confiance faible : vérifie cette ligne.");
    return { index, libelle: ligne.nom, avertissements };
  });
}

export function matchPosition(
  ligne: Pick<PositionLine, "nom" | "isin" | "ticker">,
  assets: Asset[],
  enveloppe: Envelope,
): Asset | null {
  const candidats = assets.filter(
    (asset) =>
      asset.type === "pea" &&
      normalize(String(asset.data["envelope"] ?? "")) === enveloppe.toLowerCase(),
  );
  const isin = normalize(ligne.isin ?? "");
  if (isin) {
    const exact = candidats.find((asset) => normalize(String(asset.data["isin"] ?? "")) === isin);
    if (exact) return exact;
  }
  const ticker = normalize(ligne.ticker ?? "");
  if (ticker) {
    const exact = candidats.find(
      (asset) => normalize(String(asset.data["ticker"] ?? "")) === ticker,
    );
    if (exact) return exact;
  }

  const name = normalize(ligne.nom);
  if (!name) return null;
  let best: { asset: Asset; score: number } | null = null;
  for (const asset of candidats) {
    const candidate = normalize(String(asset.data["name"] ?? ""));
    const score = nameSimilarity(name, candidate);
    if (score >= 0.76 && (!best || score > best.score)) best = { asset, score };
  }
  return best?.asset ?? null;
}

export function matchSavingsAccount(
  ligne: Pick<SavingsLine, "libelle" | "etablissement">,
  assets: Asset[],
): Asset | null {
  const name = normalize(ligne.libelle || ligne.etablissement || "");
  if (!name) return null;
  const candidats = assets.filter((asset) => asset.type === "livret");
  const exact = candidats.find((asset) => {
    const existing = normalize(String(asset.data["name"] ?? ""));
    return existing === name || existing === normalize(ligne.etablissement || "");
  });
  if (exact) return exact;

  let best: { asset: Asset; score: number } | null = null;
  for (const asset of candidats) {
    const candidate = normalize(String(asset.data["name"] ?? ""));
    const score = nameSimilarity(name, candidate);
    if (score >= 0.76 && (!best || score > best.score)) best = { asset, score };
  }
  return best?.asset ?? null;
}

export function applyImportDecisions(
  assets: Asset[],
  decisions: ImportDecision[],
  lastImportAt: string,
  createId: () => string,
): Asset[] {
  const next = [...assets];

  for (const decision of decisions) {
    if (decision.action === "ignore") continue;

    if (decision.kind === "titres") {
      const index = decision.assetId
        ? next.findIndex((asset) => asset.id === decision.assetId)
        : -1;
      const existing = index >= 0 ? next[index] : undefined;
      if (
        decision.action === "update" &&
        (!existing ||
          existing.type !== "pea" ||
          normalize(String(existing.data["envelope"] ?? "")) !== decision.enveloppe.toLowerCase())
      ) {
        continue;
      }
      const oldData = existing?.data ?? {};
      const data: Asset["data"] = { ...oldData, envelope: decision.enveloppe, lastImportAt };
      putIfPresent(data, "name", decision.ligne.nom.trim());
      putIfPresent(data, "isin", decision.ligne.isin?.trim());
      putIfPresent(data, "ticker", decision.ligne.ticker?.trim());
      putIfPresent(data, "quantity", decision.ligne.quantite);
      putIfPresent(data, "pru", decision.ligne.pru);
      const priceFromVisibleValue =
        decision.ligne.valeur !== null &&
        decision.ligne.valeur !== undefined &&
        decision.ligne.quantite !== null &&
        decision.ligne.quantite > 0
          ? decision.ligne.valeur / decision.ligne.quantite
          : null;
      putIfPresent(data, "currentPrice", decision.ligne.cours ?? priceFromVisibleValue);
      putIfPresent(data, "currency", decision.ligne.devise?.trim());
      const stamp = lastImportAt;
      const updated: Asset = {
        id: existing?.id ?? createId(),
        type: "pea",
        data,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      if (existing) next[index] = updated;
      else next.push(updated);
      continue;
    }

    const index = decision.assetId ? next.findIndex((asset) => asset.id === decision.assetId) : -1;
    const existing = index >= 0 ? next[index] : undefined;
    if (decision.action === "update" && (!existing || existing.type !== "livret")) continue;
    const data: Asset["data"] = {
      ...(existing?.data ?? {}),
      amount: decision.ligne.solde ?? 0,
      lastImportAt,
    };
    if (!existing) {
      data["name"] =
        decision.ligne.libelle?.trim() || decision.ligne.etablissement?.trim() || "Livret";
      if (decision.ligne.etablissement?.trim())
        data["etablissement"] = decision.ligne.etablissement.trim();
    }
    const updated: Asset = {
      id: existing?.id ?? createId(),
      type: "livret",
      data,
      createdAt: existing?.createdAt ?? lastImportAt,
      updatedAt: lastImportAt,
    };
    if (existing) next[index] = updated;
    else next.push(updated);
  }

  return next;
}

function putIfPresent(
  data: Asset["data"],
  key: string,
  value: string | number | null | undefined,
): void {
  if (value !== null && value !== undefined && value !== "") data[key] = value;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function nameSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (Math.min(left.length, right.length) >= 6 && (left.includes(right) || right.includes(left)))
    return 0.85;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j]!;
      previous[j] = Math.min(
        previous[j]! + 1,
        previous[j - 1]! + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return 1 - previous[right.length]! / Math.max(left.length, right.length);
}
