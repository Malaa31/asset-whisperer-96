import { i as __toESM } from "../_runtime.mjs";
import { n as require_react, r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { D as Download, i as Upload, j as ChevronRight, p as RotateCcw } from "../_libs/lucide-react.mjs";
import { D as RISK_LABELS, E as INCOME_KIND_LABELS, M as useApp, N as eur, O as TARGET_ALLOCATIONS, a as exportBackup, d as notificationsGranted, f as notificationsSupported, i as daysSinceBackup, o as restoreBackup, p as requestNotifications } from "./router-zm3Pr5My.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profil-DmC9R79a.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ProfilPage() {
	const { profile, saveProfile, reset } = useApp();
	const [importMsg, setImportMsg] = (0, import_react.useState)("");
	const [editingIncome, setEditingIncome] = (0, import_react.useState)(false);
	const [notifState, setNotifState] = (0, import_react.useState)(() => notificationsGranted() ? "granted" : "other");
	const fileRef = (0, import_react.useRef)(null);
	if (!profile) return null;
	const update = (patch) => saveProfile({
		...profile,
		...patch
	});
	const onImport = async (file) => {
		try {
			const lines = JSON.parse(await file.text())?.assets?.length ?? 0;
			if (!window.confirm(`Remplacer les données actuelles par cette sauvegarde (${lines} ligne${lines > 1 ? "s" : ""}) ?`)) return;
			await restoreBackup(file);
		} catch (e) {
			setImportMsg(e instanceof Error ? e.message : "Import impossible.");
		}
	};
	const incomes = profile.incomes ?? [];
	/** Active le rappel et tente d'obtenir la permission système. */
	const toggleReminder = async () => {
		if (profile.monthlyReminder) {
			update({ monthlyReminder: false });
			return;
		}
		update({ monthlyReminder: true });
		if (notificationsSupported() && !notificationsGranted()) {
			const ok = await requestNotifications();
			setNotifState(ok ? "granted" : "other");
		}
	};
	const backupAge = daysSinceBackup(profile);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fade-up px-5 pt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-[1.75rem] leading-tight tracking-tight",
				children: "Profil"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface mt-5 space-y-3 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Prénom",
						value: profile.name,
						onChange: (v) => update({ name: v })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Âge",
						value: String(profile.age || ""),
						numeric: true,
						onChange: (v) => update({ age: Number(v) || 0 })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Profession",
						value: profile.profession,
						onChange: (v) => update({ profession: v })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setEditingIncome(true),
				className: "tap card-surface mt-4 flex w-full items-center justify-between p-5 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-sm font-semibold",
					children: "Mes revenus"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-0.5 block text-[11px] text-muted-foreground",
					children: incomes.length ? incomes.map((i) => INCOME_KIND_LABELS[i.kind]).join(" · ") : "Salaire, locatif, dividendes…"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-1 font-mono text-xs text-muted-foreground",
					children: [
						eur(profile.incomeMonthly),
						"/mois",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface mt-4 p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold",
					children: "Profil de risque"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 grid grid-cols-2 gap-2",
					children: Object.keys(TARGET_ALLOCATIONS).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => update({ riskProfile: r }),
						className: `tap rounded-xl border px-3 py-2.5 text-xs font-semibold ${profile.riskProfile === r ? "border-primary bg-primary/12 text-primary" : "border-border text-muted-foreground"}`,
						children: RISK_LABELS[r]
					}, r))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface mt-4 p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm font-semibold",
						children: "Rappel de versement"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block text-[11px] leading-relaxed text-muted-foreground",
						children: "Un rappel en début de mois pour placer ton versement."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "switch",
						"aria-checked": Boolean(profile.monthlyReminder),
						onClick: () => void toggleReminder(),
						className: `tap relative h-7 w-12 shrink-0 rounded-full transition-colors ${profile.monthlyReminder ? "bg-primary" : "bg-elevated"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-0.5 size-6 rounded-full bg-card shadow transition-all ${profile.monthlyReminder ? "left-[1.375rem]" : "left-0.5"}` })
					})]
				}), profile.monthlyReminder && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground",
					children: notifState === "granted" ? "Notification activée. Sur iPhone, elle n'arrive que si l'app est installée sur l'écran d'accueil (Partager → Sur l'écran d'accueil)." : "Le rappel s'affiche dans l'app. Pour une notification système, autorise-la ci-dessus depuis ton navigateur."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "card-surface mt-4 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold",
						children: "Vos données"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-[11px] leading-relaxed text-muted-foreground",
						children: [
							"Tout est stocké sur cet appareil.",
							" ",
							backupAge === void 0 ? "Aucune sauvegarde exportée pour l'instant." : `Dernier export il y a ${backupAge} jour${backupAge > 1 ? "s" : ""}.`,
							" ",
							"Exportez un fichier pour changer d'appareil ou vous prémunir d'une perte."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => exportBackup(),
								className: "tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), " Exporter une sauvegarde"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => fileRef.current?.click(),
								className: "tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), " Importer une sauvegarde"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: fileRef,
								type: "file",
								accept: "application/json",
								hidden: true,
								onChange: (e) => {
									const f = e.target.files?.[0];
									if (f) onImport(f);
									e.target.value = "";
								}
							}),
							importMsg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-destructive",
								children: importMsg
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => {
					if (window.confirm("Effacer toutes les données de cet appareil ? Pensez à exporter une sauvegarde avant.")) reset();
				},
				className: "tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3 text-sm font-semibold text-destructive",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" }), " Tout réinitialiser"]
			})
		]
	});
}
/**
* Champ d'édition. Les champs numériques gardent la saisie en local :
* on peut vider le champ ou taper une virgule sans que "0" s'impose.
*/
function Row({ label, value, onChange, numeric }) {
	const [text, setText] = (0, import_react.useState)(value);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-1 block text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			value: text,
			inputMode: numeric ? "decimal" : "text",
			onChange: (e) => {
				const t = e.target.value;
				setText(t);
				if (!numeric || t === "" || Number.isFinite(Number(t.replace(",", ".")))) {
					if (!(numeric && t === "")) onChange(t);
				}
			},
			onBlur: () => {
				if (numeric && text === "") {
					onChange("0");
					setText("");
				}
			},
			className: "h-11 w-full rounded-xl border border-border bg-elevated px-3 font-mono text-sm outline-none focus:border-primary"
		})]
	});
}
//#endregion
export { ProfilPage as component };
