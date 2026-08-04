import { i as __toESM } from "../_runtime.mjs";
import { n as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { C as Eye, M as CalendarCheck, P as BellRing, a as TrendingUp, f as RotateCcw, g as Pencil, j as Check, k as ChevronRight, m as Plus, o as Trash2, p as RefreshCw, s as Target, t as X, w as EyeOff, x as Info } from "../_libs/lucide-react.mjs";
import { A as requestAddAsset, D as RISK_LABELS, F as pct, I as rawPct, M as useApp, N as eur, O as TARGET_ALLOCATIONS, R as sinceLabel, T as totals, _ as assetValue, c as contributionDue, h as allocationByType, i as daysSinceBackup, j as uid, k as TYPE_LABELS, l as currentMonth, n as lastPriceUpdate, r as refreshPrices, u as maybeNotify, w as project } from "./router-DlQw_hyS.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-WQqzcfU8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var GOAL_KIND_LABELS = {
	patrimoine: "Patrimoine global",
	enveloppe: "Une enveloppe",
	immo: "Achat immobilier",
	libre: "Objectif libre"
};
var GOAL_KIND_HINTS = {
	patrimoine: "Atteindre X € de patrimoine net",
	enveloppe: "Ex. 100 000 € d'actifs sur le PEA",
	immo: "Constituer l'apport d'une maison",
	libre: "Tout autre projet chiffré"
};
var ENVELOPE_OPTIONS = [
	{
		value: "pea",
		label: "Bourse (PEA / CTO)"
	},
	{
		value: "av",
		label: "Assurance vie"
	},
	{
		value: "livret",
		label: "Livrets"
	},
	{
		value: "crypto",
		label: "Crypto"
	},
	{
		value: "immo",
		label: "Immobilier"
	},
	{
		value: "cash",
		label: "Cash"
	}
];
var LIQUID = [
	"pea",
	"av",
	"livret",
	"cash",
	"crypto"
];
/** Valeur actuelle correspondant au périmètre de l'objectif. */
function goalCurrent(assets, goal) {
	switch (goal.kind) {
		case "patrimoine": return totals(assets).net;
		case "immo": return assets.filter((a) => LIQUID.includes(a.type)).reduce((s, a) => s + assetValue(a), 0);
		case "enveloppe": {
			const scope = goal.scope;
			if (!scope) return totals(assets).net;
			return assets.filter((a) => a.type === scope).reduce((s, a) => s + assetValue(a), 0);
		}
		default: return totals(assets).net;
	}
}
/**
* Série pour le graphe : historique réel (si dispo) puis projection,
* avec la ligne d'objectif constante.
*/
function buildTrajectory(current, goal, history = []) {
	const rate = (goal.rate ?? 7.5) / 100;
	const proj = project(current, goal.dca, Math.max(1, goal.horizon), rate);
	const past = history.slice(-12).map((h) => {
		const d = new Date(h.date);
		const months = Math.round((Date.now() - d.getTime()) / 262656e4);
		return {
			annee: -months / 12,
			label: months <= 0 ? "Auj." : `-${months} m`,
			reel: h.value,
			objectif: goal.amount
		};
	}).filter((p) => p.label !== "Auj.");
	const future = proj.map((p) => ({
		annee: p.annee,
		label: p.annee === 0 ? "Auj." : `+${p.annee} an${p.annee > 1 ? "s" : ""}`,
		projection: p.valeur,
		objectif: goal.amount
	}));
	if (future[0]) future[0].reel = current;
	return [...past, ...future];
}
/** Année (entière) où la projection franchit l'objectif, sinon undefined. */
function crossingYear(points, amount) {
	return points.find((p) => (p.projection ?? 0) >= amount && amount > 0)?.annee;
}
function newGoal(kind = "patrimoine") {
	return {
		id: uid(),
		kind,
		label: kind === "immo" ? "Apport maison" : kind === "enveloppe" ? "100 000 € sur le PEA" : "Patrimoine cible",
		amount: kind === "enveloppe" ? 1e5 : kind === "immo" ? 6e4 : 5e5,
		horizon: 10,
		dca: 500,
		rate: 7.5,
		...kind === "enveloppe" ? { scope: "pea" } : {}
	};
}
/** Objectifs du profil, avec migration depuis l'ancien champ `goal`. */
function profileGoals(profile) {
	if (!profile) return [];
	if (profile.goals) return profile.goals;
	const legacy = profile.goal;
	if (!legacy) return [];
	return [{
		id: "legacy",
		kind: "patrimoine",
		label: "Patrimoine cible",
		amount: legacy.amount,
		horizon: legacy.horizon,
		dca: legacy.dca,
		rate: 7.5
	}];
}
/** Légende du graphe de trajectoire, sans dépendance à recharts. */
function ChartLegend() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap items-center gap-4",
		children: [
			{
				color: "var(--foreground)",
				label: "Réel"
			},
			{
				color: "var(--primary)",
				label: "Projection"
			},
			{
				color: "var(--amber)",
				label: "Objectif"
			}
		].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center gap-1.5 text-[11px] text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "inline-block h-0.5 w-4 rounded-full",
				style: { backgroundColor: i.color }
			}), i.label]
		}, i.label))
	});
}
var KINDS = [
	"patrimoine",
	"enveloppe",
	"immo",
	"libre"
];
function GoalEditor({ goal, onClose, onSave, onDelete }) {
	const [form, setForm] = (0, import_react.useState)(goal ?? newGoal("patrimoine"));
	const set = (patch) => setForm((f) => ({
		...f,
		...patch
	}));
	const pickKind = (k) => {
		setForm((f) => {
			const isPresetLabel = KINDS.some((kk) => newGoal(kk).label === f.label);
			const preset = newGoal(k);
			const { scope: _drop, ...rest } = f;
			return {
				...rest,
				kind: k,
				label: isPresetLabel ? preset.label : f.label,
				...k === "enveloppe" ? { scope: f.scope ?? "pea" } : {}
			};
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
						onClick: onClose,
						"aria-label": "Fermer",
						className: "tap flex size-9 items-center justify-center rounded-full bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg",
						children: goal ? "Modifier l'objectif" : "Nouvel objectif"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-9" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-28",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mb-2 block text-xs text-muted-foreground",
						children: "Type d'objectif"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-2",
						children: KINDS.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => pickKind(k),
							className: `tap rounded-xl border p-3 text-left ${form.kind === k ? "border-primary bg-primary/10" : "border-border bg-card"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-xs font-semibold",
								children: GOAL_KIND_LABELS[k]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-0.5 block text-[10px] leading-tight text-muted-foreground",
								children: GOAL_KIND_HINTS[k]
							})]
						}, k))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Nom de l'objectif",
						value: form.label,
						onChange: (v) => set({ label: v })
					}),
					form.kind === "enveloppe" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mb-1 block text-xs text-muted-foreground",
							children: "Enveloppe suivie"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: form.scope ?? "pea",
							onChange: (e) => set({ scope: e.target.value }),
							className: "h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm outline-none focus:border-primary",
							children: ENVELOPE_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: o.value,
								children: o.label
							}, o.value))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Montant cible (€)",
						numeric: true,
						value: String(form.amount),
						onChange: (v) => set({ amount: Number(v.replace(",", ".")) || 0 })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Horizon (années)",
						numeric: true,
						value: String(form.horizon),
						onChange: (v) => set({ horizon: Math.max(1, Number(v) || 1) })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Versement mensuel (€)",
						numeric: true,
						value: String(form.dca),
						onChange: (v) => set({ dca: Number(v.replace(",", ".")) || 0 })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Rendement annuel attendu (%)",
						numeric: true,
						value: String(form.rate ?? 7.5),
						onChange: (v) => set({ rate: Number(v.replace(",", ".")) || 0 })
					}),
					goal && onDelete && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => onDelete(goal.id),
						className: "tap flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" }), " Supprimer l'objectif"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sticky bottom-0 border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onSave(form),
					className: "tap w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground",
					children: "Enregistrer"
				})
			})
		]
	});
}
function Field({ label, value, onChange, numeric }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-1 block text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			value,
			inputMode: numeric ? "decimal" : "text",
			onChange: (e) => onChange(e.target.value),
			className: "h-11 w-full rounded-xl border border-border bg-elevated px-3 font-mono text-sm outline-none focus:border-primary"
		})]
	});
}
var TrajectoryChart = (0, import_react.lazy)(() => import("./TrajectoryChart-DtfwZXx-.mjs").then((m) => ({ default: m.TrajectoryChart })));
/**
* Sur l'accueil : une carte compacte (un message : où j'en suis).
* Le détail (trajectoire, multi-objectifs, réglages) vit dans une
* feuille dédiée, ouverte au tap.
*/
function GoalPanel() {
	const { profile, assets, history, saveProfile } = useApp();
	const goals = (0, import_react.useMemo)(() => profileGoals(profile), [profile]);
	const [open, setOpen] = (0, import_react.useState)(false);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const activeId = profile?.activeGoalId ?? goals[0]?.id;
	const goal = goals.find((g) => g.id === activeId) ?? goals[0];
	const persist = (next, active) => {
		if (!profile) return;
		saveProfile({
			...profile,
			goals: next,
			activeGoalId: active ?? (next.some((g) => g.id === activeId) ? activeId : next[0]?.id) ?? "",
			goal: next[0] ? {
				amount: next[0].amount,
				horizon: next[0].horizon,
				dca: next[0].dca
			} : {
				amount: 0,
				horizon: 10,
				dca: 0
			}
		});
	};
	const current = goal ? goalCurrent(assets, goal) : 0;
	const progress = goal?.amount ? Math.max(0, Math.min(100, current / goal.amount * 100)) : 0;
	const rawProgress = goal?.amount ? current / goal.amount * 100 : 0;
	const traj = (0, import_react.useMemo)(() => goal ? buildTrajectory(current, goal, history) : [], [
		current,
		goal,
		history
	]);
	const cross = goal ? crossingYear(traj, goal.amount) : void 0;
	const sentence = !goal ? "" : progress >= 100 ? "Objectif atteint 🎉" : cross !== void 0 && cross <= 0 ? "À portée immédiate." : cross !== void 0 ? `Atteint dans ~${cross} an${cross > 1 ? "s" : ""} à ce rythme.` : `${rawPct(rawProgress)} du chemin parcouru.`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		goal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setOpen(true),
			className: "tap card-surface mt-4 block w-full p-4 text-left",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Target, { className: "size-4 text-amber" }), goal.label]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-1 font-mono text-xs text-muted-foreground",
						children: [rawPct(progress), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 h-1.5 overflow-hidden rounded-full bg-elevated",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full rounded-full bg-amber transition-all duration-700",
						style: { width: `${progress}%` }
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-xs text-muted-foreground",
					children: sentence
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setEditing("new"),
			className: "tap card-surface mt-4 flex w-full items-center justify-between p-4 text-left",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Target, { className: "size-4 text-amber" }), "Fixe-toi un cap"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-1 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Objectif"]
			})]
		}),
		open && goal && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-background",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between border-b border-border bg-card px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setOpen(false),
						"aria-label": "Fermer",
						className: "tap flex size-9 items-center justify-center rounded-full bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg",
						children: "Objectifs"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setEditing("new"),
						"aria-label": "Ajouter un objectif",
						className: "tap flex size-9 items-center justify-center rounded-full bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto px-4 py-4 pb-10",
				children: [
					goals.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4",
						children: goals.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => persist(goals, g.id),
							className: `shrink-0 rounded-full border px-3 py-1.5 text-xs ${g.id === goal.id ? "border-primary bg-primary/12 text-primary" : "border-border text-muted-foreground"}`,
							children: g.label
						}, g.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-end justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-display text-2xl",
							children: eur(current)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								"sur ",
								eur(goal.amount),
								" · ",
								rawPct(progress)
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setEditing(goal),
							className: "tap flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3" }), " Ajuster"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 h-1.5 overflow-hidden rounded-full bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full rounded-full bg-amber transition-all duration-700",
							style: { width: `${progress}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-[200px] animate-pulse rounded-xl bg-elevated" }),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrajectoryChart, { data: traj })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartLegend, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-muted-foreground",
						children: progress >= 100 ? "Objectif déjà atteint. Bravo — place au suivant ?" : cross !== void 0 && cross <= 0 ? "Objectif à portée immédiate." : cross !== void 0 ? `Objectif atteint dans ~${cross} an${cross > 1 ? "s" : ""} avec ${eur(goal.dca)}/mois.` : `Projection ${eur(traj[traj.length - 1]?.projection ?? 0)} dans ${goal.horizon} ans — il manque ${eur(Math.max(0, goal.amount - (traj[traj.length - 1]?.projection ?? 0)))}.`
					})
				]
			})]
		}),
		editing !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoalEditor, {
			goal: editing === "new" ? null : editing,
			onClose: () => setEditing(null),
			onSave: (g) => {
				const exists = goals.some((x) => x.id === g.id);
				persist(exists ? goals.map((x) => x.id === g.id ? g : x) : [...goals, g], g.id);
				setEditing(null);
			},
			...editing !== "new" ? { onDelete: (id) => {
				persist(goals.filter((x) => x.id !== id));
				setEditing(null);
			} } : {}
		})
	] });
}
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
/**
* Synthèse sur l'accueil : une barre empilée et les trois premières
* classes. Le détail complet (camembert, régions, score) vit dans Actifs.
*/
function AssetSummary({ assets }) {
	const alloc = (0, import_react.useMemo)(() => allocationByType(assets), [assets]);
	const total = alloc.reduce((s, x) => s + x.value, 0);
	if (!alloc.length || total <= 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/patrimoine",
		className: "tap card-surface mt-4 flex items-center justify-between p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm font-semibold",
			children: "Ajoute tes premières lignes"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-muted-foreground" })]
	});
	const top = alloc.slice(0, 3);
	const rest = alloc.slice(3);
	const restValue = rest.reduce((s, x) => s + x.value, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/patrimoine",
		className: "tap card-surface mt-4 block p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-semibold",
					children: "Synthèse des actifs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-1 font-mono text-xs text-muted-foreground",
					children: [eur(total), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full",
				children: alloc.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
					width: `${x.value / total * 100}%`,
					backgroundColor: TYPE_COLORS[x.type]
				} }, x.type))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-4 space-y-2",
				children: [top.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-2 text-[13px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex min-w-0 items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "size-2.5 shrink-0 rounded-full",
							style: { backgroundColor: TYPE_COLORS[x.type] }
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate",
							children: TYPE_LABELS[x.type]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex shrink-0 items-baseline gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: eur(x.value)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-9 text-right font-mono text-[11px] text-muted-foreground",
							children: rawPct(x.value / total * 100, 0)
						})]
					})]
				}, x.type)), rest.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-2 text-[13px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2.5 rounded-full bg-muted-foreground/40" }),
							rest.length,
							" autre",
							rest.length > 1 ? "s" : ""
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex shrink-0 items-baseline gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: eur(restValue)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-9 text-right font-mono text-[11px]",
							children: rawPct(restValue / total * 100, 0)
						})]
					})]
				})]
			})
		]
	});
}
/**
* Éditeur de la répartition du versement mensuel.
* - null enregistré = plan conseillé (dérivé du profil de risque)
* - sinon, lignes libres avec un poids en % chacune
*/
function PlanEditor({ lines, risk, onClose, onSave }) {
	const [rows, setRows] = (0, import_react.useState)(lines?.length ? lines.map((l) => ({ ...l })) : defaultLines(risk));
	const total = rows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);
	const set = (id, patch) => setRows((rs) => rs.map((r) => r.id === id ? {
		...r,
		...patch
	} : r));
	const t = TARGET_ALLOCATIONS[risk];
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
						children: "Mon plan mensuel"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-9" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-28",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs leading-relaxed text-muted-foreground",
						children: [
							"Répartissez votre versement comme vous l'entendez : chaque ligne reçoit son poids en % du total. Le plan conseillé suit l'allocation cible de votre profil ",
							RISK_LABELS[risk].toLowerCase(),
							" (",
							t.actions,
							" % actions ·",
							" ",
							t.obligations,
							" % fonds € · ",
							t.immo,
							" % immo · ",
							t.cash,
							" % cash)."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-2",
						children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-2 rounded-xl border border-border bg-card p-2.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: r.label,
									onChange: (e) => set(r.id, { label: e.target.value }),
									placeholder: "ETF Monde, PEA…",
									className: "h-10 min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: Number.isFinite(r.weight) ? String(r.weight) : "",
										inputMode: "decimal",
										onChange: (e) => {
											const v = Number(e.target.value.replace(",", "."));
											set(r.id, { weight: Number.isFinite(v) ? v : 0 });
										},
										className: "h-10 w-14 rounded-lg border border-border bg-elevated px-2 text-right font-mono text-sm outline-none focus:border-primary"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted-foreground",
										children: "%"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Supprimer la ligne",
									onClick: () => setRows((rs) => rs.filter((x) => x.id !== r.id)),
									className: "tap flex size-9 shrink-0 items-center justify-center rounded-full text-destructive",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
								})
							]
						}, r.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setRows((rs) => [...rs, {
							id: uid(),
							label: "",
							weight: 10
						}]),
						className: "tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Ajouter une ligne"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setRows(defaultLines(risk)),
						className: "tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" }), " Revenir au plan conseillé"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: `text-center font-mono text-xs ${Math.round(total) === 100 ? "text-muted-foreground" : "text-amber"}`,
						children: [
							"Total : ",
							Math.round(total),
							" %",
							" ",
							Math.round(total) !== 100 && "— les montants seront proratisés"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "sticky bottom-0 border-t border-border bg-card px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => onSave(void 0),
						className: "tap flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground",
						children: "Plan conseillé"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => onSave(rows.filter((r) => r.label.trim() && r.weight > 0)),
						className: "tap flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground",
						children: "Enregistrer"
					})]
				})
			})
		]
	});
}
/** Plan conseillé : dérivé de l'allocation cible du profil de risque. */
function defaultLines(risk) {
	const a = TARGET_ALLOCATIONS[risk] ?? TARGET_ALLOCATIONS.equilibre;
	return [
		{
			id: uid(),
			emoji: "🌍",
			label: "ETF Monde",
			weight: Math.round(a.actions * .6)
		},
		{
			id: uid(),
			emoji: "🇪🇺",
			label: "Stoxx Europe 600",
			weight: Math.round(a.actions * .25)
		},
		{
			id: uid(),
			emoji: "🐣",
			label: "Small caps",
			weight: Math.round(a.actions * .15)
		},
		{
			id: uid(),
			emoji: "🏦",
			label: "Fonds € (AV)",
			weight: a.obligations
		},
		{
			id: uid(),
			emoji: "🏠",
			label: "SCPI / immo papier",
			weight: a.immo
		},
		{
			id: uid(),
			emoji: "💧",
			label: "Livret (précaution)",
			weight: a.cash
		}
	].filter((l) => l.weight > 0);
}
/** Feuille dédiée au plan du mois : lignes, base expliquée derrière (i), Ajuster. */
function PlanDetail({ plan, dca, profile, saveProfile, onClose }) {
	const [showInfo, setShowInfo] = (0, import_react.useState)(false);
	const [editing, setEditing] = (0, import_react.useState)(false);
	const risk = profile.riskProfile;
	const t = TARGET_ALLOCATIONS[risk];
	const custom = Boolean(profile.planLines?.length);
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
						children: "Plan du mois"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setShowInfo((v) => !v),
						"aria-label": "Comment ce plan est calculé",
						className: `tap flex size-9 items-center justify-center rounded-full ${showInfo ? "bg-primary/12 text-primary" : "bg-elevated"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto px-4 py-4 pb-28",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-end justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-display text-2xl",
							children: eur(dca)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "à répartir ce mois-ci"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setEditing(true),
							className: "tap flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3" }), " Ajuster"]
						})]
					}),
					showInfo && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground",
						children: custom ? "Répartition personnalisée : chaque ligne reçoit son poids en % du versement. « Ajuster » pour la modifier ou revenir au plan conseillé." : `Plan conseillé, dérivé de l'allocation cible de ton profil ${RISK_LABELS[risk].toLowerCase()} : ${t.actions} % actions (60 % Monde, 25 % Europe, 15 % small caps), ${t.obligations} % fonds €, ${t.immo} % immobilier papier, ${t.cash} % cash de précaution. Modifiable librement via « Ajuster ».`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-5 space-y-3",
						children: plan.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.emoji }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: p.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
										children: p.tag
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-sm",
								children: eur(p.amount)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full rounded-full bg-primary",
								style: { width: `${p.amount / Math.max(1, dca) * 100}%` }
							})
						})] }, p.label))
					})
				]
			}),
			editing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanEditor, {
				lines: profile.planLines,
				risk,
				onClose: () => setEditing(false),
				onSave: (lines) => {
					const { planLines: _drop, ...rest } = profile;
					saveProfile(lines ? {
						...rest,
						planLines: lines
					} : rest);
					setEditing(false);
					toast.success(lines ? "Plan personnalisé enregistré" : "Plan conseillé rétabli");
				}
			})
		]
	});
}
function Dashboard() {
	const { profile, assets, setAssets, saveProfile } = useApp();
	const [refreshing, setRefreshing] = (0, import_react.useState)(false);
	const [lastUpdate, setLastUpdate] = (0, import_react.useState)(void 0);
	const [planOpen, setPlanOpen] = (0, import_react.useState)(false);
	const t = (0, import_react.useMemo)(() => totals(assets), [assets]);
	const goals = (0, import_react.useMemo)(() => profileGoals(profile), [profile]);
	const dca = (goals.find((g) => g.id === profile?.activeGoalId) ?? goals[0])?.dca ?? 0;
	const due = contributionDue(profile);
	const backupAge = daysSinceBackup(profile);
	const needsBackup = assets.length > 0 && (backupAge === void 0 || backupAge > 30);
	const refresh = async () => {
		setRefreshing(true);
		try {
			const next = await refreshPrices(assets);
			if (next) {
				setAssets(next);
				setLastUpdate(lastPriceUpdate(next));
			}
		} finally {
			setRefreshing(false);
		}
	};
	(0, import_react.useEffect)(() => {
		maybeNotify(profile, dca);
	}, [profile, dca]);
	(0, import_react.useEffect)(() => {
		const stamps = assets.map((a) => a.data["lastPriceUpdate"]).filter(Boolean).map(String).sort();
		setLastUpdate(stamps[stamps.length - 1]);
	}, [assets]);
	const plan = (0, import_react.useMemo)(() => buildPlan(profile?.planLines?.length ? profile.planLines : defaultLines(profile?.riskProfile ?? "equilibre"), dca), [
		profile?.planLines,
		profile?.riskProfile,
		dca
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fade-up px-5 pt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
					children: "Bonjour"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-[1.75rem] leading-tight tracking-tight",
					children: profile?.name
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Mode discret",
						onClick: () => profile && saveProfile({
							...profile,
							hideAmounts: !profile.hideAmounts
						}),
						className: "tap flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground",
						children: profile?.hideAmounts ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => void refresh(),
						className: "tap flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `size-3.5 ${refreshing ? "animate-spin" : ""}` }), sinceLabel(lastUpdate)]
					})]
				})]
			}),
			assets.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface mt-6 p-6 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xl",
						children: "Ton patrimoine commence ici."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mx-auto mt-2 max-w-[17rem] text-[13px] leading-relaxed text-muted-foreground",
						children: "Ajoute une première ligne — un ETF, un livret, ton bien — et tout se calcule : allocation, projection, plan mensuel."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: requestAddAsset,
						className: "tap mt-5 inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Ajouter une ligne"]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface mt-6 p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
						children: "Patrimoine net"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 font-display text-[2.75rem] leading-none tracking-tight",
						children: eur(t.net)
					}),
					t.gain !== 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "size-3.5" }),
							eur(t.gain),
							" (",
							pct(t.gain / Math.max(1, t.actifs - t.gain) * 100),
							")"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-5 border-t border-border pt-4 text-[11px] text-muted-foreground",
						children: [
							"Actifs ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-foreground",
								children: eur(t.actifs)
							}),
							"  ·  ",
							"Dettes ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-destructive",
								children: eur(t.dettes)
							})
						]
					})
				]
			}),
			assets.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetSummary, { assets }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoalPanel, {}),
			due && dca > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "size-4 shrink-0 text-primary" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "min-w-0 flex-1 text-[13px] leading-snug",
						children: [
							"Versement du mois : ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold",
								children: eur(dca)
							}),
							" à placer."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							if (!profile) return;
							saveProfile({
								...profile,
								lastContribution: currentMonth()
							});
							toast.success("Versement noté pour ce mois");
						},
						className: "tap flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3" }), " Fait"]
					})
				]
			}),
			dca > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setPlanOpen(true),
				className: "tap card-surface mt-4 flex w-full items-center justify-between p-4 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarCheck, { className: "size-4 text-primary" }), "Ton plan du mois"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-1 font-mono text-xs text-muted-foreground",
					children: [eur(dca), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
				})]
			}),
			needsBackup && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-[11px] text-muted-foreground",
				children: backupAge === void 0 ? "Pense à exporter une sauvegarde (Profil → Vos données)." : `Dernière sauvegarde il y a ${backupAge} j — un export te met à l'abri (Profil).`
			}),
			planOpen && profile && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanDetail, {
				plan,
				dca,
				profile,
				saveProfile,
				onClose: () => setPlanOpen(false)
			})
		]
	});
}
function buildPlan(lines, dca) {
	const total = lines.reduce((sum, l) => sum + Math.max(0, l.weight), 0);
	if (total <= 0) return [];
	return lines.filter((l) => l.weight > 0).map((l) => ({
		emoji: l.emoji ?? "📈",
		label: l.label,
		tag: rawPct(l.weight / total * 100, 0),
		amount: Math.round(dca * l.weight / total)
	}));
}
//#endregion
export { Dashboard as component };
