/** Liste compacte des erreurs d'un jeu (par défaut dev) pour une source. npx tsx scripts/ocr/errors.ts credit-agricole */
import { evaluate } from "./evaluate";
const [broker, set = "dev"] = process.argv.slice(2);
const { evaluations } = await evaluate({
  sets: [set as "dev"],
  ...(broker ? { broker } : {}),
  quiet: true,
});
for (const e of evaluations)
  for (const s of e.scores.filter((x) => !x.ok))
    console.log(
      `${e.entry.id}\t${s.field}\t${(s.position ?? "").slice(0, 28)}\tattendu ${JSON.stringify(s.expected)}\tlu ${JSON.stringify(s.got)}`,
    );
