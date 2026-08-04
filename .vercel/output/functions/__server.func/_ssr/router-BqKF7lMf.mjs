import { i as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react, t as QueryClientProvider } from "../_libs/react+tanstack__react-query.mjs";
import { _ as useRouter, c as HeadContent, d as Outlet, f as lazyRouteComponent, h as Link, m as createRootRouteWithContext, p as createFileRoute, s as Scripts, u as createRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { A as ChevronDown, E as CreditCard, F as Banknote, I as ArrowRight, L as ArrowLeft, N as Bitcoin, O as ChevronUp, S as House, _ as Package, b as Landmark, c as Square, d as Search, h as PiggyBank, i as Upload, k as ChevronRight, l as Sparkles, m as Plus, n as Wallet, o as Trash2, p as RefreshCw, r as User, t as X, u as ShieldCheck, v as Mic, y as LoaderCircle } from "../_libs/lucide-react.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/types-Ve2GXR07.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var KEY_PROFILE = "patrimoine.profile";
var KEY_ASSETS = "patrimoine.assets";
var KEY_HISTORY = "patrimoine.history";
var storage = {
	get(key) {
		if (typeof window === "undefined") return null;
		try {
			const raw = window.localStorage.getItem(key);
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	},
	set(key, value) {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(key, JSON.stringify(value));
	},
	remove(key) {
		if (typeof window === "undefined") return;
		window.localStorage.removeItem(key);
	}
};
var KEYS = {
	profile: KEY_PROFILE,
	assets: KEY_ASSETS,
	history: KEY_HISTORY
};
function uid() {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
var AppContext = (0, import_react.createContext)(null);
function useApp() {
	const ctx = (0, import_react.useContext)(AppContext);
	if (!ctx) throw new Error("useApp must be used within AppProvider");
	return ctx;
}
/** Demande l'ouverture du modal d'ajout, monté dans la racine. */
var ADD_ASSET_EVENT = "patrimoine:add-asset";
function requestAddAsset() {
	window.dispatchEvent(new Event(ADD_ASSET_EVENT));
}
var nbsp = " ";
var masked = false;
function setAmountMasking(on) {
	masked = on;
}
function eur(value, decimals = 0) {
	if (masked) return `\u2022\u2022\u2022\u2022\u2022${nbsp}\u20ac`;
	const rounded = Number.isFinite(value) ? value : 0;
	const s = Math.abs(rounded).toFixed(decimals).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, nbsp);
	return `${rounded < 0 ? "−" : ""}${s}${nbsp}€`;
}
function signedEur(value) {
	if (masked) return eur(0);
	return `${value >= 0 ? "+" : "−"}${eur(Math.abs(value))}`;
}
function pct(value, decimals = 1) {
	const s = Math.abs(value).toFixed(decimals).replace(".", ",");
	return `${value >= 0 ? "+" : "−"}${s}${nbsp}%`;
}
function rawPct(value, decimals = 1) {
	return `${value.toFixed(decimals).replace(".", ",")}${nbsp}%`;
}
function num(value, decimals = 2) {
	return value.toFixed(decimals).replace(".", ",");
}
function sinceLabel(iso) {
	if (!iso) return "jamais actualisé";
	const min = Math.round((Date.now() - new Date(iso).getTime()) / 6e4);
	if (min < 1) return "à l'instant";
	if (min < 60) return `il y a ${min} min`;
	const h = Math.round(min / 60);
	if (h < 24) return `il y a ${h} h`;
	return `il y a ${Math.round(h / 24)} j`;
}
var TYPE_LABELS = {
	pea: "Bourse",
	av: "Assurance vie",
	livret: "Livret",
	immo: "Immobilier",
	crypto: "Crypto",
	cash: "Cash",
	autre: "Autre",
	credit: "Crédit"
};
var TARGET_ALLOCATIONS = {
	prudent: {
		actions: 25,
		obligations: 50,
		immo: 15,
		cash: 10
	},
	equilibre: {
		actions: 50,
		obligations: 30,
		immo: 15,
		cash: 5
	},
	dynamique: {
		actions: 70,
		obligations: 10,
		immo: 15,
		cash: 5
	},
	offensif: {
		actions: 85,
		obligations: 5,
		immo: 10,
		cash: 0
	}
};
var RISK_LABELS = {
	prudent: "Prudent",
	equilibre: "Équilibré",
	dynamique: "Dynamique",
	offensif: "Offensif"
};
var INCOME_KIND_LABELS = {
	salaire: "Salaire",
	locatif: "Locatif",
	dividendes: "Dividendes",
	autre: "Autre"
};
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/market-sDnrb2H-.js
function n(v) {
	const x = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
	return Number.isFinite(x) ? x : 0;
}
function assetValue(a) {
	const d = a.data;
	switch (a.type) {
		case "pea": return n(d["quantity"]) * (n(d["currentPrice"]) || n(d["pru"]));
		case "av": return n(d["fondsEurosAmount"]) + n(d["ucAmount"]);
		case "immo": return n(d["valeurEstimee"]);
		case "crypto": return n(d["quantity"]) * n(d["prixUnitaire"]);
		case "credit": return -n(d["capitalRestant"]);
		default: return n(d["amount"]);
	}
}
function assetGain(a) {
	if (a.type !== "pea") return 0;
	const cp = n(a.data["currentPrice"]);
	if (!cp) return 0;
	return n(a.data["quantity"]) * (cp - n(a.data["pru"]));
}
function totals(assets) {
	let actifs = 0;
	let dettes = 0;
	let gain = 0;
	for (const a of assets) {
		const v = assetValue(a);
		if (a.type === "credit") dettes += Math.abs(v);
		else actifs += v;
		gain += assetGain(a);
	}
	return {
		actifs,
		dettes,
		gain,
		net: actifs - dettes
	};
}
var REGION_BUCKETS = [
	"États-Unis",
	"Europe",
	"Émergents",
	"Japon",
	"Autres dév.",
	"Commodities",
	"Fonds €"
];
var WORLD_SPLIT = [
	["États-Unis", .71],
	["Europe", .185],
	["Japon", .06],
	["Autres dév.", .045]
];
function lookThrough(assets) {
	const out = Object.fromEntries(REGION_BUCKETS.map((r) => [r, 0]));
	for (const a of assets) {
		const v = assetValue(a);
		if (a.type === "av") {
			out["Fonds €"] += n(a.data["fondsEurosAmount"]);
			const uc = n(a.data["ucAmount"]);
			for (const [r, w] of WORLD_SPLIT) out[r] += uc * w;
			continue;
		}
		if (a.type !== "pea") continue;
		const sector = String(a.data["sector"] ?? "").toLowerCase();
		if (/matière|matiere|commodit|mine|or\b/.test(sector)) {
			out["Commodities"] += v;
			continue;
		}
		const region = String(a.data["region"] ?? "Monde");
		if (region === "Monde") for (const [r, w] of WORLD_SPLIT) out[r] += v * w;
		else if (region === "États-Unis") out["États-Unis"] += v;
		else if (region === "Europe") out["Europe"] += v;
		else if (region === "Émergents") out["Émergents"] += v;
		else if (region === "Japon") out["Japon"] += v;
		else out["Autres dév."] += v;
	}
	return out;
}
/** Valeur positive par classe d'actif (les crédits sont exclus). */
function allocationByType(assets) {
	const map = /* @__PURE__ */ new Map();
	for (const a of assets) {
		if (a.type === "credit") continue;
		const v = assetValue(a);
		if (v <= 0) continue;
		map.set(a.type, (map.get(a.type) ?? 0) + v);
	}
	return [...map.entries()].map(([type, value]) => ({
		type,
		value
	})).sort((a, b) => b.value - a.value);
}
/** Indice de Herfindahl-Hirschman normalisé → score 0-100 (100 = réparti à parts égales sur N cases). */
function hhiScore(values, bucketCount) {
	const total = values.reduce((s, v) => s + v, 0);
	if (total <= 0 || bucketCount < 2) return 0;
	const hhi = values.reduce((s, v) => s + (v / total) ** 2, 0);
	const min = 1 / bucketCount;
	return Math.round(Math.max(0, Math.min(1, 1 - (hhi - min) / (1 - min))) * 100);
}
function diversificationScore(assets) {
	const classes = hhiScore(allocationByType(assets).map((x) => x.value), 6);
	const lt = lookThrough(assets);
	const regions = hhiScore(Object.values(lt).filter((v) => v > .01), REGION_BUCKETS.length);
	return {
		classes,
		regions,
		global: Math.round((classes + regions) / 2)
	};
}
function project(start, dca, years, rate = .075) {
	const points = [];
	let value = start;
	let verse = start;
	points.push({
		annee: 0,
		valeur: Math.round(value),
		verse: Math.round(verse)
	});
	for (let y = 1; y <= years; y++) {
		for (let m = 0; m < 12; m++) {
			value = value * (1 + rate / 12) + dca;
			verse += dca;
		}
		points.push({
			annee: y,
			valeur: Math.round(value),
			verse: Math.round(verse)
		});
	}
	return points;
}
async function searchSymbols(query) {
	try {
		const res = await fetch(`/api/public/search-symbols?q=${encodeURIComponent(query)}`);
		if (!res.ok) return [];
		return await res.json();
	} catch {
		return [];
	}
}
async function fetchQuote(tickers) {
	const list = Array.from(new Set(tickers.filter(Boolean)));
	if (!list.length) return {};
	try {
		const res = await fetch(`/api/public/quote?symbols=${encodeURIComponent(list.join(","))}`);
		if (!res.ok) return {};
		return await res.json();
	} catch {
		return {};
	}
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-BqKF7lMf.js
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var styles_default = "/assets/styles-CC5r3i-I.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
	const message = error instanceof Response ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}` : error instanceof Error ? error.message : String(error);
	const stack = error instanceof Error ? error.stack : void 0;
	window.__lovableReportRuntimeError?.({
		message,
		...stack !== void 0 && { stack },
		filename: window.location.pathname
	});
}
/**
* Rappel de versement du mois.
*
* Deux niveaux, parce qu'une app web ne peut pas garantir la notification :
* 1. Une bannière dans l'app, toujours fiable, dès que le mois en cours
*    n'a pas encore été marqué comme versé.
* 2. Une notification système, si l'utilisateur l'a autorisée et que le
*    navigateur le permet. Sur iPhone, cela suppose que l'app ait été
*    ajoutée à l'écran d'accueil (« Partager » → « Sur l'écran d'accueil »).
*/
function currentMonth() {
	return (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
}
/** Le versement du mois en cours reste-t-il à faire ? */
function contributionDue(profile) {
	if (!profile?.monthlyReminder) return false;
	return profile.lastContribution !== currentMonth();
}
function notificationsSupported() {
	return typeof window !== "undefined" && "Notification" in window;
}
function notificationsGranted() {
	return notificationsSupported() && Notification.permission === "granted";
}
/** Demande l'autorisation ; retourne true si accordée. */
async function requestNotifications() {
	if (!notificationsSupported()) return false;
	if (Notification.permission === "granted") return true;
	if (Notification.permission === "denied") return false;
	return await Notification.requestPermission() === "granted";
}
var REMINDER_SEEN_KEY = "patrimoine.reminderShown";
var SEEN_KEY = REMINDER_SEEN_KEY;
/**
* Affiche la notification du mois au plus une fois.
* Appelé à l'ouverture de l'app : sans service worker, un rappel ne peut
* pas partir quand l'app est fermée — c'est la limite du web.
*/
function maybeNotify(profile, dca) {
	if (!contributionDue(profile) || !notificationsGranted()) return;
	const month = currentMonth();
	try {
		if (window.localStorage.getItem(SEEN_KEY) === month) return;
		window.localStorage.setItem(SEEN_KEY, month);
	} catch {
		return;
	}
	const amount = dca > 0 ? new Intl.NumberFormat("fr-FR", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0
	}).format(dca) : null;
	new Notification("Versement du mois", {
		body: amount ? `C'est le moment de placer tes ${amount}. Ouvre ton plan pour la répartition.` : "C'est le moment de ton versement mensuel.",
		icon: "/favicon.ico",
		tag: `patrimoine-${month}`
	});
}
function AppProvider({ children }) {
	const [profile, setProfile] = (0, import_react.useState)(null);
	const [assets, setAssetsState] = (0, import_react.useState)([]);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [history, setHistory] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		const p = storage.get(KEYS.profile);
		const a = storage.get(KEYS.assets);
		setProfile(p);
		setAmountMasking(Boolean(p?.hideAmounts));
		setAssetsState(a ?? []);
		setHistory(storage.get(KEYS.history) ?? []);
		setReady(true);
	}, []);
	const persist = (0, import_react.useCallback)((next) => {
		setAssetsState(next);
		storage.set(KEYS.assets, next);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
		const net = totals(assets).net;
		setHistory((prev) => {
			const next = [...prev.filter((h) => h.date.slice(0, 10) !== today), {
				date: (/* @__PURE__ */ new Date()).toISOString(),
				value: net
			}].slice(-60);
			storage.set(KEYS.history, next);
			return next;
		});
	}, [assets, ready]);
	const value = (0, import_react.useMemo)(() => ({
		profile,
		assets,
		ready,
		history,
		saveProfile: (p) => {
			setProfile(p);
			setAmountMasking(Boolean(p.hideAmounts));
			storage.set(KEYS.profile, p);
		},
		upsertAsset: (a) => {
			const exists = assets.some((x) => x.id === a.id);
			persist(exists ? assets.map((x) => x.id === a.id ? a : x) : [...assets, a]);
		},
		removeAsset: (id) => persist(assets.filter((x) => x.id !== id)),
		setAssets: persist,
		reset: () => {
			setAmountMasking(false);
			storage.remove(KEYS.profile);
			storage.remove(KEYS.assets);
			storage.remove(KEYS.history);
			storage.remove(REMINDER_SEEN_KEY);
			setHistory([]);
			setProfile(null);
			setAssetsState([]);
		}
	}), [
		profile,
		assets,
		ready,
		history,
		persist
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppContext.Provider, {
		value,
		children
	});
}
var items = [
	{
		to: "/",
		label: "Accueil",
		Icon: House
	},
	{
		to: "/patrimoine",
		label: "Actifs",
		Icon: Wallet
	},
	{
		to: "/profil",
		label: "Profil",
		Icon: User
	}
];
/**
* Trois onglets de poids égal + un bouton d'ajout flottant.
* Le bouton n'occupe plus une colonne de la barre : la navigation
* reste lisible et l'action principale garde sa place au pouce.
*/
function BottomNav({ onAdd }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: onAdd,
		"aria-label": "Ajouter une ligne",
		className: "tap fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-224px))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
			className: "size-6",
			strokeWidth: 2.5
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-border bg-background/90 backdrop-blur-xl",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2",
			children: items.map(({ to, label, Icon }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to,
				activeOptions: { exact: to === "/" },
				className: "flex flex-col items-center gap-1 py-1 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "size-[22px]",
					strokeWidth: 1.9
				}), label]
			}, to))
		})
	})] });
}
var Toaster$1 = ({ ...props }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
var CATALOG = [
	{
		name: "Amundi MSCI World UCITS ETF",
		ticker: "CW8.PA",
		isin: "LU1681043599",
		region: "Monde",
		sector: "ETF diversifié",
		currency: "EUR",
		ter: .38,
		pea: false,
		kind: "etf",
		aliases: [
			"world",
			"msci world",
			"cw8",
			"monde"
		]
	},
	{
		name: "Amundi PEA Monde MSCI World Acc",
		ticker: "PCEW.PA",
		isin: "LU2089238385",
		region: "Monde",
		sector: "ETF diversifié",
		currency: "EUR",
		ter: .2,
		pea: true,
		kind: "etf",
		aliases: [
			"world pea",
			"pcew",
			"monde",
			"msci world"
		]
	},
	{
		name: "Amundi PEA S&P 500 Acc",
		ticker: "PE500.PA",
		isin: "FR0013412020",
		region: "États-Unis",
		sector: "ETF actions US",
		currency: "EUR",
		ter: .15,
		pea: true,
		kind: "etf",
		aliases: [
			"sp500",
			"s&p 500",
			"usa",
			"pe500"
		]
	},
	{
		name: "Amundi PEA Nasdaq-100",
		ticker: "PANX.PA",
		isin: "FR0011871110",
		region: "États-Unis",
		sector: "ETF tech US",
		currency: "EUR",
		ter: .23,
		pea: true,
		kind: "etf",
		aliases: [
			"nasdaq",
			"tech",
			"panx"
		]
	},
	{
		name: "Amundi PEA Russell 2000",
		ticker: "PRUS.PA",
		isin: "FR0014003IY1",
		region: "États-Unis",
		sector: "ETF small caps",
		currency: "EUR",
		ter: .35,
		pea: true,
		kind: "etf",
		aliases: [
			"russell",
			"small caps",
			"prus"
		]
	},
	{
		name: "Amundi Stoxx Europe 600",
		ticker: "PCEU.PA",
		isin: "LU1681040223",
		region: "Europe",
		sector: "ETF actions Europe",
		currency: "EUR",
		ter: .07,
		pea: true,
		kind: "etf",
		aliases: [
			"europe",
			"stoxx",
			"pceu"
		]
	},
	{
		name: "BNP Easy Stoxx Europe 600 Cap.",
		ticker: "BNL.PA",
		isin: "FR0011550193",
		region: "Europe",
		sector: "ETF actions Europe",
		currency: "EUR",
		ter: .2,
		pea: true,
		kind: "etf",
		aliases: [
			"europe",
			"stoxx 600",
			"bnl",
			"bnp"
		]
	},
	{
		name: "Amundi PEA Émergent ESG Transition",
		ticker: "PAEEM.PA",
		isin: "LU2300295199",
		region: "Émergents",
		sector: "ETF actions émergents",
		currency: "EUR",
		ter: .3,
		pea: true,
		kind: "etf",
		aliases: [
			"emergent",
			"émergents",
			"chine",
			"paeem"
		]
	},
	{
		name: "iShares Diversified Commodity Swap",
		ticker: "CMSE.PA",
		isin: "IE00BDFL4P12",
		region: "Monde",
		sector: "Matières premières / commodities",
		currency: "EUR",
		ter: .19,
		pea: false,
		kind: "etf",
		aliases: [
			"commodities",
			"matieres premieres",
			"or",
			"cmse"
		]
	},
	{
		name: "Amundi Japan TOPIX",
		ticker: "PTPXE.PA",
		isin: "LU1681037948",
		region: "Japon",
		sector: "ETF actions Japon",
		currency: "EUR",
		ter: .2,
		pea: false,
		kind: "etf",
		aliases: [
			"japon",
			"topix",
			"nikkei"
		]
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
		aliases: ["lvmh", "vuitton"]
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
		aliases: ["total", "petrole"]
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
		aliases: ["airbus"]
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
		aliases: ["sanofi", "pharma"]
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
		aliases: ["apple", "aapl"]
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
		aliases: ["nvidia", "nvda"]
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
		aliases: ["microsoft", "msft"]
	},
	{
		name: "Bitcoin",
		ticker: "BTC-EUR",
		region: "Monde",
		sector: "Crypto",
		currency: "EUR",
		kind: "crypto",
		aliases: ["btc", "bitcoin"]
	},
	{
		name: "Ethereum",
		ticker: "ETH-EUR",
		region: "Monde",
		sector: "Crypto",
		currency: "EUR",
		kind: "crypto",
		aliases: ["eth", "ethereum"]
	}
];
function normalize(s) {
	return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function searchCatalog(query, kind) {
	const q = normalize(query.trim());
	const pool = CATALOG.filter((e) => kind === "crypto" ? e.kind === "crypto" : kind === "titre" ? e.kind !== "crypto" : true);
	if (!q) return pool.slice(0, 8);
	return pool.map((e) => {
		const hay = [
			e.name,
			e.ticker,
			e.isin ?? "",
			...e.aliases ?? []
		].map(normalize);
		return {
			e,
			score: hay.some((h) => h.startsWith(q)) ? 0 : hay.some((h) => h.includes(q)) ? 1 : 2
		};
	}).filter((r) => r.score < 2).sort((a, b) => a.score - b.score).slice(0, 8).map((r) => r.e);
}
/** Convertit « 22 700,50 », « 22.700,50 », « 22700.5 » en nombre. */
function toNumber(raw) {
	let s = raw.replace(/[\s\u00a0\u202f]/g, "");
	let mult = 1;
	const suffix = s.match(/([kKmM])$/);
	if (suffix) {
		mult = suffix[1].toLowerCase() === "k" ? 1e3 : 1e6;
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
/** Tous les nombres du texte, dans l'ordre, avec leur position. */
function numbers(text) {
	const out = [];
	const re = /\d[\d\s\u00a0\u202f.]*(?:[.,]\d+)?\s*[kKmM]?(?=\s*(?:€|euros?|\b))/g;
	let m;
	while (m = re.exec(text)) {
		const value = toNumber(m[0].replace(/\s+([kKmM])$/, "$1"));
		if (value > 0) out.push({
			value,
			index: m.index,
			raw: m[0]
		});
	}
	return out;
}
/**
* Premier montant « principal » du texte : on écarte les valeurs déjà
* attribuées à un autre champ, les pourcentages, les durées (« sur 20 ans »)
* et les quantités (« 20 parts »).
*/
function firstAmountExcluding(text, nums, used) {
	for (const n of nums) {
		if (used.some((u) => u !== void 0 && Math.abs(u - n.value) < .001)) continue;
		const after = text.slice(n.index + n.raw.length, n.index + n.raw.length + 14).toLowerCase();
		if (/^\s*(%|pour ?cent)/.test(after)) continue;
		if (/^\s*(ans?|années?|mois\b|parts?|actions?|titres?|unit[ée]s?)/.test(after)) continue;
		return n.value;
	}
}
/**
* Nombre précédant un mot-clé (« 40 000 en fonds euros »).
* Complète `after`, qui ne couvre que l'ordre inverse.
*/
function before(text, keys) {
	for (const k of keys) {
		const m = new RegExp(`(\\d[\\d\\s\\u00a0\\u202f.]*(?:[.,]\\d+)?\\s*[kKmM]?)\\s*(?:€|euros?)?\\s*(?:en|de|d'|sur|dans|au titre de)?\\s*(?:mon|ma|le|la|les)?\\s*${k}`, "i").exec(text);
		if (m?.[1]) {
			const v = toNumber(m[1].replace(/\s+([kKmM])$/, "$1"));
			if (v > 0) return v;
		}
	}
}
/** Nombre suivant un mot-clé (« mensualité de 592 », « PRU 48,48 »). */
function after(text, keywords) {
	for (const k of keywords) {
		const re = new RegExp(`${k}[^0-9]{0,18}(\\d[\\d\\s\\u00a0\\u202f.]*(?:[.,]\\d+)?)`, "i");
		const m = text.match(re);
		if (m?.[1]) {
			const v = toNumber(m[1]);
			if (v > 0) return v;
		}
	}
}
var TYPE_HINTS = [
	{
		type: "credit",
		words: /\b(cr[ée]dit|pr[êe]t|emprunt|dette)\b/i
	},
	{
		type: "livret",
		words: /\b(livret|ldds?|lep|pel|cel|codevi)\b/i
	},
	{
		type: "av",
		words: /\b(assurance[- ]?vie|av\b|per\b|contrat|fonds? €|fonds? euros?)\b/i
	},
	{
		type: "immo",
		words: /\b(appartement|appart|appt|maison|studio|villa|terrain|immobilier|bien|scpi|t[1-5]\b|r[ée]sidence|locatif|loft|duplex)\b/i
	},
	{
		type: "crypto",
		words: /\b(bitcoin|btc|ethereum|eth|solana|crypto|satoshi)\b/i
	},
	{
		type: "cash",
		words: /\b(compte[- ](?:courant|en banque|bancaire|ch[èe]ques)|compte en banque|esp[èe]ces|cash|liquidit[ée]s?)\b/i
	},
	{
		type: "pea",
		words: /\b(pea|cto|etf|action|titre|bourse|part[s]?\b|msci|s&p|nasdaq|stoxx)\b/i
	}
];
/** Cherche un instrument du catalogue mentionné dans le texte. */
function findInstrument(text) {
	const low = text.toLowerCase();
	let best;
	for (const e of CATALOG) {
		const ticker = e.ticker.toLowerCase().replace(/\.pa$/, "");
		const candidates = [
			...ticker.length >= 4 ? [ticker] : [],
			...(e.aliases ?? []).filter((a) => a.length >= 3),
			e.name.toLowerCase()
		];
		for (const c of candidates) if (new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(low) && (!best || c.length > best.score)) best = {
			entry: e,
			score: c.length
		};
	}
	return best?.entry;
}
function parseAssetText(input) {
	const text = input.trim();
	const nums = numbers(text);
	const instrument = findInstrument(text);
	const type = TYPE_HINTS.find((h) => h.words.test(text))?.type ?? (instrument ? instrument.kind === "crypto" ? "crypto" : "pea" : "autre");
	const useInstrument = instrument && (type === "pea" || type === "crypto");
	const data = {};
	const summary = [];
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
	const scrubbed = useInstrument && instrument ? [instrument.ticker.replace(/\.pa$/i, ""), ...instrument.aliases ?? []].filter((a) => a.length >= 3).reduce((acc, a) => acc.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " "), text) : text;
	const pick = (keys) => after(scrubbed, keys);
	if (type === "pea" || type === "crypto") {
		const qtyMatch = /(\d[\d\s.,]*)\s*(?:parts?|actions?|titres?|unit[ée]s?)/i.exec(scrubbed);
		const qty = pick(["quantit[ée]", "\\bx\\b"]) ?? (qtyMatch ? toNumber(qtyMatch[1]) : void 0);
		const pru = pick([
			"pru",
			"prix moyen",
			"prix d'achat",
			"achet[ée]e?s? [àa]"
		]);
		const price = pick([
			"cours",
			"prix actuel",
			"vaut",
			"cote",
			"[àa] "
		]);
		if (qty !== void 0) {
			data["quantity"] = qty;
			summary.push(`${qty} ${type === "crypto" ? "unités" : "parts"}`);
		}
		if (pru !== void 0) {
			data["pru"] = pru;
			summary.push(`PRU ${pru} €`);
		}
		const priceKey = type === "crypto" ? "prixUnitaire" : "currentPrice";
		if (price !== void 0 && price !== pru) {
			data[priceKey] = price;
			summary.push(`cours ${price} €`);
		}
		const bare = numbers(scrubbed);
		if (data["quantity"] === void 0 && bare.length >= 2 && pru === void 0) {
			data["quantity"] = bare[0].value;
			data[priceKey] = bare[1].value;
			summary.push(`${bare[0].value} × ${bare[1].value} €`);
		}
	} else if (type === "credit") {
		const mensualite = pick([
			"mensualit[ée]",
			"par mois",
			"\\/mois",
			"[ée]ch[ée]ance"
		]);
		const taux = pick(["taux"]);
		const restant = pick([
			"capital restant",
			"restant d[uû]",
			"reste [àa] rembourser",
			"il reste",
			"reste",
			"restant",
			"capital",
			"emprunt[ée]? de",
			"emprunt[ée]?",
			"pr[êe]t de"
		]) ?? firstAmountExcluding(scrubbed, nums, [mensualite, taux]);
		if (restant !== void 0) {
			data["capitalRestant"] = restant;
			summary.push(`capital restant ${restant} €`);
		}
		if (mensualite !== void 0 && mensualite !== restant) {
			data["mensualite"] = mensualite;
			summary.push(`${mensualite} €/mois`);
		}
		if (taux !== void 0 && taux < 25) data["taux"] = taux;
	} else if (type === "immo") {
		const loyer = pick([
			"lou[ée]e?",
			"loyer",
			"par mois",
			"\\/mois"
		]);
		const valeur = pick([
			"estim[ée]e?",
			"valeur",
			"vaut",
			"prix",
			"[àa] "
		]) ?? firstAmountExcluding(scrubbed, nums, [loyer]);
		if (valeur !== void 0) {
			data["valeurEstimee"] = valeur;
			summary.push(`valeur ${valeur} €`);
		}
		if (loyer !== void 0 && loyer !== valeur) {
			data["loyer"] = loyer;
			summary.push(`loyer ${loyer} €/mois`);
		}
	} else if (type === "av") {
		const fondsKeys = [
			"fonds? €",
			"fonds? euros?",
			"s[ée]curis[ée]"
		];
		const ucKeys = ["uc\\b", "unit[ée]s? de compte"];
		const uc = before(scrubbed, ucKeys) ?? pick(ucKeys);
		const fonds = before(scrubbed, fondsKeys) ?? pick(fondsKeys) ?? firstAmountExcluding(scrubbed, nums, [uc]);
		if (fonds !== void 0) {
			data["fondsEurosAmount"] = fonds;
			summary.push(`fonds € ${fonds} €`);
		}
		if (uc !== void 0 && uc !== fonds) {
			data["ucAmount"] = uc;
			summary.push(`UC ${uc} €`);
		}
	} else {
		const amount = pick([
			"montant",
			"solde",
			"\\bde\\b"
		]) ?? nums[0]?.value;
		if (amount !== void 0) {
			data["amount"] = amount;
			summary.push(`${amount} €`);
		}
		const taux = pick(["taux", "r[ée]mun[ée]r[ée]"]);
		if (taux !== void 0 && taux < 25) data["taux"] = taux;
	}
	if (!data["name"]) {
		const head = (nums[0] ? text.slice(0, nums[0].index) : text).replace(/^(j'ai|jai|il me reste|ajoute[rz]?|mon|ma|mes)\s+/i, "").replace(/^(une?|des|le|la|les|du|de la)\s+/i, "").replace(/\s*\b(qui\s+)?(vaut|vaux|coûte|coute|fait|est|s'?[ée]l[èe]ve|estim[ée]e?\s*à?)\b.*$/i, "").replace(/[,;:]\s*$/, "").replace(/\s*\b(capital restant|restant d[uû]|montant|solde|valeur|estim[ée]e?|de|d'|à|a|environ|pour|avec)\b\s*$/i, "").replace(/\s+/g, " ").trim();
		if (head) {
			const clean = (/\blivret\s*a\b/i.test(text) ? "Livret A" : /\bldds?\b/i.test(text) ? "LDDS" : /\blep\b/i.test(text) ? "LEP" : /\bpel\b/i.test(text) ? "PEL" : /\b(maison|appartement|appart|studio|villa|terrain)\b/i.test(text) ? text.match(/\b(maison|appartement|appart|studio|villa|terrain)\b/i)[1].replace(/^./, (c) => c.toUpperCase()) : /\b(pr[êe]t|cr[ée]dit|emprunt)\b/i.test(text) ? /immo/i.test(text) ? "Crédit immobilier" : "Crédit" : void 0) ?? head.charAt(0).toUpperCase() + head.slice(1);
			if (type === "livret" || type === "immo" || type === "credit") data["type"] = clean;
			data["name"] = clean;
			summary.unshift(clean);
		}
	}
	return {
		type,
		data,
		summary,
		incomplete: !nums.length
	};
}
var EXAMPLES = [
	"Livret A 22 700",
	"Maison qui vaut 250 000, louée 700 par mois",
	"Crédit immo, capital restant 90 896, mensualité 592, taux 1,2 %",
	"88 parts d'Amundi S&P 500 à 58,14, PRU 48,48"
];
function speechCtor() {
	if (typeof window === "undefined") return void 0;
	const w = window;
	return w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
}
/**
* Saisie d'un actif en une phrase, tapée ou dictée.
* L'analyse est locale et le résultat est toujours relu dans le
* formulaire avant enregistrement — rien n'est créé à l'aveugle.
*/
function NaturalInput({ onParsed }) {
	const [text, setText] = (0, import_react.useState)("");
	const [listening, setListening] = (0, import_react.useState)(false);
	const recRef = (0, import_react.useRef)(null);
	const supported = Boolean(speechCtor());
	(0, import_react.useEffect)(() => () => recRef.current?.stop(), []);
	const toggleMic = () => {
		if (listening) {
			recRef.current?.stop();
			setListening(false);
			return;
		}
		const Ctor = speechCtor();
		if (!Ctor) return;
		const rec = new Ctor();
		recRef.current = rec;
		rec.lang = "fr-FR";
		rec.continuous = false;
		rec.interimResults = true;
		rec.onresult = (e) => {
			let out = "";
			for (let i = 0; i < e.results.length; i++) {
				const alt = e.results[i]?.[0];
				if (alt) out += alt.transcript;
			}
			setText(out);
		};
		rec.onend = () => setListening(false);
		rec.onerror = () => setListening(false);
		rec.start();
		setListening(true);
	};
	const preview = text.trim().length > 3 ? parseAssetText(text) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-primary/30 bg-primary/[0.05] p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-semibold",
					children: "Décris-le en une phrase"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					value: text,
					onChange: (e) => setText(e.target.value),
					rows: 3,
					placeholder: "J'ai une maison qui vaut 250 000 et un prêt de 180 000 à 1,2 %",
					className: "w-full resize-none rounded-xl border border-border bg-card p-3 pr-12 text-sm outline-none focus:border-primary"
				}), supported && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: toggleMic,
					"aria-label": listening ? "Arrêter la dictée" : "Dicter",
					className: `tap absolute right-2 top-2 flex size-9 items-center justify-center rounded-full ${listening ? "animate-pulse bg-destructive text-white" : "bg-elevated text-muted-foreground"}`,
					children: listening ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-4" })
				})]
			}),
			!supported && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1.5 text-[11px] text-muted-foreground",
				children: "Pour dicter, utilise le micro de ton clavier."
			}),
			preview && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-xl border border-border bg-card p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs font-semibold",
						children: TYPE_LABELS[preview.type]
					}), preview.incomplete && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] text-amber",
						children: "montant à compléter"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[11px] leading-relaxed text-muted-foreground",
					children: preview.summary.length ? preview.summary.join(" · ") : "Rien de reconnu pour l'instant."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: !preview,
				onClick: () => preview && onParsed(preview),
				className: "tap mt-3 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-30",
				children: "Remplir le formulaire"
			}),
			!text && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-1.5",
				children: EXAMPLES.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setText(e),
					className: "tap rounded-full border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground",
					children: e
				}, e))
			})
		]
	});
}
function SymbolSearch({ kind = "titre", onSelect, onManual }) {
	const [query, setQuery] = (0, import_react.useState)("");
	const [remote, setRemote] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [prices, setPrices] = (0, import_react.useState)({});
	const [active, setActive] = (0, import_react.useState)(0);
	const inputRef = (0, import_react.useRef)(null);
	const local = (0, import_react.useMemo)(() => searchCatalog(query, kind), [query, kind]);
	const results = (0, import_react.useMemo)(() => {
		const seen = new Set(local.map((l) => l.ticker));
		return [...local, ...remote.filter((r) => !seen.has(r.ticker))].slice(0, 10);
	}, [local, remote]);
	(0, import_react.useEffect)(() => {
		inputRef.current?.focus();
	}, []);
	(0, import_react.useEffect)(() => {
		setActive(0);
		const q = query.trim();
		if (q.length < 2) {
			setRemote([]);
			return;
		}
		let cancelled = false;
		setLoading(true);
		const t = setTimeout(async () => {
			const hits = await searchSymbols(q);
			if (cancelled) return;
			setRemote(hits.map((h) => ({
				name: h.name,
				ticker: h.symbol,
				region: h.exchange || "Monde",
				sector: h.type || "Titre",
				currency: "EUR",
				kind: "etf"
			})));
			setLoading(false);
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(t);
			setLoading(false);
		};
	}, [query]);
	(0, import_react.useEffect)(() => {
		const missing = results.map((r) => r.ticker).filter((t) => !(t in prices));
		if (!missing.length) return;
		let cancelled = false;
		fetchQuote(missing.slice(0, 8)).then((q) => {
			if (cancelled) return;
			setPrices((p) => {
				const next = { ...p };
				for (const [k, v] of Object.entries(q)) next[k] = v.price;
				return next;
			});
		});
		return () => {
			cancelled = true;
		};
	}, [results]);
	const choose = async (entry) => {
		const known = prices[entry.ticker];
		if (known !== void 0) {
			onSelect({
				...entry,
				price: known
			});
			return;
		}
		const q = await fetchQuote([entry.ticker]);
		onSelect({
			...entry,
			price: q[entry.ticker]?.price
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					ref: inputRef,
					value: query,
					onChange: (e) => setQuery(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setActive((a) => Math.min(a + 1, results.length - 1));
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setActive((a) => Math.max(a - 1, 0));
						} else if (e.key === "Enter" && results[active]) {
							e.preventDefault();
							choose(results[active]);
						}
					},
					placeholder: kind === "crypto" ? "Bitcoin, ETH…" : "World, S&P 500, Nvidia, ISIN…",
					className: "h-12 w-full rounded-xl border border-border bg-elevated pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
				}),
				loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" })
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "mt-2 space-y-1",
			children: [results.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onMouseEnter: () => setActive(i),
				onClick: () => void choose(r),
				className: `tap flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${i === active ? "border-primary/60 bg-elevated" : "border-transparent bg-card"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate text-sm font-semibold",
							children: r.name
						}), r.pea && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary",
							children: "PEA"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-0.5 truncate font-mono text-[11px] text-muted-foreground",
						children: [
							r.ticker,
							" · ",
							r.region,
							" · ",
							r.sector
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "shrink-0 text-right font-mono text-xs",
					children: prices[r.ticker] !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [num(prices[r.ticker]), " €"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "—"
					})
				})]
			}) }, r.ticker + i)), !results.length && !loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-1 py-4 text-center text-sm text-muted-foreground",
				children: "Aucun résultat"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: onManual,
			className: "mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground",
			children: ["Je ne trouve pas → saisie manuelle", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3" })]
		})
	] });
}
var FIELDS = {
	pea: [
		{
			key: "envelope",
			label: "Enveloppe",
			placeholder: "PEA / CTO / PEE / PER"
		},
		{
			key: "name",
			label: "Nom"
		},
		{
			key: "ticker",
			label: "Ticker"
		},
		{
			key: "isin",
			label: "ISIN"
		},
		{
			key: "quantity",
			label: "Quantité",
			type: "number"
		},
		{
			key: "pru",
			label: "PRU (prix moyen d'achat)",
			type: "number"
		},
		{
			key: "currentPrice",
			label: "Prix actuel",
			type: "number"
		},
		{
			key: "sector",
			label: "Secteur"
		},
		{
			key: "region",
			label: "Région",
			placeholder: "Monde / États-Unis / Europe / Émergents"
		},
		{
			key: "ter",
			label: "TER (%)",
			type: "number"
		},
		{
			key: "currency",
			label: "Devise"
		}
	],
	av: [
		{
			key: "name",
			label: "Nom du contrat"
		},
		{
			key: "assureur",
			label: "Assureur"
		},
		{
			key: "dateOuverture",
			label: "Date d'ouverture",
			placeholder: "2019-04"
		},
		{
			key: "fondsEurosAmount",
			label: "Montant fonds €",
			type: "number"
		},
		{
			key: "fondsEurosRendement",
			label: "Rendement fonds € (%)",
			type: "number"
		},
		{
			key: "ucAmount",
			label: "Montant UC",
			type: "number"
		},
		{
			key: "ucDescription",
			label: "Support UC"
		}
	],
	livret: [
		{
			key: "name",
			label: "Nom"
		},
		{
			key: "type",
			label: "Type",
			placeholder: "Livret A, LDDS, LEP, PEL…"
		},
		{
			key: "amount",
			label: "Montant",
			type: "number"
		},
		{
			key: "taux",
			label: "Taux (%)",
			type: "number"
		}
	],
	immo: [
		{
			key: "type",
			label: "Type",
			placeholder: "Résidence principale, Locatif, SCPI…"
		},
		{
			key: "name",
			label: "Nom"
		},
		{
			key: "adresse",
			label: "Adresse"
		},
		{
			key: "surface",
			label: "Surface (m²)",
			type: "number"
		},
		{
			key: "dpe",
			label: "DPE"
		},
		{
			key: "annee",
			label: "Année",
			type: "number"
		},
		{
			key: "valeurEstimee",
			label: "Valeur estimée",
			type: "number"
		},
		{
			key: "loyer",
			label: "Loyer mensuel",
			type: "number"
		}
	],
	crypto: [
		{
			key: "name",
			label: "Nom"
		},
		{
			key: "ticker",
			label: "Ticker"
		},
		{
			key: "quantity",
			label: "Quantité",
			type: "number"
		},
		{
			key: "prixUnitaire",
			label: "Prix unitaire",
			type: "number"
		}
	],
	cash: [{
		key: "name",
		label: "Nom du compte"
	}, {
		key: "amount",
		label: "Montant",
		type: "number"
	}],
	autre: [
		{
			key: "name",
			label: "Nom"
		},
		{
			key: "amount",
			label: "Valeur",
			type: "number"
		},
		{
			key: "description",
			label: "Description"
		}
	],
	credit: [
		{
			key: "type",
			label: "Type",
			placeholder: "Prêt immobilier, conso, auto…"
		},
		{
			key: "name",
			label: "Nom"
		},
		{
			key: "preteur",
			label: "Prêteur"
		},
		{
			key: "capitalInitial",
			label: "Capital initial",
			type: "number"
		},
		{
			key: "capitalRestant",
			label: "Capital restant",
			type: "number"
		},
		{
			key: "taux",
			label: "Taux (%)",
			type: "number"
		},
		{
			key: "mensualite",
			label: "Mensualité",
			type: "number"
		},
		{
			key: "dureeRestante",
			label: "Durée restante (mois)",
			type: "number"
		},
		{
			key: "dateFin",
			label: "Date de fin"
		}
	]
};
/** Champs affichés d'emblée ; les autres sont repliés sous « Plus d'options ». */
var ESSENTIAL = {
	pea: [
		"name",
		"quantity",
		"pru",
		"currentPrice"
	],
	av: [
		"name",
		"fondsEurosAmount",
		"ucAmount"
	],
	livret: [
		"name",
		"type",
		"amount"
	],
	immo: [
		"type",
		"name",
		"valeurEstimee"
	],
	crypto: [
		"name",
		"ticker",
		"quantity",
		"prixUnitaire"
	],
	cash: ["name", "amount"],
	autre: ["name", "amount"],
	credit: [
		"name",
		"capitalRestant",
		"mensualite"
	]
};
/** Métadonnées sans champ dédié, conservées telles quelles à l'enregistrement. */
var PRESERVED = [
	"envelope",
	"region",
	"sector",
	"currency",
	"isin",
	"lastPriceUpdate"
];
var TYPE_CARDS = [
	{
		type: "pea",
		Icon: Landmark,
		color: "text-primary"
	},
	{
		type: "av",
		Icon: ShieldCheck,
		color: "text-info"
	},
	{
		type: "livret",
		Icon: PiggyBank,
		color: "text-amber"
	},
	{
		type: "immo",
		Icon: House,
		color: "text-orange"
	},
	{
		type: "crypto",
		Icon: Bitcoin,
		color: "text-violet"
	},
	{
		type: "cash",
		Icon: Banknote,
		color: "text-primary"
	},
	{
		type: "autre",
		Icon: Package,
		color: "text-muted-foreground"
	},
	{
		type: "credit",
		Icon: CreditCard,
		color: "text-destructive"
	}
];
function AssetModal({ asset, onClose, onSave, onDelete }) {
	const [type, setType] = (0, import_react.useState)(asset?.type ?? null);
	const [mode, setMode] = (0, import_react.useState)(asset ? "manual" : "search");
	const [data, setData] = (0, import_react.useState)(() => {
		const init = {};
		if (asset) for (const [k, v] of Object.entries(asset.data)) init[k] = String(v ?? "");
		return init;
	});
	const [fetching, setFetching] = (0, import_react.useState)(false);
	const [showMore, setShowMore] = (0, import_react.useState)(() => Boolean(asset && FIELDS[asset.type].some((f) => !ESSENTIAL[asset.type].includes(f.key) && asset.data[f.key] !== void 0 && asset.data[f.key] !== "")));
	const searchable = type === "pea" || type === "crypto";
	const applySymbol = (s) => {
		if (type === "crypto") setData((d) => ({
			...d,
			ticker: s.ticker,
			name: s.name,
			prixUnitaire: s.price ? String(s.price) : d["prixUnitaire"] ?? ""
		}));
		else setData((d) => ({
			...d,
			envelope: d["envelope"] || (s.pea ? "PEA" : "CTO"),
			name: s.name,
			ticker: s.ticker,
			isin: s.isin ?? "",
			sector: s.sector,
			region: s.region,
			currency: s.currency,
			ter: s.ter ? String(s.ter) : "",
			currentPrice: s.price ? String(s.price) : d["currentPrice"] ?? ""
		}));
		setMode("manual");
	};
	const refreshPrice = async () => {
		const ticker = data["ticker"];
		if (!ticker) return;
		setFetching(true);
		const price = (await fetchQuote([ticker]))[ticker]?.price;
		if (price !== void 0) setData((d) => ({
			...d,
			[type === "crypto" ? "prixUnitaire" : "currentPrice"]: String(price),
			lastPriceUpdate: (/* @__PURE__ */ new Date()).toISOString()
		}));
		setFetching(false);
	};
	const save = () => {
		if (!type) return;
		const clean = {};
		for (const f of FIELDS[type]) {
			const v = data[f.key];
			if (v === void 0 || v === "") continue;
			clean[f.key] = f.type === "number" ? Number(v.replace(",", ".")) : v;
		}
		for (const k of PRESERVED) {
			const v = data[k];
			if (v !== void 0 && v !== "" && clean[k] === void 0) clean[k] = v;
		}
		onSave({
			id: asset?.id ?? uid(),
			type,
			data: clean,
			createdAt: asset?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between border-b border-border px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => type && !asset ? setType(null) : onClose(),
						className: "tap flex size-9 items-center justify-center rounded-full bg-elevated",
						"aria-label": "Retour",
						children: type && !asset ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg",
						children: asset ? "Modifier" : type ? TYPE_LABELS[type] : "Ajouter un actif"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-9" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto px-4 py-4 pb-28",
				children: [
					!type && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NaturalInput, { onParsed: (p) => {
							setType(p.type);
							setData(Object.fromEntries(Object.entries(p.data).map(([k, v]) => [k, String(v)])));
							setMode("manual");
							setShowMore(true);
						} }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-5 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
							children: "ou choisis une catégorie"
						})]
					}),
					!type && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-3",
						children: TYPE_CARDS.map(({ type: t, Icon, color }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setType(t);
								setMode(t === "pea" || t === "crypto" ? "search" : "manual");
							},
							className: "tap card-surface flex flex-col items-start gap-3 p-4 text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: `size-5 ${color}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm font-semibold",
								children: TYPE_LABELS[t]
							})]
						}, t))
					}),
					type && searchable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-4 grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1",
						children: ["search", "manual"].map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setMode(m),
							className: `rounded-lg py-2 text-xs font-semibold transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`,
							children: m === "search" ? "Recherche" : "Manuel"
						}, m))
					}),
					type && searchable && mode === "search" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SymbolSearch, {
						kind: type === "crypto" ? "crypto" : "titre",
						onSelect: applySymbol,
						onManual: () => setMode("manual")
					}),
					type && (mode === "manual" || !searchable) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [
							FIELDS[type].filter((f) => ESSENTIAL[type].includes(f.key)).map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldInput, {
								f,
								data,
								setData
							}, f.key)),
							FIELDS[type].some((f) => !ESSENTIAL[type].includes(f.key)) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setShowMore((v) => !v),
								className: "tap flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold text-muted-foreground",
								children: [showMore ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3.5" }), showMore ? "Moins d'options" : "Plus d'options (ISIN, secteur, taux…)"]
							}),
							showMore && FIELDS[type].filter((f) => !ESSENTIAL[type].includes(f.key)).map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldInput, {
								f,
								data,
								setData
							}, f.key)),
							searchable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => void refreshPrice(),
								disabled: !data["ticker"] || fetching,
								className: "tap flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2.5 text-sm font-semibold text-primary disabled:opacity-40",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `size-4 ${fetching ? "animate-spin" : ""}` }), "Récupérer le prix"]
							}),
							asset && onDelete && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => onDelete(asset.id),
								className: "tap flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" }), "Supprimer"]
							})
						]
					})
				]
			}),
			type && (mode === "manual" || !searchable) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sticky bottom-0 border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: save,
					className: "tap w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground",
					children: "Enregistrer"
				})
			})
		]
	});
}
function FieldInput({ f, data, setData }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-1 block text-xs text-muted-foreground",
			children: f.label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			inputMode: f.type === "number" ? "decimal" : "text",
			value: data[f.key] ?? "",
			placeholder: f.placeholder ?? "",
			onChange: (e) => setData((d) => ({
				...d,
				[f.key]: e.target.value
			})),
			className: "h-11 w-full rounded-xl border border-border bg-elevated px-3 font-mono text-sm outline-none focus:border-primary"
		})]
	});
}
function exportBackup() {
	const profile = storage.get(KEYS.profile);
	const stamp = (/* @__PURE__ */ new Date()).toISOString();
	if (profile) {
		profile.lastBackup = stamp;
		storage.set(KEYS.profile, profile);
	}
	const payload = {
		app: "patrimoine",
		version: 1,
		exportedAt: stamp,
		profile,
		assets: storage.get(KEYS.assets) ?? [],
		history: storage.get(KEYS.history) ?? []
	};
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `patrimoine-${stamp.slice(0, 10)}.json`;
	a.click();
	URL.revokeObjectURL(url);
	window.location.reload();
}
/** Restaure une sauvegarde puis recharge l'app. Lance une erreur si invalide. */
async function restoreBackup(file) {
	const parsed = JSON.parse(await file.text());
	if (parsed.app !== "patrimoine" || !Array.isArray(parsed.assets)) throw new Error("Fichier non reconnu : ce n'est pas une sauvegarde Patrimoine.");
	if (parsed.profile) storage.set(KEYS.profile, parsed.profile);
	else storage.remove(KEYS.profile);
	storage.set(KEYS.assets, parsed.assets);
	storage.set(KEYS.history, Array.isArray(parsed.history) ? parsed.history : []);
	storage.remove(REMINDER_SEEN_KEY);
	window.location.reload();
}
function daysSinceBackup(profile) {
	if (!profile?.lastBackup) return void 0;
	return Math.floor((Date.now() - new Date(profile.lastBackup).getTime()) / 864e5);
}
/**
* Trois écrans, une question par écran.
* L'accroche n'est pas une liste de fonctionnalités mais une projection
* chiffrée : l'utilisateur voit ce que l'app calcule avant de saisir
* la moindre ligne.
*/
var REACTIONS = [
	{
		risk: "prudent",
		label: "Je vends pour limiter la casse",
		detail: "La sécurité d'abord",
		rate: 3.5
	},
	{
		risk: "equilibre",
		label: "Je réduis un peu, ça m'inquiète",
		detail: "Croissance sans stress",
		rate: 5.5
	},
	{
		risk: "dynamique",
		label: "J'attends, ça finira par remonter",
		detail: "Le temps est mon allié",
		rate: 7.5
	},
	{
		risk: "offensif",
		label: "J'en profite pour renforcer",
		detail: "Les baisses sont des soldes",
		rate: 8.5
	}
];
var DCA_CHOICES = [
	100,
	250,
	500,
	1e3
];
var HORIZON = 15;
function Onboarding({ onDone }) {
	const [step, setStep] = (0, import_react.useState)(0);
	const [name, setName] = (0, import_react.useState)("");
	const [risk, setRisk] = (0, import_react.useState)(null);
	const [dca, setDca] = (0, import_react.useState)(250);
	const [restoreError, setRestoreError] = (0, import_react.useState)("");
	const fileRef = (0, import_react.useRef)(null);
	const reaction = REACTIONS.find((r) => r.risk === risk) ?? REACTIONS[1];
	const target = TARGET_ALLOCATIONS[reaction.risk];
	const projected = (0, import_react.useMemo)(() => project(0, dca, HORIZON, reaction.rate / 100).at(-1)?.valeur ?? 0, [dca, reaction.rate]);
	const verse = dca * 12 * HORIZON;
	const finish = (openAdd) => {
		if (openAdd) sessionStorage.setItem("patrimoine.openAdd", "1");
		const goal = {
			id: uid(),
			kind: "patrimoine",
			label: "Patrimoine cible",
			amount: Math.round(projected / 1e4) * 1e4,
			horizon: HORIZON,
			dca,
			rate: reaction.rate
		};
		onDone({
			name: name.trim() || "Investisseur",
			age: 0,
			profession: "",
			incomeMonthly: 0,
			riskProfile: reaction.risk,
			goal: {
				amount: goal.amount,
				horizon: goal.horizon,
				dca: goal.dca
			},
			goals: [goal],
			activeGoalId: goal.id
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex min-h-dvh max-w-[480px] flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-14",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-10 flex gap-1.5",
				children: [
					0,
					1,
					2
				].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-[3px] flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-elevated"}` }, i))
			}),
			step === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fade-up flex flex-1 flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "font-display text-[2.5rem] leading-[1.05] tracking-tight",
						children: [
							"Tout ton",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							"patrimoine,",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-primary",
								children: "une seule vue."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 text-[15px] leading-relaxed text-muted-foreground",
						children: "Bourse, livrets, immobilier, crédits. Cours à jour, allocation réelle, projections. Rien ne quitte ton téléphone."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-auto block pt-10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mb-2 block text-xs font-medium text-muted-foreground",
							children: "Comment tu t'appelles ?"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: name,
							placeholder: "Alex",
							autoComplete: "given-name",
							onChange: (e) => setName(e.target.value),
							className: "h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg outline-none focus:border-primary"
						})]
					})
				]
			}),
			step === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fade-up flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "font-display text-[1.75rem] leading-tight tracking-tight",
						children: [
							"Ton portefeuille perd 20 %.",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							"Tu fais quoi ?"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted-foreground",
						children: "Ta réaction détermine ton allocation cible."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 space-y-2.5",
						children: REACTIONS.map((r) => {
							const on = risk === r.risk;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setRisk(r.risk),
								className: `tap w-full rounded-2xl border p-4 text-left transition-colors ${on ? "border-primary bg-primary/[0.06]" : "border-border bg-card"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[15px] font-semibold leading-snug",
										children: r.label
									}), on && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-0.5 shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground",
										children: RISK_LABELS[r.risk]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-xs text-muted-foreground",
									children: r.detail
								})]
							}, r.risk);
						})
					})
				]
			}),
			step === 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fade-up flex flex-1 flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-[1.75rem] leading-tight tracking-tight",
						children: "Si tu plaçais chaque mois…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5 grid grid-cols-4 gap-2",
						children: DCA_CHOICES.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setDca(v),
							className: `tap rounded-xl border py-3 text-sm font-semibold transition-colors ${dca === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`,
							children: [v, " €"]
						}, v))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 rounded-2xl border border-primary/30 bg-primary/[0.06] p-6 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs font-medium text-muted-foreground",
								children: [
									"Dans ",
									HORIZON,
									" ans, profil ",
									RISK_LABELS[reaction.risk].toLowerCase()
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 font-display text-[2.75rem] leading-none tracking-tight text-primary",
								children: eur(projected)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 text-xs text-muted-foreground",
								children: [
									"dont ",
									eur(projected - verse),
									" d'intérêts composés, pour ",
									eur(verse),
									" versés"
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 text-[11px] leading-relaxed text-muted-foreground",
						children: [
							"Hypothèse : ",
							reaction.rate,
							" %/an, l'allocation cible de ton profil (",
							target.actions,
							" % actions · ",
							target.obligations,
							" % fonds € ·",
							" ",
							target.immo,
							" % immo · ",
							target.cash,
							" % cash). C'est ton premier objectif — ajustable à tout moment."
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 space-y-2.5",
				children: [
					step < 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						disabled: step === 1 && !risk,
						onClick: () => setStep((s) => s + 1),
						className: "tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-30",
						children: ["Continuer ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => finish(true),
						className: "tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Ajouter ma première ligne"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => finish(false),
						className: "tap h-12 w-full rounded-2xl text-sm font-semibold text-muted-foreground",
						children: "Explorer d'abord"
					})] }),
					step === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => fileRef.current?.click(),
							className: "tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), " J'ai déjà une sauvegarde"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: fileRef,
							type: "file",
							accept: "application/json",
							hidden: true,
							onChange: (e) => {
								const f = e.target.files?.[0];
								if (!f) return;
								restoreBackup(f).catch((err) => setRestoreError(err instanceof Error ? err.message : "Import impossible."));
							}
						}),
						restoreError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-center text-[11px] text-destructive",
							children: restoreError
						})
					] }),
					step > 0 && step < 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setStep((s) => s - 1),
						className: "tap h-11 w-full text-sm font-medium text-muted-foreground",
						children: "Retour"
					})
				]
			})
		]
	});
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-7xl",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold",
					children: "Page introuvable"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
						children: "Retour à l'accueil"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold tracking-tight",
				children: "Cette page n'a pas pu se charger"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 flex flex-wrap justify-center gap-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => {
						router.invalidate();
						reset();
					},
					className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
					children: "Réessayer"
				})
			})]
		})
	});
}
var Route$5 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
			},
			{
				name: "theme-color",
				content: "#F2F2F7"
			},
			{ title: "Patrimoine — Pilotage de patrimoine personnel" },
			{
				name: "description",
				content: "Suivez vos actifs, dettes, allocation et objectifs d'investissement dans une seule app."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		],
		links: [{
			rel: "stylesheet",
			href: styles_default
		}, {
			rel: "icon",
			href: "/favicon.ico",
			type: "image/x-icon"
		}]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "fr",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$5.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {}) })
	});
}
function Shell() {
	const { profile, ready, saveProfile, upsertAsset } = useApp();
	const [adding, setAdding] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const open = () => setAdding(true);
		window.addEventListener(ADD_ASSET_EVENT, open);
		return () => window.removeEventListener(ADD_ASSET_EVENT, open);
	}, []);
	(0, import_react.useEffect)(() => {
		if (window.sessionStorage.getItem("patrimoine.openAdd") === "1") {
			window.sessionStorage.removeItem("patrimoine.openAdd");
			setAdding(true);
		}
	}, [profile]);
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "min-h-screen bg-background" });
	if (!profile) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Onboarding, { onDone: saveProfile });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto min-h-screen max-w-[480px] pb-24",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BottomNav, { onAdd: () => setAdding(true) }),
			adding && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetModal, {
				asset: null,
				onClose: () => setAdding(false),
				onSave: (a) => {
					upsertAsset(a);
					setAdding(false);
					toast.success("Ligne ajoutée");
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, { position: "top-center" })
		]
	});
}
var $$splitComponentImporter$2 = () => import("./routes-CQefuaRj.mjs");
var Route$4 = createFileRoute("/")({
	head: () => ({ meta: [
		{ title: "Accueil — Patrimoine" },
		{
			name: "description",
			content: "Votre patrimoine net, votre objectif et votre plan d'investissement du mois."
		},
		{
			property: "og:title",
			content: "Accueil — Patrimoine"
		},
		{
			property: "og:description",
			content: "Votre patrimoine net, votre objectif et votre plan d'investissement du mois."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./patrimoine-DZbVIq6p.mjs");
var Route$3 = createFileRoute("/patrimoine")({
	head: () => ({ meta: [
		{ title: "Patrimoine — Actifs et passifs" },
		{
			name: "description",
			content: "La liste complète de vos actifs et de vos dettes, groupée par type."
		},
		{
			property: "og:title",
			content: "Patrimoine — Actifs et passifs"
		},
		{
			property: "og:description",
			content: "La liste complète de vos actifs et de vos dettes, groupée par type."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./profil-BcBnU0gA.mjs");
var Route$2 = createFileRoute("/profil")({
	head: () => ({ meta: [
		{ title: "Profil — Patrimoine" },
		{
			name: "description",
			content: "Vos informations, votre profil de risque et votre objectif d'investissement."
		},
		{
			property: "og:title",
			content: "Profil — Patrimoine"
		},
		{
			property: "og:description",
			content: "Vos informations, votre profil de risque et votre objectif d'investissement."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
/**
* Champ d'édition. Les champs numériques gardent la saisie en local :
* on peut vider le champ ou taper une virgule sans que "0" s'impose.
*/
async function fetchOne(symbol) {
	try {
		const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`, { headers: {
			"User-Agent": "Mozilla/5.0",
			Accept: "application/json"
		} });
		if (!res.ok) return null;
		const meta = (await res.json()).chart?.result?.[0]?.meta;
		if (!meta) return null;
		const price = Number(meta["regularMarketPrice"]);
		const prevClose = Number(meta["chartPreviousClose"] ?? meta["previousClose"] ?? price);
		if (!Number.isFinite(price)) return null;
		return {
			price,
			currency: String(meta["currency"] ?? "EUR"),
			prevClose,
			changePct: prevClose ? (price - prevClose) / prevClose * 100 : 0
		};
	} catch {
		return null;
	}
}
var Route$1 = createFileRoute("/api/public/quote")({ server: { handlers: { GET: async ({ request }) => {
	const symbols = (new URL(request.url).searchParams.get("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 25);
	const entries = await Promise.all(symbols.map(async (s) => [s, await fetchOne(s)]));
	const out = {};
	for (const [s, q] of entries) if (q) out[s] = q;
	return Response.json(out, { headers: { "Cache-Control": "public, max-age=60" } });
} } } });
var Route = createFileRoute("/api/public/search-symbols")({ server: { handlers: { GET: async ({ request }) => {
	const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
	if (!q) return Response.json([]);
	try {
		const res = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`, { headers: {
			"User-Agent": "Mozilla/5.0",
			Accept: "application/json"
		} });
		if (!res.ok) return Response.json([]);
		const items = ((await res.json()).quotes ?? []).filter((it) => it["symbol"]).map((it) => ({
			symbol: it["symbol"],
			name: it["shortname"] ?? it["longname"] ?? it["symbol"],
			exchange: it["exchDisp"] ?? "",
			type: it["quoteType"] ?? ""
		}));
		return Response.json(items);
	} catch {
		return Response.json([]);
	}
} } } });
var rootRouteChildren = {
	IndexRoute: Route$4.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$5
	}),
	PatrimoineRoute: Route$3.update({
		id: "/patrimoine",
		path: "/patrimoine",
		getParentRoute: () => Route$5
	}),
	ProfilRoute: Route$2.update({
		id: "/profil",
		path: "/profil",
		getParentRoute: () => Route$5
	}),
	ApiPublicQuoteRoute: Route$1.update({
		id: "/api/public/quote",
		path: "/api/public/quote",
		getParentRoute: () => Route$5
	}),
	ApiPublicSearchSymbolsRoute: Route.update({
		id: "/api/public/search-symbols",
		path: "/api/public/search-symbols",
		getParentRoute: () => Route$5
	})
};
var routeTree = Route$5._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var getRouter = () => {
	const queryClient = new QueryClient();
	return createRouter({
		routeTree,
		context: { queryClient },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { requestAddAsset as A, RISK_LABELS as C, num as D, eur as E, sinceLabel as M, uid as N, pct as O, useApp as P, INCOME_KIND_LABELS as S, TYPE_LABELS as T, fetchQuote as _, AssetModal as a, project as b, maybeNotify as c, requestNotifications as d, REGION_BUCKETS as f, diversificationScore as g, assetValue as h, restoreBackup as i, signedEur as j, rawPct as k, notificationsGranted as l, assetGain as m, daysSinceBackup as n, contributionDue as o, allocationByType as p, exportBackup as r, currentMonth as s, router_exports as t, notificationsSupported as u, lookThrough as v, TARGET_ALLOCATIONS as w, totals as x, n as y };
