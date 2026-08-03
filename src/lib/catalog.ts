export interface CatalogEntry {
  name: string;
  ticker: string;
  isin?: string;
  region: string;
  sector: string;
  currency: string;
  ter?: number;
  pea?: boolean;
  kind?: "etf" | "action" | "crypto";
  aliases?: string[];
}

export const CATALOG: CatalogEntry[] = [
  {
    name: "Amundi MSCI World UCITS ETF",
    ticker: "CW8.PA",
    isin: "LU1681043599",
    region: "Monde",
    sector: "ETF diversifié",
    currency: "EUR",
    ter: 0.38,
    pea: false,
    kind: "etf",
    aliases: ["world", "msci world", "cw8", "monde"],
  },
  {
    name: "Amundi PEA Monde MSCI World Acc",
    ticker: "PCEW.PA",
    isin: "LU2089238385",
    region: "Monde",
    sector: "ETF diversifié",
    currency: "EUR",
    ter: 0.2,
    pea: true,
    kind: "etf",
    aliases: ["world pea", "pcew", "monde", "msci world"],
  },
  {
    name: "Amundi PEA S&P 500 Acc",
    ticker: "PE500.PA",
    isin: "FR0013412020",
    region: "États-Unis",
    sector: "ETF actions US",
    currency: "EUR",
    ter: 0.15,
    pea: true,
    kind: "etf",
    aliases: ["sp500", "s&p 500", "usa", "pe500"],
  },
  {
    name: "Amundi PEA Nasdaq-100",
    ticker: "PANX.PA",
    isin: "FR0011871110",
    region: "États-Unis",
    sector: "ETF tech US",
    currency: "EUR",
    ter: 0.23,
    pea: true,
    kind: "etf",
    aliases: ["nasdaq", "tech", "panx"],
  },
  {
    name: "Amundi PEA Russell 2000",
    ticker: "PRUS.PA",
    isin: "FR0014003IY1",
    region: "États-Unis",
    sector: "ETF small caps",
    currency: "EUR",
    ter: 0.35,
    pea: true,
    kind: "etf",
    aliases: ["russell", "small caps", "prus"],
  },
  {
    name: "Amundi Stoxx Europe 600",
    ticker: "PCEU.PA",
    isin: "LU1681040223",
    region: "Europe",
    sector: "ETF actions Europe",
    currency: "EUR",
    ter: 0.07,
    pea: true,
    kind: "etf",
    aliases: ["europe", "stoxx", "pceu"],
  },
  {
    name: "BNP Easy Stoxx Europe 600 Cap.",
    ticker: "BNL.PA",
    isin: "FR0011550193",
    region: "Europe",
    sector: "ETF actions Europe",
    currency: "EUR",
    ter: 0.2,
    pea: true,
    kind: "etf",
    aliases: ["europe", "stoxx 600", "bnl", "bnp"],
  },
  {
    name: "Amundi PEA Émergent ESG Transition",
    ticker: "PAEEM.PA",
    isin: "LU2300295199",
    region: "Émergents",
    sector: "ETF actions émergents",
    currency: "EUR",
    ter: 0.3,
    pea: true,
    kind: "etf",
    aliases: ["emergent", "émergents", "chine", "paeem"],
  },
  {
    name: "iShares Diversified Commodity Swap",
    ticker: "CMSE.PA",
    isin: "IE00BDFL4P12",
    region: "Monde",
    sector: "Matières premières / commodities",
    currency: "EUR",
    ter: 0.19,
    pea: false,
    kind: "etf",
    aliases: ["commodities", "matieres premieres", "or", "cmse"],
  },
  {
    name: "Amundi Japan TOPIX",
    ticker: "PTPXE.PA",
    isin: "LU1681037948",
    region: "Japon",
    sector: "ETF actions Japon",
    currency: "EUR",
    ter: 0.2,
    pea: false,
    kind: "etf",
    aliases: ["japon", "topix", "nikkei"],
  },
  {
    name: "LVMH",
    ticker: "MC.PA",
    isin: "FR0000121014",
    region: "Europe",
    sector: "Luxe",
    currency: "EUR",
    pea: true,
    kind: "action",
    aliases: ["lvmh", "vuitton"],
  },
  {
    name: "TotalEnergies",
    ticker: "TTE.PA",
    isin: "FR0000120271",
    region: "Europe",
    sector: "Énergie",
    currency: "EUR",
    pea: true,
    kind: "action",
    aliases: ["total", "petrole"],
  },
  {
    name: "Airbus",
    ticker: "AIR.PA",
    isin: "NL0000235190",
    region: "Europe",
    sector: "Aéronautique",
    currency: "EUR",
    pea: true,
    kind: "action",
    aliases: ["airbus"],
  },
  {
    name: "Sanofi",
    ticker: "SAN.PA",
    isin: "FR0000120578",
    region: "Europe",
    sector: "Santé",
    currency: "EUR",
    pea: true,
    kind: "action",
    aliases: ["sanofi", "pharma"],
  },
  {
    name: "Apple Inc.",
    ticker: "AAPL",
    isin: "US0378331005",
    region: "États-Unis",
    sector: "Technologie",
    currency: "USD",
    pea: false,
    kind: "action",
    aliases: ["apple", "aapl"],
  },
  {
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    isin: "US67066G1040",
    region: "États-Unis",
    sector: "Semi-conducteurs",
    currency: "USD",
    pea: false,
    kind: "action",
    aliases: ["nvidia", "nvda"],
  },
  {
    name: "Microsoft Corporation",
    ticker: "MSFT",
    isin: "US5949181045",
    region: "États-Unis",
    sector: "Technologie",
    currency: "USD",
    pea: false,
    kind: "action",
    aliases: ["microsoft", "msft"],
  },
  {
    name: "Bitcoin",
    ticker: "BTC-EUR",
    region: "Monde",
    sector: "Crypto",
    currency: "EUR",
    kind: "crypto",
    aliases: ["btc", "bitcoin"],
  },
  {
    name: "Ethereum",
    ticker: "ETH-EUR",
    region: "Monde",
    sector: "Crypto",
    currency: "EUR",
    kind: "crypto",
    aliases: ["eth", "ethereum"],
  },
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function searchCatalog(query: string, kind?: "crypto" | "titre"): CatalogEntry[] {
  const q = normalize(query.trim());
  const pool = CATALOG.filter((e) =>
    kind === "crypto" ? e.kind === "crypto" : kind === "titre" ? e.kind !== "crypto" : true,
  );
  if (!q) return pool.slice(0, 8);
  return pool
    .map((e) => {
      const hay = [e.name, e.ticker, e.isin ?? "", ...(e.aliases ?? [])].map(normalize);
      const score = hay.some((h) => h.startsWith(q)) ? 0 : hay.some((h) => h.includes(q)) ? 1 : 2;
      return { e, score };
    })
    .filter((r) => r.score < 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map((r) => r.e);
}
