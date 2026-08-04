import { solveTriangle } from "../../components/AmountTriangle";

/**
 * Trio quantité · prix unitaire · montant total.
 * Deux valeurs sur trois suffisent ; la troisième se déduit.
 * Lancer : `npx tsx src/lib/__tests__/triangle.cases.ts`
 */
const show = (v: Record<"quantity" | "price" | "total", string>) => `q=${v.quantity||"∅"} p=${v.price||"∅"} t=${v.total||"∅"}`;
let v = { quantity: "", price: "", total: "" };
// Cas 1 : quantité puis montant total → prix unitaire déduit
v = { quantity: "88", price: "", total: "" };
v = solveTriangle({ ...v, total: "5116.32" }, "total", ["quantity"]);
console.log("qté 88 + total 5116,32 →", show(v));
// Cas 2 : quantité puis prix → total déduit
v = solveTriangle({ quantity: "20", price: "150", total: "" }, "price", ["quantity"]);
console.log("qté 20 + prix 150      →", show(v));
// Cas 3 : prix puis total → quantité déduite
v = solveTriangle({ quantity: "", price: "58.14", total: "5116.32" }, "total", ["price"]);
console.log("prix 58,14 + total     →", show(v));
// Cas 4 : les trois remplis, on modifie la quantité → total recalculé
v = solveTriangle({ quantity: "100", price: "58.14", total: "5116.32" }, "quantity", ["price","total"]);
console.log("modif qté à 100        →", show(v));
// Cas 5 : une seule valeur → rien ne bouge
v = solveTriangle({ quantity: "10", price: "", total: "" }, "quantity", []);
console.log("qté seule              →", show(v));

// Contrôle automatique de cohérence : q × p doit toujours valoir t.
const checks: Array<[string, Record<"quantity" | "price" | "total", string>]> = [
  ["qté+total", solveTriangle({ quantity: "88", price: "", total: "5116.32" }, "total", ["quantity"])],
  ["qté+prix", solveTriangle({ quantity: "20", price: "150", total: "" }, "price", ["quantity"])],
  ["prix+total", solveTriangle({ quantity: "", price: "58.14", total: "5116.32" }, "total", ["price"])],
];
let bad = 0;
for (const [label, v] of checks) {
  const q = Number(v.quantity), p = Number(v.price), t = Number(v.total);
  if (!(q > 0 && p > 0 && t > 0) || Math.abs(q * p - t) > 0.5) {
    bad++;
    console.log(`  \u2717 ${label} : ${q} × ${p} ≠ ${t}`);
  }
}
console.log(bad ? `${bad} incohérence(s)` : "Cohérence q × p = total vérifiée");
if (bad) process.exitCode = 1;
