import { CATALOG, type CatalogEntry } from "./catalog";
import type { AssetType } from "./types";

/**
 * Analyse une phrase libre (tapée ou dictée) et en déduit une ligne
 * d'actif pré-remplie.
 *
 * Tout se fait localement, sans appel réseau : le parsing est
 * déterministe et explicable, et l'utilisateur relit toujours le
 * formulaire avant d'enregistrer.
 *
 * Exemples reconnus :
 *   « Livret A 22 700 »
 *   « 88 parts d'Amundi S&P 500 à 58,14, PRU 48,48 »
 *   « crédit immo, capital restant 90 896, mensualité 592 »
 *   « appartement estimé 250 000 loué 700 par mois »
 */

export interface ParsedAsset {
  type: AssetType;
  data: Record<string, string | number>;
  /** Ce que l'analyseur a compris, à afficher pour relecture. */
  summary: string[];
  /** true si aucun montant n'a été trouvé : le formulaire reste à compléter. */
  incomplete: boolean;
}

/** Convertit « 22 700,50 », « 22.700,50 », « 22700.5 » en nombre. */
function toNumber(raw: string): number {
  let s = raw.replace(/[\s\u00a0\u202f]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(",", ".");
  else if (hasDot && /\.\d{3}(\D|$)/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Tous les nombres du texte, dans l'ordre, avec leur position. */
function numbers(text: string): Array<{ value: number; index: number; raw: string }> {
  const out: Array<{ value: number; index: number; raw: string }> = [];
  const re = /\d[\d\s\u00a0\u202f.]*(?:[.,]\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = toNumber(m[0]);
    if (value > 0) out.push({ value, index: m.index, raw: m[0] });
  }
  return out;
}

/** Nombre suivant un mot-clé (« mensualité de 592 », « PRU 48,48 »). */
function after(text: string, keywords: string[]): number | undefined {
  for (const k of keywords) {
    const re = new RegExp(`${k}[^0-9]{0,18}(\\d[\\d\\s\\u00a0\\u202f.]*(?:[.,]\\d+)?)`, "i");
    const m = text.match(re);
    if (m?.[1]) {
      const v = toNumber(m[1]);
      if (v > 0) return v;
    }
  }
  return undefined;
}

const TYPE_HINTS: Array<{ type: AssetType; words: RegExp }> = [
  { type: "credit", words: /\b(cr[ée]dit|pr[êe]t|emprunt|dette)\b/i },
  { type: "livret", words: /\b(livret|ldds?|lep|pel|cel|codevi)\b/i },
  { type: "av", words: /\b(assurance[- ]?vie|av\b|per\b|contrat|fonds? €|fonds? euros?)\b/i },
  { type: "immo", words: /\b(appartement|maison|studio|immobilier|bien|scpi|t[1-5]\b|r[ée]sidence|locatif)\b/i },
  { type: "crypto", words: /\b(bitcoin|btc|ethereum|eth|solana|crypto|satoshi)\b/i },
  { type: "cash", words: /\b(compte[- ]courant|esp[èe]ces|cash|liquidit[ée]s?)\b/i },
  { type: "pea", words: /\b(pea|cto|etf|action|titre|bourse|part[s]?\b|msci|s&p|nasdaq|stoxx)\b/i },
];

/** Cherche un instrument du catalogue mentionné dans le texte. */
function findInstrument(text: string): CatalogEntry | undefined {
  const low = text.toLowerCase();
  let best: { entry: CatalogEntry; score: number } | undefined;
  for (const e of CATALOG) {
    const ticker = e.ticker.toLowerCase().replace(/\.pa$/, "");
    // Les tickers courts (AIR, SAN…) sont ambigus dans une phrase :
    // « action Air Liquide » ne doit pas matcher Airbus. On exige donc
    // au moins 4 caractères pour un ticker, et un mot entier partout.
    const candidates = [
      ...(ticker.length >= 4 ? [ticker] : []),
      ...(e.aliases ?? []).filter((a) => a.length >= 3),
      e.name.toLowerCase(),
    ];
    for (const c of candidates) {
      const re = new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(low) && (!best || c.length > best.score)) {
        best = { entry: e, score: c.length };
      }
    }
  }
  return best?.entry;
}

export function parseAssetText(input: string): ParsedAsset {
  const text = input.trim();
  const nums = numbers(text);
  const instrument = findInstrument(text);

  const hinted = TYPE_HINTS.find((h) => h.words.test(text))?.type;
  // Un mot-clé explicite (« assurance vie », « crédit ») prime toujours ;
  // l'instrument ne sert de repli que si rien n'est nommé.
  const type: AssetType =
    hinted ?? (instrument ? (instrument.kind === "crypto" ? "crypto" : "pea") : "autre");
  const useInstrument = instrument && (type === "pea" || type === "crypto");

  const data: Record<string, string | number> = {};
  const summary: string[] = [];

  if (useInstrument && instrument) {
    data["name"] = instrument.name;
    data["ticker"] = instrument.ticker;
    if (instrument.isin) data["isin"] = instrument.isin;
    data["region"] = instrument.region;
    data["sector"] = instrument.sector;
    data["currency"] = instrument.currency;
    if (instrument.pea) data["envelope"] = "PEA";
    summary.push(instrument.name);
  }

  // Le nom de l'instrument contient souvent des chiffres (« S&P 500 »,
  // « Stoxx 600 ») : on l'efface avant de chercher quantités et prix.
  const scrubbed = useInstrument && instrument
    ? [instrument.ticker.replace(/\.pa$/i, ""), ...(instrument.aliases ?? [])]
        .filter((a) => a.length >= 3)
        .reduce((acc, a) => acc.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " "), text)
    : text;

  const pick = (keys: string[]) => after(scrubbed, keys);

  if (type === "pea" || type === "crypto") {
    const qtyMatch = /(\d[\d\s.,]*)\s*(?:parts?|actions?|titres?|unit[ée]s?)/i.exec(scrubbed);
    const qty =
      pick(["quantit[ée]", "\\bx\\b"]) ??
      (qtyMatch ? toNumber(qtyMatch[1]!) : undefined);
    const pru = pick(["pru", "prix moyen", "prix d'achat", "achet[ée]e?s? [àa]"]);
    const price = pick(["cours", "prix actuel", "vaut", "cote", "[àa] "]);

    if (qty !== undefined) {
      data["quantity"] = qty;
      summary.push(`${qty} ${type === "crypto" ? "unités" : "parts"}`);
    }
    if (pru !== undefined) {
      data["pru"] = pru;
      summary.push(`PRU ${pru} €`);
    }
    const priceKey = type === "crypto" ? "prixUnitaire" : "currentPrice";
    if (price !== undefined && price !== pru) {
      data[priceKey] = price;
      summary.push(`cours ${price} €`);
    }
    // Deux nombres nus (« 88 à 58,14 ») : quantité puis prix.
    const bare = numbers(scrubbed);
    if (data["quantity"] === undefined && bare.length >= 2 && pru === undefined) {
      data["quantity"] = bare[0]!.value;
      data[priceKey] = bare[1]!.value;
      summary.push(`${bare[0]!.value} × ${bare[1]!.value} €`);
    }
  } else if (type === "credit") {
    const restant = pick(["capital restant", "restant d[uû]", "restant", "capital"]) ?? nums[0]?.value;
    const mensualite = pick(["mensualit[ée]", "par mois", "\\/mois", "[ée]ch[ée]ance"]);
    const taux = pick(["taux"]);
    if (restant !== undefined) {
      data["capitalRestant"] = restant;
      summary.push(`capital restant ${restant} €`);
    }
    if (mensualite !== undefined && mensualite !== restant) {
      data["mensualite"] = mensualite;
      summary.push(`${mensualite} €/mois`);
    }
    if (taux !== undefined && taux < 25) data["taux"] = taux;
  } else if (type === "immo") {
    const valeur = pick(["estim[ée]e?", "valeur", "vaut", "prix"]) ?? nums[0]?.value;
    const loyer = pick(["lou[ée]e?", "loyer", "par mois", "\\/mois"]);
    if (valeur !== undefined) {
      data["valeurEstimee"] = valeur;
      summary.push(`valeur ${valeur} €`);
    }
    if (loyer !== undefined && loyer !== valeur) {
      data["loyer"] = loyer;
      summary.push(`loyer ${loyer} €/mois`);
    }
  } else if (type === "av") {
    const fonds = pick(["fonds? €", "fonds? euros?", "s[ée]curis[ée]"]) ?? nums[0]?.value;
    const uc = pick(["uc", "unit[ée]s? de compte"]);
    if (fonds !== undefined) {
      data["fondsEurosAmount"] = fonds;
      summary.push(`fonds € ${fonds} €`);
    }
    if (uc !== undefined && uc !== fonds) {
      data["ucAmount"] = uc;
      summary.push(`UC ${uc} €`);
    }
  } else {
    const amount = pick(["montant", "solde", "\\bde\\b"]) ?? nums[0]?.value;
    if (amount !== undefined) {
      data["amount"] = amount;
      summary.push(`${amount} €`);
    }
    const taux = pick(["taux", "r[ée]mun[ée]r[ée]"]);
    if (taux !== undefined && taux < 25) data["taux"] = taux;
  }

  // Intitulé : à défaut d'instrument reconnu, on garde les mots du début.
  if (!data["name"]) {
    // On garde ce qui précède le premier montant : c'est presque toujours
    // l'intitulé (« Livret A 22 700 », « crédit immo, capital restant … »).
    const head = (nums[0] ? text.slice(0, nums[0].index) : text)
      .replace(/^(j'ai|jai|il me reste|ajoute[rz]?|mon|ma|mes)\s+/i, "")
      .replace(/^(une?|des|le|la|les|du|de la)\s+/i, "")
      // Retire le verbe introducteur du montant : « maison qui vaut … ».
      .replace(/\s*\b(qui\s+)?(vaut|vaux|coûte|coute|fait|est|s'?[ée]l[èe]ve|estim[ée]e?\s*à?)\b.*$/i, "")
      .replace(/[,;:]\s*$/, "")
      .replace(/\s*\b(capital restant|restant d[uû]|montant|solde|valeur|estim[ée]e?|de|d'|à|a|environ|pour|avec)\b\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (head) {
      const known =
        /\blivret\s*a\b/i.test(text) ? "Livret A"
        : /\bldds?\b/i.test(text) ? "LDDS"
        : /\blep\b/i.test(text) ? "LEP"
        : /\bpel\b/i.test(text) ? "PEL"
        : /\b(maison|appartement|appart|studio|villa|terrain)\b/i.test(text)
          ? text.match(/\b(maison|appartement|appart|studio|villa|terrain)\b/i)![1]!.replace(/^./, (c) => c.toUpperCase())
        : /\b(pr[êe]t|cr[ée]dit|emprunt)\b/i.test(text)
          ? (/immo/i.test(text) ? "Crédit immobilier" : "Crédit")
        : undefined;
      const clean = known ?? head.charAt(0).toUpperCase() + head.slice(1);
      if (type === "livret" || type === "immo" || type === "credit") data["type"] = clean;
      data["name"] = clean;
      summary.unshift(clean);
    }
  }

  return {
    type,
    data,
    summary,
    incomplete: !nums.length,
  };
}
