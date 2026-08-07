import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Asset } from "@/lib/types";
import { TYPE_LABELS } from "@/lib/types";

/** Ligne éditable : un actif + la clé de donnée qui porte son montant. */
interface Row {
  assetId: string;
  key: string;
  label: string;
  sub: string | undefined;
  value: string;
}

const KEY_BY_TYPE: Record<string, Array<{ key: string; sub?: string }>> = {
  av: [
    { key: "fondsEurosAmount", sub: "Fonds €" },
    { key: "ucAmount", sub: "UC" },
  ],
  livret: [{ key: "amount" }],
  cash: [{ key: "amount" }],
  autre: [{ key: "amount" }],
  immo: [{ key: "valeurEstimee", sub: "Valeur estimée" }],
  credit: [{ key: "capitalRestant", sub: "Capital restant" }],
};

/**
 * Pointage mensuel : met à jour d'un coup tous les montants saisis à la
 * main (livrets, cash, AV, immo, crédits). Les lignes cotées (PEA,
 * crypto) se rafraîchissent déjà via le bouton Actualiser.
 */
export function QuickUpdate({
  assets,
  onSave,
  onClose,
}: {
  assets: Asset[];
  onSave: (next: Asset[]) => void;
  onClose: () => void;
}) {
  const initialRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const a of assets) {
      const specs = KEY_BY_TYPE[a.type];
      if (!specs) continue;
      for (const spec of specs) {
        const current = a.data[spec.key];
        // L'UC n'apparaît que si le contrat en a déjà.
        if (spec.key === "ucAmount" && (current === undefined || current === "")) continue;
        rows.push({
          assetId: a.id,
          key: spec.key,
          label: String(a.data["name"] ?? a.data["type"] ?? TYPE_LABELS[a.type]),
          sub: spec.sub,
          value: current === undefined ? "" : String(current),
        });
      }
    }
    return rows;
  }, [assets]);

  const [rows, setRows] = useState<Row[]>(initialRows);

  const save = () => {
    const stamp = new Date().toISOString();
    const byAsset = new Map<string, Row[]>();
    for (const r of rows) {
      byAsset.set(r.assetId, [...(byAsset.get(r.assetId) ?? []), r]);
    }
    onSave(
      assets.map((a) => {
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
        return touched ? { ...a, data, updatedAt: stamp } : a;
      }),
    );
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="tap flex size-9 items-center justify-center rounded-full bg-elevated"
        >
          <X className="size-4" />
        </button>
        <h2 className="font-display text-lg">Pointage</h2>
        <div className="size-9" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Reporte les soldes de tes relevés — tout se met à jour d'un coup.
          Les lignes Bourse et crypto, elles, se rafraîchissent via Actualiser.
        </p>
        {!rows.length && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Aucune ligne à pointer : ajoute d'abord un livret, un compte, une AV,
            un bien ou un crédit.
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <li
              key={`${r.assetId}:${r.key}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{r.label}</div>
                {r.sub && <div className="text-[10px] text-muted-foreground">{r.sub}</div>}
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={r.value}
                  inputMode="decimal"
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                    )
                  }
                  className="h-10 w-28 rounded-lg border border-border bg-elevated px-2 text-right font-mono text-sm outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">€</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-card px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button
          type="button"
          onClick={save}
          disabled={!rows.length}
          className="tap w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          Tout mettre à jour
        </button>
      </footer>
    </div>
  );
}
