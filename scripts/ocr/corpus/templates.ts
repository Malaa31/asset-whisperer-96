import type { CaptureSource } from "../../../src/lib/ocr/expected";
import {
  frNumber,
  frQuantity,
  type GeneratedPortfolio,
  type GeneratedSavings,
  type Rng,
} from "./data";

/**
 * Gabarits HTML qui reproduisent la mise en page des applis (colonnes, formats, ordre des champs),
 * sans logo ni marque graphique. Chaque bloc de position porte data-pos, le total data-total :
 * le générateur s'en sert pour savoir ce qui est réellement visible sur la capture.
 */

export interface TemplateOptions {
  dark: boolean;
  statusBar: boolean;
  random: Rng;
}

export interface RenderedTemplate {
  html: string;
  kind: "positions" | "livret";
  enveloppe: "PEA" | "CTO" | null;
  libelle: string | null;
  /** Champs affichés par ce gabarit (les autres valent null dans la réponse attendue). */
  shows: { isin: boolean; quantite: boolean; pru: boolean; valorisation: boolean; total: boolean };
  /** Nom affiché pour chaque position (dans l'ordre de data-pos). */
  names: string[];
}

const NNBSP = " ";

function page(body: string, css: string, font: string, background: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${background};font-family:${font};-webkit-font-smoothing:antialiased}
.statusbar{height:47px;display:flex;align-items:center;justify-content:space-between;padding:0 28px 0 34px;font:600 16px/1 "Inter",sans-serif}
.statusbar .icons{display:flex;gap:6px;align-items:center;font-size:13px}
.battery{display:inline-block;width:25px;height:12px;border:1.5px solid currentColor;border-radius:4px;position:relative;font-size:9px;text-align:center;line-height:9px}
${css}
</style></head><body>${body}</body></html>`;
}

function statusBar(options: TemplateOptions, color: string): string {
  if (!options.statusBar) return "";
  const hour = `${options.random.int(7, 23)}:${String(options.random.int(0, 59)).padStart(2, "0")}`;
  const battery = options.random.int(8, 99);
  return `<div class="statusbar" style="color:${color}"><span>${hour}</span><span class="icons">▂▄▆ <span>◠</span> <span class="battery">${battery}</span></span></div>`;
}

function tabBar(labels: string[], fg: string, bg: string, active: string): string {
  const icons = ["⌂", "⇄", "☰", "▤", "≡"];
  return `<div data-tabbar style="position:fixed;left:0;right:0;bottom:0;height:84px;background:${bg};border-top:1px solid rgba(127,127,127,.18);display:flex;justify-content:space-around;padding-top:10px">
${labels.map((label, index) => `<div style="text-align:center;font:500 12px/1.4 inherit;color:${index === 0 ? active : fg}"><div style="font-size:22px">${icons[index] ?? "•"}</div>${label}</div>`).join("")}
</div>`;
}

const pctSign = (value: number) => (value >= 0 ? "+" : "");

// ---------------------------------------------------------------------------------
// Boursorama (appli) : cartes, nom sur plusieurs lignes, montant à droite,
// « cours  variation % », « PRU / quantité », plus-value dans un badge.
// ---------------------------------------------------------------------------------
function boursorama(portfolio: GeneratedPortfolio, options: TemplateOptions): RenderedTemplate {
  const dark = options.dark;
  const c = dark
    ? {
        bg: "#0d1422",
        card: "#162036",
        text: "#e8edf7",
        sub: "#9fb3d6",
        head: "linear-gradient(90deg,#1b2b4b,#22406b)",
        grey: "#0d1422",
      }
    : {
        bg: "#f1f5fa",
        card: "#ffffff",
        text: "#1b2a4e",
        sub: "#3b5a8a",
        head: "linear-gradient(90deg,#f7e9ef,#bcd9ec 40%,#bcd9ec)",
        grey: "#f1f5fa",
      };
  const thousands = NNBSP;
  const rows = portfolio.positions
    .map((position, index) => {
      const up = position.plusValue >= 0;
      const pv = `${up ? "↗" : "↘"} ${frNumber(position.plusValue, 2, thousands)} €`;
      return `<div class="pos" data-pos="${index}">
  <div class="left">
    <div class="name">${position.instrument.name}</div>
    <div class="l2"><span>${frNumber(position.cours, 2, thousands)} €</span> <span class="pct ${position.variationJour >= 0 ? "up" : "down"}">${pctSign(position.variationJour)}${frNumber(position.variationJour)}<sup>%</sup></span></div>
    <div class="l3">${frNumber(position.pru, 2, thousands)} € / ${frQuantity(position.quantite, thousands)}</div>
  </div>
  <div class="right"><div class="amt">${frNumber(position.valorisation, 2, thousands)} € <span class="chev">›</span></div><div class="badge ${up ? "up" : "down"}">${pv}</div></div>
</div>`;
    })
    .join("");
  const css = `
.hdr{background:${c.head};padding:0 18px 22px}
.hdr .bar{display:flex;align-items:center;justify-content:space-between;height:70px}
.circle{width:52px;height:52px;border-radius:50%;background:${dark ? "#26375a" : "#fff"};display:flex;align-items:center;justify-content:center;font-size:30px;color:${dark ? "#cfe0ff" : "#1d4ea0"}}
.total{font:700 25px/1 "DM Sans",sans-serif;color:${c.text}}
.cols{display:flex;justify-content:space-between;padding:16px 16px 10px;color:${c.sub};font-size:15px;line-height:1.55}
.card{margin:0 16px 120px;background:${c.card};border-radius:14px;border-left:5px solid #1a8a3c;padding:4px 0}
.pos{display:flex;justify-content:space-between;padding:18px 16px 18px 18px}
.name{font-size:17px;line-height:1.35;color:${c.text};max-width:225px;text-transform:uppercase}
.l2,.l3{font-size:16px;color:${c.sub};margin-top:6px}
.pct.up{color:#1a8a3c}.pct.down{color:#c0182c}
sup{font-size:10px}
.right{text-align:right;min-width:120px;display:flex;flex-direction:column;justify-content:center;gap:12px}
.amt{font-size:18px;font-weight:600;color:${c.text};white-space:nowrap}
.chev{font-size:24px;margin-left:10px}
.badge{display:inline-block;align-self:flex-end;padding:4px 9px;border-radius:7px;font-weight:600;font-size:16px;white-space:nowrap}
.badge.up{background:${dark ? "#173d26" : "#dff3e4"};color:${dark ? "#5fd388" : "#138a36"}}
.badge.down{background:${dark ? "#4a1b22" : "#fde3e6"};color:${dark ? "#ff7a88" : "#c0182c"}}`;
  const body = `<div class="hdr">${statusBar(options, c.text)}<div class="bar"><div class="circle">‹</div><div class="total" data-total>${frNumber(portfolio.total, 2, thousands)} €</div><div class="circle">•••</div></div></div>
<div class="cols"><div>Valeur<br>Cours<br>Px. revient / Quantité</div><div style="text-align:right">Montant<br>+/- latentes (€)</div></div>
<div class="card">${rows}</div>
${tabBar(["Comptes", "Ordres", "Listes", "Marchés", "Menu"], c.sub, dark ? "#0d1422" : "#ffffff", "#1d4ea0")}`;
  return {
    html: page(body, css, `"DM Sans","Inter",sans-serif`, c.bg),
    kind: "positions",
    enveloppe: portfolio.enveloppe,
    libelle: null,
    shows: { isin: false, quantite: true, pru: true, valorisation: true, total: true },
    names: portfolio.positions.map((position) => position.instrument.name),
  };
}

// ---------------------------------------------------------------------------------
// Trade Republic : liste sobre, nom court, « x titres », valeur et performance à droite.
// Pas de PRU dans la liste.
// ---------------------------------------------------------------------------------
function tradeRepublic(portfolio: GeneratedPortfolio, options: TemplateOptions): RenderedTemplate {
  const dark = options.dark;
  const c = dark
    ? { bg: "#000", text: "#fff", sub: "#8e8e93", line: "#1c1c1e" }
    : { bg: "#fff", text: "#000", sub: "#6e6e73", line: "#ececf0" };
  const gain = portfolio.positions.reduce((sum, position) => sum + position.plusValue, 0);
  const rows = portfolio.positions
    .map((position, index) => {
      const perf =
        (position.plusValue / Math.max(0.01, position.valorisation - position.plusValue)) * 100;
      const initials = position.instrument.short
        .replace(/[^A-Za-z]/g, "")
        .slice(0, 2)
        .toUpperCase();
      const unit = position.quantite === 1 ? "titre" : "titres";
      return `<div class="row" data-pos="${index}"><div class="logo">${initials}</div><div class="mid"><div class="name">${position.instrument.short}</div><div class="sub">${frQuantity(position.quantite)} ${unit}</div></div><div class="end"><div class="val">${frNumber(position.valorisation)} €</div><div class="perf ${perf >= 0 ? "up" : "down"}">${perf >= 0 ? "▲" : "▼"} ${frNumber(Math.abs(perf))} %</div></div></div>`;
    })
    .join("");
  const css = `
.top{padding:14px 20px 6px}.label{color:${c.sub};font-size:15px}
.total{font:600 36px/1.2 "Inter",sans-serif;color:${c.text};margin-top:4px}
.gain{font-size:15px;margin-top:4px}.up{color:#2ec27e}.down{color:#ff453a}
.chips{display:flex;gap:18px;padding:16px 20px;color:${c.sub};font-size:14px}.chips b{color:${c.text}}
h2{font:600 21px/1 "Inter",sans-serif;color:${c.text};padding:18px 20px 6px;display:flex;justify-content:space-between}
h2 span{font:400 14px "Inter";color:${c.sub}}
.row{display:flex;align-items:center;padding:13px 20px;border-bottom:1px solid ${c.line}}
.logo{width:42px;height:42px;border-radius:50%;background:${dark ? "#2c2c2e" : "#e5e5ea"};color:${c.sub};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;margin-right:14px;flex:none}
.mid{flex:1;min-width:0}.name{color:${c.text};font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{color:${c.sub};font-size:14px;margin-top:3px}
.end{text-align:right;margin-left:10px}.val{color:${c.text};font-size:16px;white-space:nowrap}.perf{font-size:14px;margin-top:3px;white-space:nowrap}`;
  const body = `${statusBar(options, c.text)}<div class="top"><div class="label">Portefeuille</div><div class="total" data-total>${frNumber(portfolio.total)} €</div><div class="gain ${gain >= 0 ? "up" : "down"}">${gain >= 0 ? "▲" : "▼"} ${frNumber(Math.abs(gain))} € · Depuis le début</div></div>
<div class="chips"><b>1J</b><span>1S</span><span>1M</span><span>1A</span><span>Max</span></div>
<h2>Investissements <span>Trier : valeur ⌄</span></h2>${rows}
${tabBar(["Accueil", "Recherche", "Transferts", "Profil"], c.sub, c.bg, c.text)}`;
  return {
    html: page(body, css, `"Inter",sans-serif`, c.bg),
    kind: "positions",
    enveloppe: portfolio.enveloppe,
    libelle: null,
    shows: { isin: false, quantite: true, pru: false, valorisation: true, total: true },
    names: portfolio.positions.map((position) => position.instrument.short),
  };
}

// ---------------------------------------------------------------------------------
// Fortuneo : cartes avec ISIN, grille Quantité / PRU / Cours / Valorisation.
// ---------------------------------------------------------------------------------
function fortuneo(portfolio: GeneratedPortfolio, options: TemplateOptions): RenderedTemplate {
  const dark = options.dark;
  const c = dark
    ? { bg: "#111517", card: "#1b2226", text: "#eef3f4", sub: "#93a4aa", head: "#0b5d57" }
    : { bg: "#f2f5f6", card: "#fff", text: "#1d2a2f", sub: "#6b7b81", head: "#00857c" };
  const rows = portfolio.positions
    .map((position, index) => {
      const up = position.plusValue >= 0;
      const pct =
        (position.plusValue / Math.max(0.01, position.valorisation - position.plusValue)) * 100;
      return `<div class="pos" data-pos="${index}"><div class="name">${position.instrument.short}</div><div class="isin">${position.instrument.isin}</div>
<div class="grid"><div><span>Quantité</span><b>${frQuantity(position.quantite, " ")}</b></div><div><span>PRU</span><b>${frNumber(position.pru, 2, " ")} €</b></div><div><span>Cours</span><b>${frNumber(position.cours, 2, " ")} €</b></div><div><span>Valorisation</span><b>${frNumber(position.valorisation, 2, " ")} €</b></div></div>
<div class="pv ${up ? "up" : "down"}">+/- value latente : ${up ? "+" : ""}${frNumber(position.plusValue, 2, " ")} € (${up ? "+" : ""}${frNumber(pct)} %)</div></div>`;
    })
    .join("");
  const css = `
.head{background:${c.head};color:#fff;padding:0 18px 20px}.head h1{font:600 20px/1 "Open Sans",sans-serif;padding:14px 0 16px}
.head .lab{opacity:.85;font-size:14px}.head .tot{font:700 28px/1.3 "Open Sans",sans-serif}
h3{font:600 16px "Open Sans";color:${c.text};padding:18px 18px 8px}
.pos{background:${c.card};margin:0 14px 12px;border-radius:10px;padding:14px 16px}
.name{font:600 16px/1.3 "Open Sans";color:${c.text}}.isin{font-size:12px;color:${c.sub};margin-top:2px;letter-spacing:.3px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin-top:12px}
.grid span{display:block;font-size:12px;color:${c.sub}}.grid b{font-size:15px;color:${c.text};font-weight:600}
.pv{font-size:13px;margin-top:10px}.up{color:#11875d}.down{color:#d0312d}`;
  const body = `<div class="head">${statusBar(options, "#fff")}<h1>${portfolio.enveloppe === "PEA" ? "PEA" : "Compte titres"}</h1><div class="lab">Valorisation totale</div><div class="tot" data-total>${frNumber(portfolio.total, 2, " ")} €</div></div>
<h3>Mes positions</h3>${rows}<div style="height:110px"></div>
${tabBar(["Comptes", "Bourse", "Virements", "Plus"], c.sub, c.card, c.head)}`;
  return {
    html: page(body, css, `"Open Sans",sans-serif`, c.bg),
    kind: "positions",
    enveloppe: portfolio.enveloppe,
    libelle: null,
    shows: { isin: true, quantite: true, pru: true, valorisation: true, total: true },
    names: portfolio.positions.map((position) => position.instrument.short),
  };
}

// ---------------------------------------------------------------------------------
// Bourse Direct : tableau dense façon site web, noms tronqués, ISIN sous le nom,
// lignes de total en bas.
// ---------------------------------------------------------------------------------
function bourseDirect(portfolio: GeneratedPortfolio, options: TemplateOptions): RenderedTemplate {
  const truncate = (name: string) => (name.length > 24 ? `${name.slice(0, 22)}...` : name);
  const rows = portfolio.positions
    .map((position, index) => {
      const up = position.plusValue >= 0;
      return `<tr data-pos="${index}"><td class="n">${truncate(position.instrument.name)}<div class="isin">${position.instrument.isin}</div></td><td>${frQuantity(position.quantite, " ")}</td><td>${frNumber(position.pru, 3, " ")}</td><td>${frNumber(position.cours, 3, " ")}</td><td>${frNumber(position.valorisation, 2, " ")}</td><td class="${up ? "up" : "down"}">${frNumber(position.plusValue, 2, " ")}</td></tr>`;
    })
    .join("");
  const titres = portfolio.total - portfolio.especes;
  const css = `
.top{background:#003d7a;color:#fff;padding:10px 12px;font:700 15px "Liberation Sans",Arial,sans-serif;display:flex;justify-content:space-between}
.sub{padding:10px 12px;font:13px "Liberation Sans";color:#333}
table{width:100%;border-collapse:collapse;font:11.5px/1.25 "Liberation Sans",Arial,sans-serif;color:#1f1f1f}
th{background:#e6ebf1;color:#2d3e50;font-weight:700;padding:7px 4px;text-align:right;border-bottom:1px solid #c9d2dc}
th:first-child,td.n{text-align:left}
td{padding:7px 4px;text-align:right;border-bottom:1px solid #e3e7ec;vertical-align:top;white-space:nowrap}
td.n{white-space:normal;max-width:120px;font-weight:700}.isin{font-weight:400;font-size:10px;color:#666;margin-top:2px}
.up{color:#0a7a2f}.down{color:#c4161c}
.foot td{font-weight:700;background:#f4f6f9}`;
  const body = `${statusBar(options, "#111")}<div class="top"><span>Portefeuille ${portfolio.enveloppe}</span><span>EUR</span></div>
<div class="sub">Positions au comptant · cours différés</div>
<table><thead><tr><th>Valeur</th><th>Qté</th><th>PRU</th><th>Cours</th><th>Valo.</th><th>+/- val.</th></tr></thead><tbody>${rows}
<tr class="foot"><td class="n" colspan="4">Total titres</td><td colspan="2">${frNumber(titres, 2, " ")}</td></tr>
<tr class="foot"><td class="n" colspan="4">Espèces</td><td colspan="2">${frNumber(portfolio.especes, 2, " ")}</td></tr>
<tr class="foot"><td class="n" colspan="4">Valorisation totale</td><td colspan="2" data-total>${frNumber(portfolio.total, 2, " ")}</td></tr></tbody></table>`;
  return {
    html: page(body, css, `"Liberation Sans",Arial,sans-serif`, "#ffffff"),
    kind: "positions",
    enveloppe: portfolio.enveloppe,
    libelle: null,
    shows: { isin: true, quantite: true, pru: true, valorisation: true, total: true },
    names: portfolio.positions.map((position) => truncate(position.instrument.name)),
  };
}

// ---------------------------------------------------------------------------------
// Degiro : noms longs en capitales, ticker et place, montants suffixés « EUR ».
// Pas de PRU dans la liste.
// ---------------------------------------------------------------------------------
function degiro(portfolio: GeneratedPortfolio, options: TemplateOptions): RenderedTemplate {
  const dark = options.dark;
  const c = dark
    ? { bg: "#121212", card: "#1e1e1e", text: "#f2f2f2", sub: "#9aa0a6" }
    : { bg: "#f5f6f7", card: "#fff", text: "#202124", sub: "#5f6368" };
  const exchanges = ["EPA", "EAM", "XET", "NDQ", "NSY", "MIL"];
  const rows = portfolio.positions
    .map((position, index) => {
      const up = position.plusValue >= 0;
      const exchange = options.random.pick(exchanges);
      return `<div class="pos" data-pos="${index}"><div class="line"><div class="name">${position.instrument.name}</div><div class="val">${frNumber(position.valorisation, 2, " ")} EUR</div></div>
<div class="tick">${position.instrument.ticker} · ${exchange}</div>
<div class="meta"><span>Qté ${frQuantity(position.quantite, " ")}</span><span>Prix ${frNumber(position.cours, 2, " ")}</span><span class="${up ? "up" : "down"}">P/L ${up ? "+" : ""}${frNumber(position.plusValue, 2, " ")} EUR</span></div></div>`;
    })
    .join("");
  const css = `
h1{font:500 22px "Roboto",sans-serif;color:${c.text};padding:14px 18px 4px}
.tl{color:${c.sub};font-size:14px;padding:0 18px}.tv{font:500 30px/1.3 "Roboto";color:${c.text};padding:2px 18px 16px}
.pos{background:${c.card};margin:0 12px 1px;padding:14px 14px}
.line{display:flex;justify-content:space-between;gap:12px}.name{font:500 15px/1.3 "Roboto";color:${c.text};text-transform:uppercase}
.val{font:500 15px "Roboto";color:${c.text};white-space:nowrap}
.tick{font-size:13px;color:${c.sub};margin-top:3px}
.meta{display:flex;gap:14px;font-size:13px;color:${c.sub};margin-top:8px;flex-wrap:wrap}.up{color:#1e8e3e}.down{color:#d93025}`;
  const body = `${statusBar(options, c.text)}<h1>Portefeuille</h1><div class="tl">Valeur totale</div><div class="tv" data-total>${frNumber(portfolio.total, 2, " ")} EUR</div>${rows}<div style="height:110px"></div>
${tabBar(["Tableau de bord", "Portefeuille", "Rechercher", "Ordres", "Plus"], c.sub, c.card, "#1a73e8")}`;
  return {
    html: page(body, css, `"Roboto",sans-serif`, c.bg),
    kind: "positions",
    enveloppe: portfolio.enveloppe,
    libelle: null,
    shows: { isin: false, quantite: true, pru: false, valorisation: true, total: true },
    names: portfolio.positions.map((position) => position.instrument.name),
  };
}

// ---------------------------------------------------------------------------------
// Crédit Agricole : fiche du Livret A (solde, taux, plafond, opérations récentes)
// ou liste des comptes d'épargne.
// ---------------------------------------------------------------------------------
function creditAgricole(
  savings: GeneratedSavings,
  others: GeneratedSavings[],
  options: TemplateOptions,
  list: boolean,
): RenderedTemplate {
  const dark = options.dark;
  const c = dark
    ? { bg: "#0f1714", card: "#18231f", text: "#eef5f2", sub: "#9db3aa", head: "#0b5c48" }
    : { bg: "#f3f6f5", card: "#fff", text: "#1c2b26", sub: "#5d7169", head: "#007a5e" };
  const css = `
.head{background:${c.head};color:#fff;padding:0 18px 22px}.head h1{font:600 21px/1.2 "Fira Sans",sans-serif;padding:12px 0 6px}
.num{opacity:.85;font-size:13px}.lab{opacity:.85;font-size:14px;margin-top:14px}.solde{font:600 32px/1.3 "Fira Sans"}
.box{background:${c.card};margin:14px;border-radius:12px;padding:6px 16px}
.kv{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(127,127,127,.15);font-size:15px;color:${c.text}}.kv span{color:${c.sub}}
h3{font:600 16px "Fira Sans";color:${c.text};padding:6px 18px}
.op{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(127,127,127,.15);font-size:14px;color:${c.text}}.op small{display:block;color:${c.sub};font-size:12px}
.acc{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid rgba(127,127,127,.15);color:${c.text}}.acc small{display:block;color:${c.sub};font-size:12px;margin-top:2px}.acc b{font-size:16px;font-weight:600;white-space:nowrap}`;
  let body: string;
  if (list) {
    const accounts = options.random.shuffle([savings, ...others]);
    const courant = Math.round(options.random.between(80, 6000) * 100) / 100;
    body = `${statusBar(options, c.text)}<div style="padding:14px 18px 4px;font:600 22px 'Fira Sans';color:${c.text}">Mes comptes</div>
<h3>Comptes courants</h3><div class="box"><div class="acc"><div>Compte de dépôt<small>N° •••• ${options.random.int(1000, 9999)}</small></div><b>${frNumber(courant)} €</b></div></div>
<h3>Épargne disponible</h3><div class="box">${accounts
      .map(
        (account) =>
          `<div class="acc"${account === savings ? " data-total data-libelle" : ""}><div>${account.libelle}<small>N° •••• ${account.numero.slice(-4)}</small></div><b>${frNumber(account.solde)} €</b></div>`,
      )
      .join(
        "",
      )}</div>${tabBar(["Accueil", "Comptes", "Virements", "Conseiller", "Plus"], c.sub, c.card, c.head)}`;
  } else {
    body = `<div class="head">${statusBar(options, "#fff")}<h1 data-libelle>${savings.libelle}</h1><div class="num">N° ${savings.numero}</div><div class="lab">Solde au 23/11/2026</div><div class="solde" data-total>${frNumber(savings.solde)} €</div></div>
<div class="box"><div class="kv"><span>Taux de rémunération</span>${frNumber(savings.taux)} %</div><div class="kv"><span>Plafond réglementaire</span>${frNumber(savings.plafond)} €</div><div class="kv"><span>Intérêts acquis</span>${frNumber(savings.interets)} €</div></div>
<h3>Dernières opérations</h3><div class="box">${savings.operations.map((op) => `<div class="op"><div>${op.label}<small>${op.date}</small></div><div>${op.amount >= 0 ? "+" : ""}${frNumber(op.amount)} €</div></div>`).join("")}</div>
${tabBar(["Accueil", "Comptes", "Virements", "Conseiller", "Plus"], c.sub, c.card, c.head)}`;
  }
  return {
    html: page(body, css, `"Fira Sans","Source Sans 3",sans-serif`, c.bg),
    kind: "livret",
    enveloppe: null,
    libelle: savings.libelle,
    shows: { isin: false, quantite: false, pru: false, valorisation: false, total: true },
    names: [],
  };
}

export interface TemplateInput {
  portfolio?: GeneratedPortfolio;
  savings?: GeneratedSavings;
  otherSavings?: GeneratedSavings[];
  list?: boolean;
}

export function renderTemplate(
  source: CaptureSource,
  input: TemplateInput,
  options: TemplateOptions,
): RenderedTemplate {
  switch (source) {
    case "boursorama":
      return boursorama(input.portfolio!, options);
    case "trade-republic":
      return tradeRepublic(input.portfolio!, options);
    case "fortuneo":
      return fortuneo(input.portfolio!, options);
    case "bourse-direct":
      return bourseDirect(input.portfolio!, options);
    case "degiro":
      return degiro(input.portfolio!, options);
    case "credit-agricole":
      return creditAgricole(input.savings!, input.otherSavings ?? [], options, Boolean(input.list));
    default:
      throw new Error(`Pas de gabarit pour ${source}`);
  }
}
