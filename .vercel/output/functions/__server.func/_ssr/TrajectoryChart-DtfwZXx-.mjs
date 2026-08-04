import { r as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { a as Area, d as Tooltip, i as XAxis, o as Line, r as YAxis, s as CartesianGrid, t as ComposedChart, u as ResponsiveContainer } from "../_libs/recharts+[...].mjs";
import { j as eur } from "./router-CPppA-3k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/TrajectoryChart-DtfwZXx-.js
var import_jsx_runtime = require_jsx_runtime();
var AXIS = "oklch(0.55 0.01 270)";
var GRID = "oklch(0.9 0.004 260)";
function compact(v) {
	if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1).replace(".0", "")} M€`;
	if (Math.abs(v) >= 1e3) return `${Math.round(v / 1e3)} k€`;
	return `${Math.round(v)} €`;
}
function TrajectoryChart({ data }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-56 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ComposedChart, {
				data,
				margin: {
					left: 0,
					right: 4,
					top: 8,
					bottom: 0
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
						id: "projFill",
						x1: "0",
						y1: "0",
						x2: "0",
						y2: "1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: "var(--primary)",
							stopOpacity: .18
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: "var(--primary)",
							stopOpacity: 0
						})]
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
						stroke: GRID,
						strokeDasharray: "2 6",
						vertical: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						dataKey: "label",
						tick: {
							fill: AXIS,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						minTickGap: 18
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
						width: 52,
						tick: {
							fill: AXIS,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						tickFormatter: compact
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
						cursor: {
							stroke: GRID,
							strokeWidth: 1
						},
						contentStyle: {
							background: "var(--card)",
							border: "1px solid var(--border)",
							borderRadius: 12,
							fontSize: 12,
							padding: "8px 10px"
						},
						labelStyle: {
							color: AXIS,
							marginBottom: 4
						},
						formatter: (v, name) => [eur(v), name]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
						type: "monotone",
						dataKey: "projection",
						name: "Projection",
						stroke: "var(--primary)",
						strokeWidth: 1.75,
						fill: "url(#projFill)",
						dot: false,
						activeDot: { r: 3 }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
						type: "monotone",
						dataKey: "objectif",
						name: "Objectif",
						stroke: "var(--amber)",
						strokeWidth: 1.25,
						strokeDasharray: "5 5",
						dot: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
						type: "monotone",
						dataKey: "reel",
						name: "Réel",
						stroke: "var(--foreground)",
						strokeWidth: 2,
						dot: {
							r: 3,
							fill: "var(--foreground)",
							stroke: "none"
						},
						connectNulls: true
					})
				]
			})
		})
	});
}
//#endregion
export { TrajectoryChart };
