import { useMemo, useState } from "react";
import { Plus, Pencil, Target } from "lucide-react";
import { useApp } from "@/lib/storage";
import { eur, rawPct } from "@/lib/format";
import {
  buildTrajectory,
  crossingYear,
  goalCurrent,
  newGoal,
  profileGoals,
} from "@/lib/goals";
import type { Goal } from "@/lib/types";
import { TrajectoryChart, ChartLegend } from "./TrajectoryChart";
import { GoalEditor } from "./GoalEditor";

export function GoalPanel() {
  const { profile, assets, history, saveProfile } = useApp();
  const goals = useMemo(() => profileGoals(profile), [profile]);
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
        : profile.goal,
    });
  };

  const current = goal ? goalCurrent(assets, goal) : 0;
  const traj = useMemo(
    () => (goal ? buildTrajectory(current, goal, history) : []),
    [current, goal, history],
  );
  const cross = goal ? crossingYear(traj, goal.amount) : undefined;
  const progress = goal?.amount ? Math.min(100, (current / goal.amount) * 100) : 0;

  return (
    <section className="card-surface mt-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-amber" />
          Objectifs
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="tap flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          <Plus className="size-3" /> Ajouter
        </button>
      </div>

      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {goals.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => persist(goals, g.id)}
            className={`tap shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              g.id === goal?.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {goal && (
        <>
          <div className="mt-4 flex items-end justify-between">
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
          <div className="mt-3 flex items-center justify-between">
            <ChartLegend />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {cross !== undefined
              ? `Objectif atteint dans ~${cross} an${cross > 1 ? "s" : ""} avec ${eur(goal.dca)}/mois.`
              : `Projection ${eur(traj[traj.length - 1]?.projection ?? 0)} dans ${goal.horizon} ans — il manque ${eur(Math.max(0, goal.amount - (traj[traj.length - 1]?.projection ?? 0)))}.`}
          </p>
        </>
      )}

      {!goal && (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun objectif pour l'instant. Ajoute un objectif (patrimoine global, 100 k€ sur le PEA,
          apport maison…).
        </p>
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
    </section>
  );
}

export { newGoal };
