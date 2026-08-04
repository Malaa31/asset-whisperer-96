import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/storage";
import { totals } from "@/lib/calc";
import { profileGoals } from "@/lib/goals";
import { daysSinceBackup } from "@/lib/backup";
import { RISK_LABELS, TARGET_ALLOCATIONS, type PlanLine as ProfilePlanLine, type RiskProfile } from "@/lib/types";
import { PlanEditor, defaultLines } from "@/components/PlanEditor";
import { rawPct } from "@/lib/format";
import { eur, pct, sinceLabel } from "@/lib/format";
import { GoalPanel } from "@/components/GoalPanel";
import { fetchQuote } from "@/lib/market";
import type { Asset } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — Patrimoine" },
      {
        name: "description",
        content: "Votre patrimoine net, votre objectif et votre plan d'investissement du mois.",
      },
      { property: "og:title", content: "Accueil — Patrimoine" },
      {
        property: "og:description",
        content: "Votre patrimoine net, votre objectif et votre plan d'investissement du mois.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, assets, setAssets, saveProfile } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | undefined>(undefined);

  const t = useMemo(() => totals(assets), [assets]);
  const goals = useMemo(() => profileGoals(profile), [profile]);
  const activeGoal = goals.find((g) => g.id === profile?.activeGoalId) ?? goals[0];
  const goal = { dca: activeGoal?.dca ?? 0 };
  const backupAge = daysSinceBackup(profile);
  const needsBackup = assets.length > 0 && (backupAge === undefined || backupAge > 30);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const priced = assets.filter((a) => a.type === "pea" || a.type === "crypto");
      const quotes = await fetchQuote(priced.map((a) => String(a.data["ticker"] ?? "")));
      if (Object.keys(quotes).length) {
        const stamp = new Date().toISOString();
        const next: Asset[] = assets.map((a) => {
          const ticker = String(a.data["ticker"] ?? "");
          const q = quotes[ticker];
          if (!q) return a;
          const key = a.type === "crypto" ? "prixUnitaire" : "currentPrice";
          return { ...a, data: { ...a.data, [key]: q.price, lastPriceUpdate: stamp }, updatedAt: stamp };
        });
        setAssets(next);
        setLastUpdate(stamp);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const stamps = assets
      .map((a) => a.data["lastPriceUpdate"])
      .filter(Boolean)
      .map(String)
      .sort();
    setLastUpdate(stamps[stamps.length - 1]);
  }, [assets]);

  const risk = profile?.riskProfile ?? "equilibre";
  const custom = Boolean(profile?.planLines?.length);
  const plan = useMemo(
    () => buildPlan(profile?.planLines?.length ? profile.planLines : defaultLines(risk), goal.dca),
    [profile?.planLines, risk, goal.dca],
  );

  return (
    <div className="fade-up px-4 pt-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Bonjour</p>
          <h1 className="font-display text-2xl">{profile?.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Mode discret"
            onClick={() => profile && saveProfile({ ...profile, hideAmounts: !profile.hideAmounts })}
            className="tap flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          >
            {profile?.hideAmounts ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="tap flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {sinceLabel(lastUpdate)}
          </button>
        </div>
      </header>

      {needsBackup && (
        <div className="mt-4 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-xs text-muted-foreground">
          {backupAge === undefined
            ? "Vos données ne vivent que sur cet appareil. Pensez à exporter une sauvegarde depuis l'onglet Profil."
            : `Dernière sauvegarde il y a ${backupAge} jours. Un export rapide depuis l'onglet Profil vous met à l'abri.`}
        </div>
      )}

      <section className="card-surface mt-5 p-5">
        <p className="text-xs text-muted-foreground">Patrimoine net</p>
        <div className="mt-1 font-display text-4xl">{eur(t.net)}</div>
        {t.gain !== 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
            <TrendingUp className="size-3.5" />
            {eur(t.gain)} ({pct((t.gain / Math.max(1, t.actifs - t.gain)) * 100)})
          </div>
        )}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
          <Stat label="Actifs" value={eur(t.actifs)} />
          <Stat label="Dettes" value={eur(t.dettes)} tone="text-destructive" />
          <Stat label="Lignes" value={String(assets.length)} />
        </div>
      </section>

      <GoalPanel />

      {goal.dca > 0 && (
        <section className="mt-4 rounded-2xl border border-primary/35 bg-primary/8 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Où mettre tes {eur(goal.dca)} ce mois-ci</h2>
            <button
              type="button"
              onClick={() => setEditingPlan(true)}
              className="tap flex items-center gap-1 rounded-full border border-primary/40 px-2.5 py-1 text-[11px] font-semibold text-primary"
            >
              <Pencil className="size-3" /> Ajuster
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {custom
              ? "Votre répartition personnalisée."
              : `Plan conseillé — allocation cible du profil ${RISK_LABELS[risk].toLowerCase()} : ${TARGET_ALLOCATIONS[risk].actions} % actions · ${TARGET_ALLOCATIONS[risk].obligations} % fonds € · ${TARGET_ALLOCATIONS[risk].immo} % immo · ${TARGET_ALLOCATIONS[risk].cash} % cash.`}
          </p>
          <ul className="mt-4 space-y-3">
            {plan.map((p) => (
              <li key={p.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{p.emoji}</span>
                    <span className="truncate">{p.label}</span>
                    <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {p.tag}
                    </span>
                  </span>
                  <span className="font-mono text-sm">{eur(p.amount)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(p.amount / Math.max(1, goal.dca)) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editingPlan && profile && (
        <PlanEditor
          lines={profile.planLines}
          risk={risk}
          onClose={() => setEditingPlan(false)}
          onSave={(lines) => {
            const { planLines: _drop, ...rest } = profile;
            saveProfile(lines ? { ...rest, planLines: lines } : rest);
            setEditingPlan(false);
            toast.success(lines ? "Plan personnalisé enregistré" : "Plan conseillé rétabli");
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className={`font-mono text-sm ${tone ?? ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

interface PlanLineView {
  emoji: string;
  label: string;
  tag: string;
  amount: number;
}

function buildPlan(lines: ProfilePlanLine[], dca: number): PlanLineView[] {
  const total = lines.reduce((sum, l) => sum + Math.max(0, l.weight), 0);
  if (total <= 0) return [];
  return lines
    .filter((l) => l.weight > 0)
    .map((l) => ({
      emoji: l.emoji ?? "📈",
      label: l.label,
      tag: rawPct((l.weight / total) * 100, 0),
      amount: Math.round((dca * l.weight) / total),
    }));
}
