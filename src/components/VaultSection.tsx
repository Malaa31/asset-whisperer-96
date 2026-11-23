import { useState, type FormEvent } from "react";
import { Check, Copy, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useVault } from "@/lib/vault-sync";

export function VaultSection() {
  const vault = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [error, setError] = useState("");

  const activate = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (passphrase.length < 12)
      return setError("Choisis une phrase secrète d'au moins 12 caractères.");
    if (passphrase !== confirmation)
      return setError("Les deux phrases secrètes ne correspondent pas.");
    try {
      await vault.activate(passphrase);
      setPassphrase("");
      setConfirmation("");
      toast.success("Coffre chiffré activé");
    } catch {
      setError("Impossible d'activer le coffre. Réessaie.");
    }
  };

  const deleteRemote = async () => {
    if (
      !window.confirm(
        "Supprimer définitivement le coffre et sa copie chiffrée ? Cette action est irréversible.",
      )
    )
      return;
    try {
      await vault.deleteVault();
      setShowCode(false);
      toast.success("Coffre supprimé");
    } catch {
      setError("Suppression impossible. Réessaie.");
    }
  };

  return (
    <section className="card-surface space-y-4 p-5" aria-labelledby="vault-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h3 id="vault-title" className="text-sm font-semibold">
            Coffre chiffré
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Ta sauvegarde est chiffrée sur cet appareil avant d'être envoyée. Ta phrase secrète
            n'est jamais enregistrée ni transmise.
          </p>
        </div>
      </div>

      {vault.identity ? (
        <>
          <p
            className="rounded-xl border border-border bg-elevated p-3 text-xs leading-relaxed"
            role="status"
          >
            {statusLabel(vault.status, vault.lastSyncAt)}
          </p>
          {vault.conflict && (
            <div
              className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4"
              role="alertdialog"
              aria-labelledby="vault-conflict-title"
            >
              <h4 id="vault-conflict-title" className="text-sm font-semibold">
                Une version plus récente existe dans le coffre
              </h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Choisis quelles données garder. L'autre version sera remplacée.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void vault.resolveConflict("local")}
                  className="tap rounded-xl border border-border px-3 py-2.5 text-xs font-semibold"
                >
                  Garder ce téléphone
                </button>
                <button
                  type="button"
                  onClick={() => void vault.resolveConflict("remote")}
                  className="tap rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground"
                >
                  Prendre la version du coffre
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void vault.uploadNow()}
            className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            <ShieldCheck className="size-4" aria-hidden="true" /> Sauvegarder maintenant
          </button>
          <button
            type="button"
            onClick={() => setShowCode((value) => !value)}
            className="tap w-full rounded-xl border border-border py-3 text-sm font-semibold"
          >
            {showCode ? "Masquer le code" : "Ajouter un appareil"}
          </button>
          {showCode && vault.code && (
            <div className="space-y-2 rounded-xl border border-primary/25 bg-elevated p-3">
              <p className="text-xs font-semibold">Code de synchronisation</p>
              <code className="block break-all rounded-lg bg-background p-3 font-mono text-[11px] leading-relaxed">
                {vault.code}
              </code>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(vault.code!).then(
                    () => toast.success("Code copié"),
                    () => toast.error("Copie impossible"),
                  )
                }
                className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold"
              >
                <Copy className="size-4" aria-hidden="true" /> Copier le code
              </button>
              <p className="text-[11px] leading-relaxed text-destructive">
                Ce code et ta phrase secrète donnent accès à tes données. Partage-les uniquement
                avec un appareil de confiance.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowRestore((value) => !value)}
            className="tap w-full rounded-xl border border-border py-3 text-sm font-semibold"
          >
            Restaurer depuis le coffre
          </button>
          {showRestore && <VaultCodeForm onError={setError} />}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void vault.disableHere()}
              className="tap rounded-xl border border-border px-2 py-3 text-xs font-semibold"
            >
              Désactiver sur cet appareil
            </button>
            <button
              type="button"
              onClick={() => void deleteRemote()}
              className="tap rounded-xl border border-destructive/40 px-2 py-3 text-xs font-semibold text-destructive"
            >
              Supprimer le coffre
            </button>
          </div>
        </>
      ) : (
        <>
          <form onSubmit={(event) => void activate(event)} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">
                Phrase secrète (12 caractères minimum)
              </span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">
                Confirme ta phrase secrète
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>
                J&apos;ai noté ma phrase secrète : sans elle, la sauvegarde est irrécupérable
              </span>
            </label>
            <button
              type="submit"
              disabled={!acknowledged || passphrase.length < 12 || passphrase !== confirmation}
              className="tap w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Activer le coffre
            </button>
          </form>
          <button
            type="button"
            onClick={() => setShowRestore((value) => !value)}
            className="tap w-full rounded-xl border border-border py-3 text-sm font-semibold"
          >
            Restaurer depuis le coffre
          </button>
          {showRestore && <VaultCodeForm onError={setError} />}
        </>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function VaultCodeForm({
  onError,
  onDone,
}: {
  onError?: (error: string) => void;
  onDone?: () => void;
}) {
  const { importFromCode } = useVault();
  const [code, setCode] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const restore = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    onError?.("");
    try {
      await importFromCode(code, passphrase);
      setPassphrase("");
      onDone?.();
    } catch {
      const text = "Code ou phrase secrète invalide, ou coffre inaccessible.";
      setMessage(text);
      onError?.(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void restore(event)}
      className="space-y-3 rounded-xl border border-border bg-elevated p-3"
    >
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Code de synchronisation</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs outline-none focus:border-primary"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Phrase secrète du coffre</span>
        <input
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>
      <button
        type="submit"
        disabled={busy || !code || !passphrase}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 py-3 text-sm font-semibold disabled:opacity-40"
      >
        <Check className="size-4" aria-hidden="true" />{" "}
        {busy ? "Restauration…" : "Restaurer les données"}
      </button>
      {message && (
        <p className="text-xs text-destructive" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}

function statusLabel(status: string, lastSyncAt: string | null): string {
  if (status === "offline") return "Hors ligne, envoi plus tard";
  if (status === "syncing") return "Synchronisation en cours…";
  if (status === "error") return "Erreur de synchronisation. Réessaie.";
  if (status === "conflict") return "Choisis la version à conserver.";
  if (lastSyncAt) {
    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(lastSyncAt)) / 60_000));
    return minutes < 1
      ? "Sauvegardé dans le coffre à l'instant"
      : `Sauvegardé dans le coffre il y a ${minutes} min`;
  }
  return "Coffre activé, première sauvegarde en attente.";
}
