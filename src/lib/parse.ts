import type { AssetType } from "./types";

/**
 * Convertit une phrase française en ligne de patrimoine.
 * Tout se fait localement : aucune donnée n'est envoyée sur le réseau.
 *
 * Exemples reconnus :
 *   « maison qui vaut 250 000, louée 700 par mois »
 *   « crédit immo, capital restant 90 896, mensualité 592, taux 1,2 % »
 *   « 88 parts d'Amundi S&P 500 à 58,14, PRU 48,48 »
 *   « Livret A 22 700 » · « bitcoin 0,5 à 60 000 »
 *
 * L'analyse est à base de règles : elle couvre les formulations
 * courantes mais reste faillible, d'où l'aperçu systématique avant
 * enregistrement.
 */

export interface ParsedAsset {
  type: AssetType;
  data: Record<string, string | number>;
  /** Résumé lisible pour la relecture. */
  summary: string[];
  /** Aucun montant reconnu : la ligne reste à compléter. */
  incomplete: boolean;
}

/** « 250 000 », « 250.000 », « 1,2 », « 320k », « 1,5M » → nombre. */
function toNumber(raw: string): number {
  let s = raw.replace(/[\s\u00a0\u202f]/g, "");
  let mult = 1;
  const suffix = s.match(/([kKmM])$/);
  if (suffix) {
    mult = suffix[1]!.toLowerCase() === "k" ? 1_000 : 1_000_000;
    s = s.slice(0, -1);
  }
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(",", ".");
  else if (hasDot && /\.\d{3}(\D|$)/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : 0;
}

interface Num {
  value: number;
  index: number;
  raw: string;
}

function numbers(text: string): Num[] {
  const out: Num[] = [];
  const re = /\d[\d\s\u00a0\u202f.]*(?:[.,]\d+)?\s*[kKmM]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = toNumber(m[0].replace(/\s+([kKmM])$/, "$1"));
    if (value > 0) out.push({ value, index: m.index, raw: m[0] });
  }
  return out;
}

/** Nombre suivant un mot-clé : « mensualité de 592 », « PRU 48,48 ». */
function after(text: string, keys: string[]): number | undefined {
  for (const k of keys) {
    const re = new RegExp(
      `${k}\\s*(?:de\\s*|d'|:|est\\s*(?:de\\s*)?|à\\s*|a\\s*)?(\\d[\\d\\s\\u00a0\\u202f.]*(?:[.,]\\d+)?\\s*[kKmM]?)`,
      "i",
    );
    const m = re.exec(text);
    if (m?.[1]) {
      const v = toNumber(m[1].replace(/\s+([kKmM])$/, "$1"));
      if (v > 0) return v;
    }
  }
  return undefined;
}

/** Nombre précédant un mot-clé : « 40 000 en fonds euros ». */
function before(text: string, keys: string[]): number | undefined {
  for (const k of keys) {
    const re = new RegExp(
      `(\\d[\\d\\s\\u00a0\\u202f.]*(?:[.,]\\d+)?\\s*[kKmM]?)\\s*(?:€|euros?)?\\s*(?:en|de|d'|sur|dans)?\\s*(?:mon|ma|le|la|les)?\\s*${k}`,
      "i",
    );
    const m = re.exec(text);
    if (m?.[1]) {
      const v = toNumber(m[1].replace(/\s+([kKmM])$/, "$1"));
      if (v > 0) return v;
    }
  }
  return undefined;
}

/**
 * Premier montant « principal » : on écarte les valeurs déjà attribuées
 * à un autre champ, les pourcentages, les durées et les quantités.
 */
function firstAmount(text: string, nums: Num[], used: Array<number | undefined>): number | undefined {
  for (const n of nums) {
    if (used.some((u) => u !== undefined && Math.abs(u - n.value) < 0.001)) continue;
    const tail = text.slice(n.index + n.raw.length, n.index + n.raw.length + 14).toLowerCase();
    if (/^\s*(%|pour ?cent)/.test(tail)) continue;
    if (/^\s*(ans?|années?|mois\b|m2|m²|parts?|actions?|titres?|unit[ée]s?)/.test(tail)) continue;
    return n.value;
  }
  return undefined;
}

const TYPES: Array<{ type: AssetType; words: RegExp }> = [
  { type: "credit", words: /\b(pr[êe]t|cr[ée]dit|emprunt|emprunt[ée])\b/i },
  {
    type: "immo",
    words: /\b(appartement|appart|appt|maison|studio|villa|terrain|immobilier|scpi|t[1-5]\b|r[ée]sidence|locatif|loft|duplex)\b/i,
  },
  { type: "livret", words: /\b(livret|ldds?|lep\b|pel\b|cel\b)\b/i },
  { type: "av", words: /\b(assurance[- ]?vie|\bav\b|contrat)\b/i },
  { type: "crypto", words: /\b(bitcoin|btc|ethereum|eth\b|solana|sol\b|crypto|xrp)\b/i },
  { type: "pea", words: /\b(action|actions|etf|titre|titres|parts?|pea\b|cto\b|bourse)\b/i },
  {
    type: "cash",
    words: /\b(compte[- ](?:courant|en banque|bancaire|ch[èe]ques)|esp[èe]ces|cash|liquidit[ée]s?)\b/i,
  },
];

const CRYPTO_TICKERS: Record<string, string> = {
  bitcoin: "BTC-EUR",
  btc: "BTC-EUR",
  ethereum: "ETH-EUR",
  eth: "ETH-EUR",
  solana: "SOL-EUR",
  sol: "SOL-EUR",
  xrp: "XRP-EUR",
};

const fmt = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Intitulé propre à partir des mots reconnus. */
function labelFrom(text: string, type: AssetType): string {
  if (/\blivret\s*a\b/i.test(text)) return "Livret A";
  if (/\bldds?\b/i.test(text)) return "LDDS";
  if (/\blep\b/i.test(text)) return "LEP";
  if (/\bpel\b/i.test(text)) return "PEL";
  const immo = text.match(/\b(maison|appartement|appart|studio|villa|terrain|loft|duplex|scpi)\b/i);
  if (immo) return immo[1]!.charAt(0).toUpperCase() + immo[1]!.slice(1).toLowerCase();
  if (type === "credit") return /immo/i.test(text) ? "Crédit immobilier" : "Crédit";
  if (type === "cash") return "Compte courant";
  if (type === "av") return "Assurance vie";
  // Nom d'un titre : ce qui suit « action », « ETF », « parts de »…
  const m = text.match(
    /\b(?:actions?|etf|titres?|parts?)\s+(?:de\s+|d'|du\s+|sur\s+)?([A-Za-zÀ-ÿ][\wÀ-ÿ&'.-]*(?:\s+[A-Za-zÀ-ÿ0-9][\wÀ-ÿ&'.-]*){0,3})/i,
  );
  if (m?.[1]) {
    const name = m[1]
      .replace(/\b(achet[ée]e?s?|au|à|a|prix|pour|avec|quantit[ée]|de|du|des|et|dont|par|pru)\b.*$/i, "")
      .trim();
    if (name.length > 1) return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return "Ligne bourse";
}

export function parseAssetText(input: string): ParsedAsset {
  const text = input.trim();
  const nums = numbers(text);
  const found = TYPES.find((t) => t.words.test(text));
  const type: AssetType = found?.type ?? "autre";

  const data: Record<string, string | number> = {};
  const summary: string[] = [];

  if (type === "credit") {
    const mensualite = after(text, ["mensualit[ée]s?", "par mois", "\\/\\s*mois", "[ée]ch[ée]ance"]);
    const taux = after(text, ["taux"]) ?? (/\d\s*%/.test(text) ? after(text, ["à", "a"]) : undefined);
    const capital =
      after(text, [
        "capital restant",
        "restant d[uû]",
        "reste [àa] rembourser",
        "il (?:me )?reste",
        "reste",
        "capital",
        "emprunt[ée]?",
        "pr[êe]t",
        "cr[ée]dit",
      ]) ?? firstAmount(text, nums, [mensualite, taux]);
    if (capital) {
      data["capitalRestant"] = capital;
      summary.push(fmt.format(capital));
    }
    if (taux !== undefined) {
      data["taux"] = taux;
      summary.push(`${taux} %`);
    }
    if (mensualite !== undefined) {
      data["mensualite"] = mensualite;
      summary.push(`${fmt.format(mensualite)}/mois`);
    }
    data["name"] = labelFrom(text, type);
  } else if (type === "immo") {
    const loyer = after(text, ["lou[ée]e?", "loyer"]);
    const valeur =
      after(text, ["estim[ée]e?", "valeur", "vaut", "prix", "achet[ée]e?"]) ??
      firstAmount(text, nums, [loyer]);
    if (valeur) {
      data["valeurEstimee"] = valeur;
      summary.push(fmt.format(valeur));
    }
    if (loyer !== undefined) {
      data["loyer"] = loyer;
      summary.push(`loyer ${fmt.format(loyer)}`);
    }
    data["name"] = labelFrom(text, type);
    data["type"] = /locatif|lou[ée]/i.test(text) ? "Locatif" : "Résidence principale";
  } else if (type === "pea" || type === "crypto") {
    const qty =
      after(text, ["quantit[ée]"]) ??
      (() => {
        const m = text.match(
          /(\d[\d\s\u00a0\u202f.]*(?:[.,]\d+)?)\s*(?:parts?|actions?|titres?|unit[ée]s?|bitcoin|btc|ethereum|eth|solana|sol|xrp)/i,
        );
        return m?.[1] ? toNumber(m[1]) : undefined;
      })();
    const pru = after(text, ["pru", "prix de revient", "prix moyen"]);
    const price =
      after(text, ["cours", "prix unitaire", "prix"]) ??
      (() => {
        const m = text.match(/(?:à|a)\s*(\d[\d\s\u00a0\u202f.]*(?:[.,]\d+)?)/i);
        return m?.[1] ? toNumber(m[1]) : undefined;
      })();

    if (qty) {
      data["quantity"] = qty;
      summary.push(`${qty} × ${price ?? pru ?? "?"} €`);
    }
    const priceField = type === "crypto" ? "prixUnitaire" : "currentPrice";
    if (price !== undefined) data[priceField] = price;
    if (pru !== undefined && type === "pea") data["pru"] = pru;
    if (price === undefined && pru !== undefined) data[priceField] = pru;

    if (type === "crypto") {
      const k = Object.keys(CRYPTO_TICKERS).find((c) => new RegExp(`\\b${c}\\b`, "i").test(text));
      if (k) {
        data["ticker"] = CRYPTO_TICKERS[k]!;
        data["name"] = k.charAt(0).toUpperCase() + k.slice(1);
      } else {
        data["name"] = "Crypto";
      }
    } else {
      data["name"] = labelFrom(text, type);
      data["envelope"] = /cto/i.test(text) ? "CTO" : "PEA";
    }

    // Montant global sans quantité : « 5 000 € d'ETF Monde ».
    if (!qty && price === undefined && pru === undefined) {
      const total = firstAmount(text, nums, []);
      if (total) {
        data["quantity"] = 1;
        data[priceField] = total;
        summary.push(fmt.format(total));
      }
    }
  } else if (type === "av") {
    const uc = before(text, ["uc\\b", "unit[ée]s? de compte"]) ?? after(text, ["uc\\b"]);
    const fonds =
      before(text, ["fonds? €", "fonds? euros?"]) ??
      after(text, ["fonds? €", "fonds? euros?"]) ??
      firstAmount(text, nums, [uc]);
    if (fonds !== undefined) {
      data["fondsEurosAmount"] = fonds;
      summary.push(`fonds € ${fmt.format(fonds)}`);
    }
    if (uc !== undefined && uc !== fonds) {
      data["ucAmount"] = uc;
      summary.push(`UC ${fmt.format(uc)}`);
    }
    data["name"] = labelFrom(text, type);
  } else {
    const taux = after(text, ["taux"]);
    const amount = after(text, ["montant", "solde", "contient"]) ?? firstAmount(text, nums, [taux]);
    if (amount) {
      data["amount"] = amount;
      summary.push(fmt.format(amount));
    }
    if (taux !== undefined && type === "livret") {
      data["taux"] = taux;
      summary.push(`${taux} %`);
    }
    const label = labelFrom(text, type);
    data["name"] = label;
    if (type === "livret") data["type"] = label;
  }

  return { type, data, summary, incomplete: summary.length === 0 };
}
