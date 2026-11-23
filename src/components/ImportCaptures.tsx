import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, FileImage, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ImportCaptureReview,
  type PositionDraft,
  type SavingsDraft,
} from "@/components/ImportCaptureReview";
import {
  applyImportDecisions,
  controlsForExtraction,
  matchPosition,
  matchSavingsAccount,
  parseFrenchNumber,
  type Envelope,
  type ImportDecision,
  type ImportExtraction,
  type PositionLine,
  type SavingsLine,
} from "@/lib/import-positions";
import { useApp, uid } from "@/lib/storage";
import type { Asset } from "@/lib/types";

const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const PRIVACY_NOTE =
  "Les captures sont analysées par une IA via ta passerelle Vercel, sans conservation des données, puis oubliées. Rien n'est enregistré sans ta validation.";
type Capture = { name: string; dataUrl: string; size: number };
type SearchHit = { symbol: string; name: string; exchange?: string; type?: string };

export function ImportCaptures({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { assets, setAssets } = useApp();
  const [kind, setKind] = useState<"titres" | "solde">("titres");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [extraction, setExtraction] = useState<ImportExtraction | null>(null);
  const [positionRows, setPositionRows] = useState<PositionDraft[]>([]);
  const [savingsRow, setSavingsRow] = useState<SavingsDraft | null>(null);
  const [stage, setStage] = useState<"choose" | "review">("choose");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<Record<string, SearchHit[]>>({});

  const absentAssets = useMemo(() => {
    const captured = new Set(positionRows.map((row) => row.assetId).filter(Boolean));
    return assets.filter((asset) => asset.type === "pea" && !captured.has(asset.id));
  }, [assets, positionRows]);
  const reviewLines: PositionLine[] = positionRows.map((row) => ({
    nom: row.nom,
    isin: row.isin || null,
    ticker: row.ticker || null,
    quantite: parseFrenchNumber(row.quantite),
    pru: parseFrenchNumber(row.pru),
    cours: parseFrenchNumber(row.cours),
    valeur: row.valeur,
    devise: row.devise || null,
    confiance: row.confiance,
  }));
  const positionControls =
    extraction?.kind === "titres"
      ? controlsForExtraction({ ...extraction, lignes: reviewLines })
      : [];
  const savingsControls = extraction?.kind === "solde" ? controlsForExtraction(extraction) : [];
  const hasSelectedRows =
    extraction?.kind === "titres"
      ? positionRows.some((row) => row.action !== "ignore")
      : Boolean(savingsRow && savingsRow.action !== "ignore");
  const validRows =
    extraction?.kind === "titres"
      ? positionRows.every((row) => {
          if (row.action === "ignore") return true;
          const quantity = parseFrenchNumber(row.quantite);
          return (
            row.nom.trim().length > 0 &&
            quantity !== null &&
            quantity > 0 &&
            (row.action !== "update" || Boolean(row.assetId))
          );
        })
      : Boolean(
          savingsRow &&
          (savingsRow.action === "ignore" ||
            (parseFrenchNumber(savingsRow.solde) !== null &&
              parseFrenchNumber(savingsRow.solde)! >= 0 &&
              (savingsRow.action !== "update" || Boolean(savingsRow.assetId)))),
        );

  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCaptures([]);
      setExtraction(null);
      setPositionRows([]);
      setSavingsRow(null);
      setStage("choose");
      setMessage("");
      setSearchHits({});
    }
  };

  const selectCaptures = async (files: FileList | null) => {
    setMessage("");
    if (!files?.length) return;
    if (files.length > 4) {
      setMessage("Choisis au maximum quatre captures.");
      return;
    }
    setBusy(true);
    try {
      const compressed: Capture[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/"))
          throw new Error("Un fichier sélectionné n'est pas une image.");
        const image = await compressCapture(file);
        if (image.size > MAX_IMAGE_BYTES)
          throw new Error("Chaque capture doit faire au maximum 2,5 Mo après compression.");
        compressed.push(image);
      }
      if (compressed.reduce((sum, image) => sum + image.size, 0) > MAX_TOTAL_BYTES) {
        throw new Error("Le poids total des captures ne peut pas dépasser 8 Mo.");
      }
      setCaptures(compressed);
    } catch (error) {
      setCaptures([]);
      setMessage(error instanceof Error ? error.message : "Impossible de lire ces captures.");
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    if (!captures.length) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/import-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, images: captures.map((capture) => capture.dataUrl) }),
      });
      const result = (await response.json()) as ImportExtraction & { error?: string };
      if (!response.ok) throw new Error(result.error || "Analyse impossible. Réessaie plus tard.");
      setExtraction(result);
      if (result.kind === "titres") {
        const defaultEnvelope: Envelope = result.enveloppe === "CTO" ? "CTO" : "PEA";
        setPositionRows(
          result.lignes.map((line, index) => {
            const match = matchPosition(line, assets, defaultEnvelope);
            return {
              id: `line-${index}-${uid()}`,
              nom: line.nom,
              isin: line.isin ?? "",
              ticker: line.ticker ?? "",
              quantite: line.quantite === null ? "" : String(line.quantite),
              pru: line.pru == null ? "" : String(line.pru),
              cours: line.cours == null ? "" : String(line.cours),
              valeur: line.valeur ?? null,
              devise: line.devise ?? "EUR",
              confiance: line.confiance,
              enveloppe: match
                ? (String(match.data["envelope"]).toUpperCase() as Envelope)
                : defaultEnvelope,
              action: match ? "update" : "create",
              assetId: match?.id ?? "",
            };
          }),
        );
      } else {
        const line: SavingsLine = result;
        const match = matchSavingsAccount(line, assets);
        setSavingsRow({
          etablissement: line.etablissement ?? "",
          libelle: line.libelle ?? "",
          solde: line.solde === null ? "" : String(line.solde),
          date: line.date ?? "",
          confiance: line.confiance,
          action: match ? "update" : "create",
          assetId: match?.id ?? "",
        });
      }
      setCaptures([]);
      setStage("review");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Analyse impossible. Réessaie plus tard.",
      );
    } finally {
      setBusy(false);
    }
  };

  const updatePosition = (id: string, patch: Partial<PositionDraft>) => {
    setPositionRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const searchTicker = async (row: PositionDraft) => {
    setSearchingId(row.id);
    setMessage("");
    try {
      let hits: SearchHit[] = [];
      for (const query of [row.isin.trim(), row.nom.trim()].filter(Boolean)) {
        const response = await fetch(`/api/public/search-symbols?q=${encodeURIComponent(query)}`);
        if (!response.ok) continue;
        hits = (await response.json()) as SearchHit[];
        if (hits.length) break;
      }
      setSearchHits((current) => ({ ...current, [row.id]: hits }));
      if (!hits.length) setMessage(`Aucune référence trouvée pour « ${row.nom} ».`);
    } catch {
      setMessage("Recherche de référence indisponible.");
    } finally {
      setSearchingId(null);
    }
  };

  const validateImport = () => {
    if (!extraction || !validRows || !hasSelectedRows) return;
    const previousAssets = assets;
    const timestamp = new Date().toISOString();
    const decisions: ImportDecision[] =
      extraction.kind === "titres"
        ? positionRows.map((row) => ({
            kind: "titres" as const,
            action: row.action,
            ligne: {
              nom: row.nom.trim(),
              isin: row.isin.trim() || null,
              ticker: row.ticker.trim() || null,
              quantite: parseFrenchNumber(row.quantite),
              pru: parseFrenchNumber(row.pru),
              cours: parseFrenchNumber(row.cours),
              valeur: row.valeur,
              devise: row.devise.trim() || null,
              confiance: row.confiance,
            },
            enveloppe: row.enveloppe,
            ...(row.assetId ? { assetId: row.assetId } : {}),
          }))
        : savingsRow
          ? [
              {
                kind: "solde" as const,
                action: savingsRow.action,
                ligne: {
                  etablissement: savingsRow.etablissement.trim() || null,
                  libelle: savingsRow.libelle.trim() || null,
                  solde: parseFrenchNumber(savingsRow.solde),
                  date: savingsRow.date.trim() || null,
                  confiance: savingsRow.confiance,
                },
                ...(savingsRow.assetId ? { assetId: savingsRow.assetId } : {}),
              },
            ]
          : [];
    const nextAssets = applyImportDecisions(previousAssets, decisions, timestamp, uid);
    setAssets(nextAssets);
    close(false);
    toast.success("Import validé", {
      duration: 10_000,
      action: {
        label: "Annuler",
        onClick: () => {
          setAssets(previousAssets);
          toast.success("Import annulé");
        },
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="bottom"
        className="inset-x-0 bottom-0 left-1/2 flex h-[94dvh] w-full max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-t-3xl border border-border bg-background p-0"
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5 text-left">
          <SheetTitle className="pr-8 font-display text-xl">Importer depuis une capture</SheetTitle>
          <SheetDescription>
            {stage === "choose"
              ? "Analyse tes captures, puis vérifie chaque valeur avant l'enregistrement."
              : "Rien ne sera enregistré avant ta validation."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {stage === "choose" ? (
            <div className="flex flex-col gap-5">
              <Alert className="border-primary/30 bg-primary/5 text-foreground">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
                  {PRIVACY_NOTE}
                </AlertDescription>
              </Alert>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Type de capture
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={kind === "titres"}
                    onClick={() => setKind("titres")}
                    className={`tap rounded-xl border px-3 py-3 text-left text-sm font-semibold ${kind === "titres" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                  >
                    Positions PEA / CTO
                  </button>
                  <button
                    type="button"
                    aria-pressed={kind === "solde"}
                    onClick={() => setKind("solde")}
                    className={`tap rounded-xl border px-3 py-3 text-left text-sm font-semibold ${kind === "solde" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                  >
                    Solde d&apos;un livret
                  </button>
                </div>
              </fieldset>
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-card px-5 py-8 text-center transition-colors hover:bg-primary/5">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileImage className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">Choisir 1 à 4 captures</span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Jusqu&apos;à 2,5 Mo par image après compression · 8 Mo au total
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    void selectCaptures(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {busy && !extraction && (
                <p
                  className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
                  role="status"
                >
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Compression
                  des captures…
                </p>
              )}
              {captures.length > 0 && (
                <div className="flex flex-col gap-2" aria-label="Captures sélectionnées">
                  {captures.map((capture, index) => (
                    <div
                      key={`${capture.name}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                    >
                      <img
                        src={capture.dataUrl}
                        alt={`Aperçu de la capture ${index + 1}`}
                        className="size-12 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">{capture.name}</span>
                      <span className="shrink-0 num text-[11px] text-muted-foreground">
                        {formatBytes(capture.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {message && (
                <p role="alert" className="text-xs text-destructive">
                  {message}
                </p>
              )}
              <button
                type="button"
                disabled={!captures.length || busy}
                onClick={() => void analyze()}
                className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                {busy && captures.length > 0 ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {busy && captures.length > 0 ? "Analyse en cours…" : "Analyser les captures"}
              </button>
            </div>
          ) : extraction ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Vérification manuelle</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Les modifications restent locales à cette étape.
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                  <ShieldCheck className="size-3" aria-hidden="true" /> Rien d&apos;enregistré
                </span>
              </div>
              <ImportCaptureReview
                extraction={extraction}
                assets={assets}
                absentAssets={absentAssets}
                positionRows={positionRows}
                savingsRow={savingsRow}
                positionControls={positionControls}
                savingsControls={savingsControls}
                searchingId={searchingId}
                searchHits={searchHits}
                onPositionChange={updatePosition}
                onSavingsChange={(patch) =>
                  setSavingsRow((current) => (current ? { ...current, ...patch } : current))
                }
                onSearch={(row) => void searchTicker(row)}
                onSelectHit={(id, hit) => {
                  updatePosition(id, { ticker: hit.symbol });
                  setSearchHits((current) => ({ ...current, [id]: [] }));
                }}
              />
              {message && (
                <p role="alert" className="text-xs text-destructive">
                  {message}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {stage === "review" && (
          <footer className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-5">
            <button
              type="button"
              disabled={busy || !validRows || !hasSelectedRows}
              onClick={validateImport}
              className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              <Check className="size-4" aria-hidden="true" /> Valider l&apos;import
            </button>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
}

async function compressCapture(file: File): Promise<Capture> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = null;
  }
  const image = bitmap ? null : await loadImage(file);
  const width = bitmap?.width ?? image?.naturalWidth ?? 0;
  const height = bitmap?.height ?? image?.naturalHeight ?? 0;
  if (!width || !height) throw new Error("Cette image ne peut pas être décodée sur cet appareil.");
  const scale = Math.min(1, 2000 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Compression indisponible sur cet appareil.");
  context.drawImage(bitmap ?? image!, 0, 0, canvas.width, canvas.height);
  bitmap?.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Compression impossible."))),
      "image/jpeg",
      0.85,
    );
  });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Lecture impossible."));
    reader.onerror = () => reject(new Error("Lecture impossible."));
    reader.readAsDataURL(blob);
  });
  return { name: file.name, dataUrl, size: blob.size };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(source);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("Cette image ne peut pas être décodée sur cet appareil."));
    };
    image.src = source;
  });
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}
