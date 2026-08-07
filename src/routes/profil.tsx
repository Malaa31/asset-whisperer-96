import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ChevronRight, Download, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { eur } from "@/lib/format";
import { IncomeEditor, totalIncome } from "@/components/IncomeEditor";
import { INCOME_KIND_LABELS } from "@/lib/types";
import {
  notificationsGranted,
  notificationsSupported,
  requestNotifications,
} from "@/lib/reminder";
import { useApp } from "@/lib/storage";
import { BUILD_VERSION } from "@/lib/version";
import {
  RISK_LABELS,
  TARGET_ALLOCATIONS,
  type Profile,
  type RiskProfile,
} from "@/lib/types";

import { daysSinceBackup, exportBackup, restoreBackup } from "@/lib/backup";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil — Patrimoine" },
      {
        name: "description",
        content: "Vos informations, votre profil de risque et votre objectif d'investissement.",
      },
      { property: "og:title", content: "Profil — Patrimoine" },
      {
        property: "og:description",
        content: "Vos informations, votre profil de risque et votre objectif d'investissement.",
      },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const { profile, saveProfile, reset } = useApp();
  const [importMsg, setImportMsg] = useState("");
  const [editingIncome, setEditingIncome] = useState(false);
  const [notifState, setNotifState] = useState<"granted" | "other">(
    () => (notificationsGranted() ? "granted" : "other"),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // Profil absent (premier lancement ou après réinitialisation) :
  // la page d'accueil affiche l'onboarding, rien à montrer ici.
  if (!profile) return null;

  const update = (patch: Partial<Profile>) => saveProfile({ ...profile, ...patch });

  const onImport = async (file: File) => {
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

  return (
    <div className="fade-up px-5 pt-8">
      <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">Profil</h1>

      <section className="card-surface mt-5 space-y-3 p-5">
        <Row label="Prénom" value={profile.name} onChange={(v) => update({ name: v })} />
        <Row
          label="Âge"
          value={String(profile.age || "")}
          numeric
          onChange={(v) => update({ age: Number(v) || 0 })}
        />
        <Row
          label="Profession"
          value={profile.profession}
          onChange={(v) => update({ profession: v })}
        />
      </section>

      <button
        type="button"
        onClick={() => setEditingIncome(true)}
        className="tap card-surface mt-4 flex w-full items-center justify-between p-5 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">Mes revenus</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {incomes.length
              ? incomes.map((i) => INCOME_KIND_LABELS[i.kind]).join(" · ")
              : "Salaire, locatif, dividendes…"}
          </span>
        </span>
        <span className="flex items-center gap-1 num text-xs text-muted-foreground">
          {eur(profile.incomeMonthly)}/mois
          <ChevronRight className="size-4" />
        </span>
      </button>

      <section className="card-surface mt-4 p-5">
        <h2 className="text-sm font-semibold">Profil de risque</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(Object.keys(TARGET_ALLOCATIONS) as RiskProfile[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update({ riskProfile: r })}
              className={`tap rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                profile.riskProfile === r
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {RISK_LABELS[r]}
            </button>
          ))}
        </div>
      </section>

      <section className="card-surface mt-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold">Rappel de versement</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              Un rappel en début de mois pour placer ton versement.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(profile.monthlyReminder)}
            onClick={() => void toggleReminder()}
            className={`tap relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              profile.monthlyReminder ? "bg-primary" : "bg-elevated"
            }`}
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-card shadow transition-all ${
                profile.monthlyReminder ? "left-[1.375rem]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {profile.monthlyReminder && (
          <p className="mt-3 rounded-xl bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground">
            {notifState === "granted"
              ? "Notification activée. Sur iPhone, elle n'arrive que si l'app est installée sur l'écran d'accueil (Partager → Sur l'écran d'accueil)."
              : "Le rappel s'affiche dans l'app. Pour une notification système, autorise-la ci-dessus depuis ton navigateur."}
          </p>
        )}
      </section>

      <section className="card-surface mt-4 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Vos données</h2>
          <span className="text-[10px] text-muted-foreground">{BUILD_VERSION}</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Tout est stocké sur cet appareil.{" "}
          {backupAge === undefined
            ? "Aucune sauvegarde exportée pour l'instant."
            : `Dernier export il y a ${backupAge} jour${backupAge > 1 ? "s" : ""}.`}{" "}
          Exportez un fichier pour changer d'appareil ou vous prémunir d'une perte.
        </p>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => exportBackup()}
            className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold"
          >
            <Download className="size-4" /> Exporter une sauvegarde
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold"
          >
            <Upload className="size-4" /> Importer une sauvegarde
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
          {importMsg && <p className="text-[11px] text-destructive">{importMsg}</p>}
        </div>
      </section>

      <button
        type="button"
        onClick={() => {
          if (window.confirm("Effacer toutes les données de cet appareil ? Pensez à exporter une sauvegarde avant.")) reset();
        }}
        className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3 text-sm font-semibold text-destructive"
      >
        <RotateCcw className="size-4" /> Tout réinitialiser
      </button>
    </div>
  );
}

/**
 * Champ d'édition. Les champs numériques gardent la saisie en local :
 * on peut vider le champ ou taper une virgule sans que "0" s'impose.
 */
function Row({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  const [text, setText] = useState(value);
  // Pas de resynchronisation nécessaire : les changements externes
  // (import, réinitialisation) rechargent ou démontent la page.

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        value={text}
        inputMode={numeric ? "decimal" : "text"}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (!numeric || t === "" || Number.isFinite(Number(t.replace(",", ".")))) {
            if (!(numeric && t === "")) onChange(t);
          }
        }}
        onBlur={() => {
          if (numeric && text === "") {
            onChange("0");
            setText("");
          }
        }}
        className="h-11 w-full rounded-xl border border-border bg-elevated px-3 num text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
