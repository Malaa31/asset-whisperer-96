import { i as __toESM } from "../_runtime.mjs";
import { n as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { c as Pie, l as Cell, n as PieChart, u as ResponsiveContainer } from "../_libs/recharts+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { C as Info, a as TrendingUp, h as Plus, j as ChevronRight, k as ClipboardCheck, m as RefreshCw, o as TrendingDown, t as X, y as Minus } from "../_libs/lucide-react.mjs";
import { C as n, I as rawPct, L as signedEur, M as useApp, N as eur, P as num, S as lookThrough, T as totals, _ as assetValue, b as foreignCurrencyAssets, g as assetGain, h as allocationByType, k as TYPE_LABELS, m as REGION_BUCKETS, s as AssetModal, v as canConvert, x as fxSnapshot, y as diversificationScore } from "./router-zm3Pr5My.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/patrimoine-uBpy8jgo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var KEY_BY_TYPE = {
	av: [{
		key: "fondsEurosAmount",
		sub: "Fonds €"
	}, {
		key: "ucAmount",
		sub: "UC"
	}],
	livret: [{ key: "amount" }],
	cash: [{ key: "amount" }],
	autre: [{ key: "amount" }],
	immo: [{
		key: "valeurEstimee",
		sub: "Valeur estimée"
	}],
	credit: [{
		key: "capitalRestant",
		sub: "Capital restant"
	}]
};
/**
* Pointage mensuel : met à jour d'un coup tous les montants saisis à la
* main (livrets, cash, AV, immo, crédits). Les lignes cotées (PEA,
* crypto) se rafraîchissent déjà via le bouton Actualiser.
*/
function QuickUpdate({ assets, onSave, onClose }) {
	const initialRows = (0, import_react.useMemo)(() => {
		const rows = [];
		for (const a of assets) {
			const specs = KEY_BY_TYPE[a.type];
			if (!specs) continue;
			for (const spec of specs) {
				const current = a.data[spec.key];
				if (spec.key === "ucAmount" && (current === void 0 || current === "")) continue;
				rows.push({
					assetId: a.id,
					key: spec.key,
					label: String(a.data["name"] ?? a.data["type"] ?? TYPE_LABELS[a.type]),
					sub: spec.sub,
					value: current === void 0 ? "" : String(current)
				});
			}
		}
		return rows;
	}, [assets]);
	const [rows, setRows] = (0, import_react.useState)(initialRows);
	const save = () => {
		const stamp = (/* @__PURE__ */ new Date()).toISOString();
		const byAsset = /* @__PURE__ */ new Map();
		for (const r of rows) byAsset.set(r.assetId, [...byAsset.get(r.assetId) ?? [], r]);
		onSave(assets.map((a) => {
			const changes = byAsset.get(a.id);
			if (!changes) return a;
			const data = { ...a.data };
			let touched = false;
			for (const r of changes) {
				const parsed = Number(r.value.replace(",", "."));
				const next = r.value === "" || !Number.isFinite(parsed) ? 0 : parsed;
				if (next !== Number(data[r.key] ?? 0)) {
					data[r.key] = next;
					touched = true;
				}
			}
			return touched ? {
				...a,
				data,
				updatedAt: stamp
			} : a;
		}));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between border-b border-border bg-card px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						"aria-label": "Fermer",
						className: "tap flex size-9 items-center justify-center rounded-full bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg",
						children: "Pointage"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-9" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto px-4 py-4 pb-28",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs leading-relaxed text-muted-foreground",
						children: "Reporte les soldes de tes relevés — tout se met à jour d'un coup. Les lignes Bourse et crypto, elles, se rafraîchissent via Actualiser."
					}),
					!rows.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-6 text-center text-sm text-muted-foreground",
						children: "Aucune ligne à pointer : ajoute d'abord un livret, un compte, une AV, un bien ou un crédit."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 space-y-2",
						children: rows.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate text-sm",
									children: r.label
								}), r.sub && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] text-muted-foreground",
									children: r.sub
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: r.value,
									inputMode: "decimal",
									onChange: (e) => setRows((rs) => rs.map((x, j) => j === i ? {
										...x,
										value: e.target.value
									} : x)),
									className: "h-10 w-28 rounded-lg border border-border bg-elevated px-2 text-right font-mono text-sm outline-none focus:border-primary"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: "€"
								})]
							})]
						}, `${r.assetId}:${r.key}`))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "sticky bottom-0 border-t border-border bg-card px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: save,
					disabled: !rows.length,
					className: "tap w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40",
					children: "Tout mettre à jour"
				})
			})
		]
	});
}
/** Palette système (type iOS). */
var TYPE_COLORS = {
	pea: "#007AFF",
	av: "#AF52DE",
	livret: "#FFCC00",
	immo: "#FF9500",
	crypto: "#5856D6",
	cash: "#5AC8FA",
	autre: "#8E8E93",
	credit: "#FF3B30"
};
var REGION_COLORS = {
	"États-Unis": "#007AFF",
	Europe: "#5AC8FA",
	Émergents: "#AF52DE",
	Japon: "#FF9500",
	"Autres dév.": "#8E8E93",
	Commodities: "#FFCC00",
	"Fonds €": "#34C759"
};
function scoreTone(v) {
	if (v >= 55) return "text-primary";
	if (v >= 30) return "text-amber";
	return "text-destructive";
}
function scoreText(v) {
	if (v >= 75) return "Excellent";
	if (v >= 55) return "Bon";
	if (v >= 30) return "Moyen";
	return "Faible";
}
/**
* Une seule carte pour comprendre où va l'argent : répartition par
* classe d'actif ou par zone géographique (en transparence des ETF),
* plus le score de diversification correspondant.
*/
function AllocationCard({ assets }) {
	const [view, setView] = (0, import_react.useState)("classes");
	const [showInfo, setShowInfo] = (0, import_react.useState)(false);
	const byType = (0, import_react.useMemo)(() => allocationByType(assets), [assets]);
	const byRegion = (0, import_react.useMemo)(() => {
		const lt = lookThrough(assets);
		return REGION_BUCKETS.filter((r) => lt[r] > .5).map((r) => ({
			key: r,
			value: lt[r],
			color: REGION_COLORS[r] ?? "#8E8E93"
		})).sort((a, b) => b.value - a.value);
	}, [assets]);
	const score = (0, import_react.useMemo)(() => diversificationScore(assets), [assets]);
	const slices = view === "classes" ? byType.map((x) => ({
		key: TYPE_LABELS[x.type],
		value: x.value,
		color: TYPE_COLORS[x.type]
	})) : byRegion;
	const total = slices.reduce((s, x) => s + x.value, 0);
	const value = view === "classes" ? score.classes : score.regions;
	if (!byType.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "card-surface mt-4 overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-1 border-b border-border bg-elevated p-1",
			children: ["classes", "regions"].map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setView(v),
				className: `rounded-lg py-2 text-xs font-semibold transition-colors ${view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`,
				children: v === "classes" ? "Par classe" : "Par région"
			}, v))
		}), total <= 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "p-5 text-sm text-muted-foreground",
			children: "Ajoute une ligne bourse ou une assurance vie pour voir ta répartition géographique."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative size-[124px] shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PieChart, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pie, {
								data: slices,
								dataKey: "value",
								nameKey: "key",
								innerRadius: "64%",
								outerRadius: "100%",
								paddingAngle: 2,
								strokeWidth: 0,
								isAnimationActive: false,
								children: slices.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, { fill: x.color }, x.key))
							}) })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pointer-events-none absolute inset-0 flex flex-col items-center justify-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-muted-foreground",
								children: "Total"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-sm",
								children: eur(total)
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "min-w-0 flex-1 space-y-2",
						children: slices.slice(0, 6).map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-2 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex min-w-0 items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "size-2.5 shrink-0 rounded-full",
									style: { backgroundColor: x.color }
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate",
									children: x.key
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 font-mono text-muted-foreground",
								children: rawPct(x.value / total * 100, 0)
							})]
						}, x.key))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 flex items-center justify-between border-t border-border pt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-1.5 text-sm font-semibold",
						children: ["Diversification", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": "Comment ce score est calculé",
							onClick: () => setShowInfo((s) => !s),
							className: `tap flex size-5 items-center justify-center rounded-full ${showInfo ? "bg-primary/12 text-primary" : "bg-elevated text-muted-foreground"}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-3" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-baseline gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `font-display text-xl ${scoreTone(value)}`,
							children: value
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] text-muted-foreground",
							children: ["/100 · ", scoreText(value)]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2.5 h-1.5 overflow-hidden rounded-full bg-elevated",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full rounded-full bg-primary transition-all duration-500",
						style: { width: `${value}%` }
					})
				}),
				showInfo && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground",
					children: ["Indice de Herfindahl-Hirschman normalisé : 100 = réparti à parts égales, 0 = tout concentré sur une seule case.", view === "regions" && " Les ETF sont éclatés en transparence selon leur zone d'exposition réelle."]
				})
			]
		})]
	});
}
var mean = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
/** Rendements mensuels successifs. */
function monthlyReturns(points) {
	const out = [];
	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1].c;
		const cur = points[i].c;
		if (prev > 0) out.push(cur / prev - 1);
	}
	return out;
}
function computeMetrics(points) {
	if (points.length < 24) return null;
	const first = points[0];
	const last = points[points.length - 1];
	const years = (last.t - first.t) / 315576e5;
	if (years < 1.5 || first.c <= 0) return null;
	const cagr = (Math.pow(last.c / first.c, 1 / years) - 1) * 100;
	const rets = monthlyReturns(points);
	const m = mean(rets);
	const variance = mean(rets.map((r) => (r - m) ** 2));
	const volatility = Math.sqrt(variance) * Math.sqrt(12) * 100;
	let peak = first.c;
	let maxDrawdown = 0;
	for (const p of points) {
		if (p.c > peak) peak = p.c;
		const dd = (p.c / peak - 1) * 100;
		if (dd < maxDrawdown) maxDrawdown = dd;
	}
	const longMa = mean(points.slice(-12).map((p) => p.c));
	const vsLongMa = longMa > 0 ? (last.c / longMa - 1) * 100 : 0;
	const twelveAgo = points[points.length - 13]?.c;
	const last12m = twelveAgo && twelveAgo > 0 ? (last.c / twelveAgo - 1) * 100 : 0;
	const high = Math.max(...points.map((p) => p.c));
	const fromHigh = high > 0 ? (last.c / high - 1) * 100 : 0;
	return {
		years,
		cagr,
		volatility,
		maxDrawdown,
		riskAdjusted: volatility > 0 ? cagr / volatility : 0,
		vsLongMa,
		last12m,
		fromHigh
	};
}
/**
* Signal de tendance.
* Au-dessus de la moyenne longue et proche des sommets : la tendance
* porte, on renforce. Nettement en dessous : on allège. Entre les deux,
* on ne bouge pas — l'inaction est un choix valable.
*/
function signalOf(m) {
	if (m.vsLongMa > 3 && m.last12m > 0) return {
		signal: "renforcer",
		reason: m.fromHigh > -5 ? "Tendance haussière, cours proche de son plus haut." : "Cours au-dessus de sa moyenne 12 mois, dynamique positive."
	};
	if (m.vsLongMa < -5) return {
		signal: "alleger",
		reason: m.fromHigh < -20 ? "Sous sa moyenne 12 mois et loin de son sommet." : "Cours passé sous sa moyenne 12 mois."
	};
	return {
		signal: "conserver",
		reason: "Cours proche de sa moyenne 12 mois, sans tendance nette."
	};
}
/**
* Pondérations par profil : un prudent privilégie la régularité, un
* offensif la performance brute et la dynamique.
*/
var WEIGHTS = {
	prudent: {
		perf: .2,
		risk: .6,
		trend: .2
	},
	equilibre: {
		perf: .35,
		risk: .4,
		trend: .25
	},
	dynamique: {
		perf: .45,
		risk: .25,
		trend: .3
	},
	offensif: {
		perf: .55,
		risk: .1,
		trend: .35
	}
};
/** Ramène une valeur à une échelle 0-100 entre deux bornes. */
function scale(value, low, high) {
	if (high === low) return 50;
	return Math.max(0, Math.min(100, (value - low) / (high - low) * 100));
}
function scoreOf(m, profile) {
	const w = WEIGHTS[profile] ?? WEIGHTS.equilibre;
	const perf = scale(m.cagr, 0, 15);
	const risk = scale(-m.volatility, -35, -5);
	const trend = scale(m.vsLongMa, -15, 15);
	return Math.round(perf * w.perf + risk * w.risk + trend * w.trend);
}
function analyze(symbol, points, profile) {
	const m = computeMetrics(points);
	if (!m) return null;
	const { signal, reason } = signalOf(m);
	return {
		...m,
		symbol,
		signal,
		reason,
		score: scoreOf(m, profile)
	};
}
var SIGNAL_LABELS = {
	renforcer: "Renforcer",
	conserver: "Conserver",
	alleger: "Alléger"
};
var SIGNAL_STYLE = {
	renforcer: {
		cls: "text-primary bg-primary/10",
		Icon: TrendingUp
	},
	conserver: {
		cls: "text-muted-foreground bg-elevated",
		Icon: Minus
	},
	alleger: {
		cls: "text-destructive bg-destructive/10",
		Icon: TrendingDown
	}
};
/**
* Valeurs du mois.
*
* Le classement ne porte que sur les lignes déjà détenues : aucune
* valeur extérieure n'est suggérée. Cinq au maximum, ordonnées par un
* score qui combine performance lissée, risque et tendance, pondéré
* selon le profil de l'utilisateur.
*/
function MonthlyPicks() {
	const { assets, profile } = useApp();
	const [rows, setRows] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [showMethod, setShowMethod] = (0, import_react.useState)(false);
	const tracked = (0, import_react.useMemo)(() => assets.filter((a) => (a.type === "pea" || a.type === "crypto") && String(a.data["ticker"] ?? "").trim()), [assets]);
	const risk = profile?.riskProfile ?? "equilibre";
	(0, import_react.useEffect)(() => {
		if (!tracked.length) {
			setRows([]);
			return;
		}
		let cancelled = false;
		setLoading(true);
		Promise.all(tracked.map(async (asset) => {
			try {
				const symbol = String(asset.data["ticker"]);
				const res = await fetch(`/api/public/history?symbol=${encodeURIComponent(symbol)}`);
				if (!res.ok) return null;
				const analysis = analyze(symbol, (await res.json()).points ?? [], risk);
				return analysis ? {
					asset,
					analysis,
					value: assetValue(asset)
				} : null;
			} catch {
				return null;
			}
		})).then((results) => {
			if (cancelled) return;
			const list = results.filter((r) => r !== null);
			list.sort((a, b) => b.analysis.score - a.analysis.score);
			setRows(list.slice(0, 5));
			setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [tracked, risk]);
	if (rows !== null && !rows.length && !loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "card-surface mt-4 p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-sm font-semibold",
			children: "Valeurs du mois"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-[13px] leading-relaxed text-muted-foreground",
			children: tracked.length ? "Historique insuffisant sur tes lignes : il faut au moins deux ans de cotation pour calculer une performance lissée." : "Ajoute des lignes bourse ou crypto avec leur ticker pour voir leurs indicateurs."
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "card-surface mt-4 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "flex items-center gap-1.5 text-sm font-semibold",
					children: ["Valeurs du mois", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Méthode de calcul",
						onClick: () => setShowMethod((s) => !s),
						className: `tap flex size-5 items-center justify-center rounded-full ${showMethod ? "bg-primary/12 text-primary" : "bg-elevated text-muted-foreground"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-3" })
					})]
				}), loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5 animate-spin text-muted-foreground" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-[11px] text-muted-foreground",
				children: [
					"Tes propres lignes, classées selon ton profil ",
					risk,
					"."
				]
			}),
			showMethod && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground",
				children: "Score composite sur trois dimensions, calculées depuis le début de l'historique disponible : performance annualisée lissée, risque (volatilité et pire baisse), tendance (position du cours face à sa moyenne 12 mois). Les pondérations suivent ton profil — un profil prudent valorise la régularité, un profil offensif la performance. Ces indicateurs décrivent le passé, ne prédisent rien et ne constituent pas un conseil en investissement."
			}),
			loading && !rows && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 space-y-2",
				children: [
					0,
					1,
					2
				].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-16 animate-pulse rounded-xl bg-elevated" }, i))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 space-y-2.5",
				children: (rows ?? []).map(({ asset, analysis, value }, i) => {
					const style = SIGNAL_STYLE[analysis.signal];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-xl border border-border bg-card p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex min-w-0 items-start gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground",
										children: i + 1
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-[13px] font-semibold",
											children: String(asset.data["name"] ?? analysis.symbol)
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-[11px] text-muted-foreground",
											children: [
												eur(value),
												" · ",
												analysis.years.toFixed(0),
												" ans d'historique"
											]
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: `flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${style.cls}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(style.Icon, { className: "size-3" }), SIGNAL_LABELS[analysis.signal]]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Perf/an",
										value: `${analysis.cagr.toFixed(1)} %`
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Volatilité",
										value: `${analysis.volatility.toFixed(0)} %`
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
										label: "Score",
										value: String(analysis.score),
										strong: true
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] leading-snug text-muted-foreground",
								children: analysis.reason
							})
						]
					}, asset.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-[10px] leading-relaxed text-muted-foreground",
				children: "Indicateurs calculés sur l'historique passé. Ils ne préjugent pas des performances futures et ne constituent pas un conseil en investissement."
			})
		]
	});
}
function Stat({ label, value, strong }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `font-mono text-[13px] ${strong ? "font-bold text-primary" : ""}`,
		children: value
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "text-[10px] text-muted-foreground",
		children: label
	})] });
}
function Patrimoine() {
	const { assets, upsertAsset, removeAsset, setAssets } = useApp();
	const [side, setSide] = (0, import_react.useState)("actifs");
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [creating, setCreating] = (0, import_react.useState)(false);
	const [pointing, setPointing] = (0, import_react.useState)(false);
	const foreign = (0, import_react.useMemo)(() => foreignCurrencyAssets(assets), [assets]);
	const fx = fxSnapshot();
	const converted = (0, import_react.useMemo)(() => assets.filter((a) => {
		const c = String(a.data["currency"] ?? "EUR").toUpperCase();
		return c !== "EUR" && canConvert(c);
	}), [assets]);
	const t = (0, import_react.useMemo)(() => totals(assets), [assets]);
	const list = assets.filter((a) => side === "passifs" ? a.type === "credit" : a.type !== "credit");
	const filtered = filter === "all" ? list : list.filter((a) => a.type === filter);
	const types = Array.from(new Set(list.map((a) => a.type)));
	const groups = types.filter((ty) => filter === "all" || ty === filter).map((ty) => ({
		type: ty,
		items: filtered.filter((a) => a.type === ty)
	})).filter((g) => g.items.length);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fade-up px-5 pt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-[1.75rem] leading-tight tracking-tight",
					children: "Patrimoine"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setPointing(true),
					className: "tap flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipboardCheck, { className: "size-3.5" }), " Pointage"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-elevated p-1",
				children: ["actifs", "passifs"].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => {
						setSide(s);
						setFilter("all");
					},
					className: `rounded-xl py-2.5 text-xs font-semibold transition-colors ${side === s ? "bg-card text-foreground" : "text-muted-foreground"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "capitalize",
						children: s
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `font-mono text-sm ${s === "passifs" ? "text-destructive" : ""}`,
						children: eur(s === "actifs" ? t.actifs : t.dettes)
					})]
				}, s))
			}),
			foreign.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-[11px] leading-relaxed text-muted-foreground",
				children: [
					foreign.length,
					" ligne",
					foreign.length > 1 ? "s" : "",
					" dans une devise sans taux connu (",
					[...new Set(foreign.map((a) => String(a.data["currency"])))].join(", "),
					") : ces montants sont comptés tels quels. Saisis la valeur en euros pour un patrimoine net juste."
				]
			}),
			converted.length > 0 && fx?.date && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-[11px] text-muted-foreground",
				children: [
					converted.length,
					" ligne",
					converted.length > 1 ? "s" : "",
					" convertie",
					converted.length > 1 ? "s" : "",
					" en euros au taux BCE du",
					" ",
					new Date(fx.date).toLocaleDateString("fr-FR"),
					"."
				]
			}),
			side === "actifs" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AllocationCard, { assets }),
			side === "actifs" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonthlyPicks, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4",
				children: ["all", ...types].map((ty) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFilter(ty),
					className: `shrink-0 rounded-full border px-3 py-1.5 text-xs ${filter === ty ? "border-primary bg-primary/12 text-primary" : "border-border text-muted-foreground"}`,
					children: ty === "all" ? "Tout" : TYPE_LABELS[ty]
				}, ty))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 space-y-6",
				children: [groups.map((g) => {
					const sub = g.items.reduce((s, a) => s + Math.abs(assetValue(a)), 0);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-baseline justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold",
							children: TYPE_LABELS[g.type]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs text-muted-foreground",
							children: eur(sub)
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: g.items.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetRow, {
							asset: a,
							onOpen: () => setEditing(a)
						}, a.id))
					})] }, g.type);
				}), !groups.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "py-10 text-center text-sm text-muted-foreground",
					children: "Aucune ligne pour l'instant."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setCreating(true),
				className: "tap mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Ajouter"]
			}),
			(editing || creating) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetModal, {
				asset: editing,
				onClose: () => {
					setEditing(null);
					setCreating(false);
				},
				onSave: (a) => {
					upsertAsset(a);
					setEditing(null);
					setCreating(false);
					toast.success(editing ? "Ligne enregistrée" : "Ligne ajoutée");
				},
				onDelete: (id) => {
					removeAsset(id);
					setEditing(null);
				}
			}),
			pointing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuickUpdate, {
				assets,
				onClose: () => setPointing(false),
				onSave: (next) => {
					setAssets(next);
					setPointing(false);
					toast.success("Montants mis à jour");
				}
			})
		]
	});
}
function AssetRow({ asset, onOpen }) {
	const value = assetValue(asset);
	const gain = assetGain(asset);
	const d = asset.data;
	let tags = [];
	if (asset.type === "pea") {
		if (d["envelope"]) tags.push(String(d["envelope"]));
		tags.push(`${num(n(d["quantity"]), 0)} × ${num(n(d["currentPrice"]) || n(d["pru"]))} €`);
	} else if (asset.type === "av") {
		if (d["dateOuverture"]) tags.push(`ouvert ${d["dateOuverture"]}`);
		tags.push(`Fonds € ${eur(n(d["fondsEurosAmount"]))}`);
	} else if (asset.type === "livret") {
		if (d["taux"]) tags.push(`${num(n(d["taux"]))} %`);
	} else if (asset.type === "crypto") tags.push(`${num(n(d["quantity"]), 4)} × ${num(n(d["prixUnitaire"]))} €`);
	else if (asset.type === "credit") {
		tags.push(`${eur(n(d["mensualite"]))}/mois`);
		if (d["taux"]) tags.push(`${num(n(d["taux"]))} %`);
	} else if (asset.type === "immo" && d["loyer"]) tags.push(`loyer ${eur(n(d["loyer"]))}`);
	tags = tags.slice(0, 1);
	const rembourse = asset.type === "credit" && n(d["capitalInitial"]) ? (n(d["capitalInitial"]) - n(d["capitalRestant"])) / n(d["capitalInitial"]) * 100 : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onOpen,
		className: "tap card-surface flex w-full flex-col gap-2 px-4 py-3 text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate text-sm font-semibold",
						children: String(d["name"] ?? d["type"] ?? d["ticker"] ?? "Ligne")
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-0.5 truncate font-mono text-[11px] text-muted-foreground",
						children: tags.join(" · ")
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "shrink-0 text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `font-mono text-sm ${asset.type === "credit" ? "text-destructive" : ""}`,
						children: eur(Math.abs(value))
					}), gain !== 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `font-mono text-[11px] ${gain >= 0 ? "text-primary" : "text-destructive"}`,
						children: signedEur(gain)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 shrink-0 text-muted-foreground" })
			]
		}), rembourse !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-1.5 overflow-hidden rounded-full bg-elevated",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-full rounded-full bg-primary transition-all duration-700",
				style: { width: `${Math.max(0, Math.min(100, rembourse))}%` }
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-1 text-[10px] text-muted-foreground",
			children: [rawPct(rembourse), " remboursé"]
		})] })]
	});
}
//#endregion
export { Patrimoine as component };
