import { useMemo, useState } from "react";
import { ChevronRight, Pencil, Plus, Target, X } from "lucide-react";
import { useApp } from "@/lib/storage";
import { eur, rawPct } from "@/lib/format";
import {
  buildTrajectory,
  crossingYear,
  goalCurrent,
  profileGoals,
} from "@/lib/goals";
import type { Goal } from "@/lib/types";
import { TrajectoryChart, ChartLegend } from "./TrajectoryChart";
import { GoalEditor } from "./GoalEditor";

/**
 * Sur l'accueil : une carte compacte (un message : où j'en suis).
 * Le détail (trajectoire, multi-objectifs, réglages) vit dans une
 * feuille dédiée, ouverte au tap.
 */
export function GoalPanel() {
  const { profile, assets, history, saveProfile } = useApp();
  const goals = useMemo(() => profileGoals(profile), [profile]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null | "new">(null);

  const activeId = profile?.activeGoalId ?? goals[0]?.id;
  const goal = goals.find((g) => g.id === activeId) ?? goals[0];

  const persist = (next: Goal[], active?: string) => {
    if (!profile) return;
    saveProfile({
      ...profile,
      goals: next,
      activeGoalId: active ?? (next.some((g) => g.id === activeId) ? activeId : next[0]?.id) ?? "",
      goal: next[0]
        ? { amount: next[0].amount, horizon: next[0].horizon, dca: next[0].dca }
        : { amount: 0, horizon: 10, dca: 0 },
    });
  };

  const current = goal ? goalCurrent(assets, goal) : 0;
  // Bornée à [0, 100] : un patrimoine net négatif donnerait une largeur
  // CSS invalide (barre affichée pleine).
  const progress = goal?.amount
    ? Math.max(0, Math.min(100, (current / goal.amount) * 100))
    : 0;
  const rawProgress = goal?.amount ? (current / goal.amount) * 100 : 0;
  const traj = useMemo(
    () => (goal ? buildTrajectory(current, goal, history) : []),
    [current, goal, history],
  );
  const cross = goal ? crossingYear(traj, goal.amount) : undefined;

  const sentence = !goal
    ? ""
    : progress >= 100
      ? "Objectif atteint 🎉"
      : cross !== undefined && cross <= 0
        ? "À portée immédiate."
        : cross !== undefined
          ? `Atteint dans ~${cross} an${cross > 1 ? "s" : ""} à ce rythme.`
          : rawProgress < 0
            ? "Patrimoine net négatif : les crédits dépassent les actifs. Renseigne la valeur de ton bien pour une lecture juste."
            : `${rawPct(rawProgress)} du chemin parcouru.`;

  return (
    <>
      {goal ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap card-surface mt-4 block w-full p-4 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Target className="size-4 text-amber" />
              {goal.label}
            </span>
            <span className="flex items-center gap-1 num text-xs text-muted-foreground">
              {rawProgress < 0 ? "—" : rawPct(progress)}
              <ChevronRight className="size-4" />
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-amber transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{sentence}</p>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="tap card-surface mt-4 flex w-full items-center justify-between p-4 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-amber" />
            Fixe-toi un cap
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Plus className="size-3.5" /> Objectif
          </span>
        </button>
      )}

      {open && goal && (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-background">
          <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="tap flex size-9 items-center justify-center rounded-full bg-elevated"
            >
              <X className="size-4" />
            </button>
            <h2 className="font-display text-lg">Objectifs</h2>
            <button
              type="button"
              onClick={() => setEditing("new")}
              aria-label="Ajouter un objectif"
              className="tap flex size-9 items-center justify-center rounded-full bg-elevated"
            >
              <Plus className="size-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
            {goals.length > 1 && (
              <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => persist(goals, g.id)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                      g.id === goal.id
                        ? "border-primary bg-primary/12 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end justify-between">
              <div>
                <div className="font-display text-2xl">{eur(current)}</div>
                <p className="text-xs text-muted-foreground">
                  sur {eur(goal.amount)} · {rawPct(progress)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(goal)}
                className="tap flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <Pencil className="size-3" /> Ajuster
              </button>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-amber transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-5">
              <TrajectoryChart data={traj} />
            </div>
            <div className="mt-3">
              <ChartLegend />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {progress >= 100
                ? "Objectif déjà atteint. Bravo — place au suivant ?"
                : cross !== undefined && cross <= 0
                  ? "Objectif à portée immédiate."
                  : cross !== undefined
                    ? `Objectif atteint dans ~${cross} an${cross > 1 ? "s" : ""} avec ${eur(goal.dca)}/mois.`
                    : `Projection ${eur(traj[traj.length - 1]?.projection ?? 0)} dans ${goal.horizon} ans — il manque ${eur(Math.max(0, goal.amount - (traj[traj.length - 1]?.projection ?? 0)))}.`}
            </p>
          </div>
        </div>
      )}

      {editing !== null && (
        <GoalEditor
          goal={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            const exists = goals.some((x) => x.id === g.id);
            persist(exists ? goals.map((x) => (x.id === g.id ? g : x)) : [...goals, g], g.id);
            setEditing(null);
          }}
          {...(editing !== "new"
            ? {
                onDelete: (id: string) => {
                  persist(goals.filter((x) => x.id !== id));
                  setEditing(null);
                },
              }
            : {})}
        />
      )}
    </>
  );
}
