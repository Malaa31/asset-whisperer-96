import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ClipboardPaste, FileImage, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
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
import { parsePositionText } from "@/lib/position-parser";
import { applyLoanDecisions, matchLoan, parseLoanCaptures } from "@/lib/loan-import";
import {
  CAPTURE_MARKER,
  captureQuality,
  detectCaptureKind,
  dominantKind,
  needsSecondPass,
  splitCaptureText,
  type CaptureKind,
} from "@/lib/capture-kind";
import { ocrScale, prepareForOcr, type OcrVariant } from "@/lib/ocr-preprocess";
import {
  ImportLoanReview,
  isLoanDraftValid,
  loanDraftToImport,
  type LoanDraft,
} from "@/components/ImportLoanReview";
import type { Asset } from "@/lib/types";

const KIND_LABEL: Record<CaptureKind, string> = {
  titres: "positions de PEA / CTO",
  solde: "solde de livret",
  credit: "fiche de crédit",
};
const PRIVACY_NOTE =
  "Tout est analysé sur ton téléphone : la capture n'est envoyée nulle part. Rien n'est enregistré sans ta validation.";
type Capture = { name: string; dataUrl: string; size: number; file: File };
const MAX_CAPTURES = 8;
type SearchHit = { symbol: string; name: string; exchange?: string; type?: string };

export function ImportCaptures({
  open,
  onOpenChange,
  initialText,
  onInitialTextConsumed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Texte reçu du raccourci iPhone (lecture d'Apple), analysé dès l'ouverture. */
  initialText?: string | null | undefined;
  onInitialTextConsumed?: (() => void) | undefined;
}) {
  const { assets, setAssets } = useApp();
  const [kind, setKind] = useState<CaptureKind>("titres");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState<"image" | "text">("image");
  const [autoRun, setAutoRun] = useState(false);
  const [progress, setProgress] = useState("");
  const [extraction, setExtraction] = useState<ImportExtraction | null>(null);
  const [positionRows, setPositionRows] = useState<PositionDraft[]>([]);
  const [savingsRow, setSavingsRow] = useState<SavingsDraft | null>(null);
  const [loanRows, setLoanRows] = useState<LoanDraft[]>([]);
  const [loanWarnings, setLoanWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
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
  const loanMode = stage === "review" && loanRows.length > 0;
  const hasSelectedRows = loanMode
    ? loanRows.some((row) => row.action !== "ignore")
    : extraction?.kind === "titres"
      ? positionRows.some((row) => row.action !== "ignore")
      : Boolean(savingsRow && savingsRow.action !== "ignore");
  const validRows = loanMode
    ? loanRows.every(isLoanDraftValid)
    : extraction?.kind === "titres"
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
      setPastedText("");
      setInputMode("image");
      setProgress("");
      setExtraction(null);
      setPositionRows([]);
      setSavingsRow(null);
      setLoanRows([]);
      setLoanWarnings([]);
      setNotice("");
      setStage("choose");
      setMessage("");
      setSearchHits({});
    }
  };

  const selectCaptures = async (files: FileList | null) => {
    setMessage("");
    if (!files?.length) return;
    if (files.length > MAX_CAPTURES) {
      setMessage(`Choisis au maximum ${MAX_CAPTURES} captures.`);
      return;
    }
    setBusy(true);
    try {
      const compressed: Capture[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/"))
          throw new Error("Un fichier sélectionné n'est pas une image.");
        // Miniature pour l'aperçu ; la lecture se fait sur l'image d'origine, sans recompression.
        const preview = await compressCapture(file);
        compressed.push({ ...preview, file });
      }
      setCaptures(compressed);
    } catch (error) {
      setCaptures([]);
      setMessage(error instanceof Error ? error.message : "Impossible de lire ces captures.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open || !initialText) return;
    setInputMode("text");
    setPastedText(initialText);
    setAutoRun(true);
    onInitialTextConsumed?.();
  }, [open, initialText, onInitialTextConsumed]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setPastedText(text);
      else setMessage("Le presse-papiers est vide.");
    } catch {
      setMessage("Lecture du presse-papiers refusée : colle le texte à la main.");
    }
  };

  const analyze = async () => {
    if (inputMode === "image" ? !captures.length : !pastedText.trim()) return;
    setBusy(true);
    setMessage("");
    let worker: import("tesseract.js").Worker | null = null;
    try {
      let texts = splitCaptureText(pastedText);
      if (inputMode === "image") {
        const { createWorker } = await import("tesseract.js");
        worker = await createWorker("fra+eng", 1, {
          workerPath: "/ocr/worker.min.js",
          corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
          langPath: "/ocr/lang",
          gzip: false,
          logger: (event) => {
            if (event.status === "recognizing text") setProgress(`Lecture de la capture… ${Math.round(event.progress * 100)} %`);
            else setProgress("Préparation de la lecture sur ton téléphone…");
          },
        });
        const recognized: string[] = [];
        for (const capture of captures) {
          let text = (await worker.recognize(await preprocessCapture(capture.file, "standard"))).data.text;
          // Lecture douteuse (ligne incohérente, champs manquants) : second passage binarisé,
          // et l'on garde la lecture que l'analyse juge la plus cohérente.
          if (needsSecondPass(text)) {
            const retry = (await worker.recognize(await preprocessCapture(capture.file, "binarized"))).data.text;
            if (captureQuality(retry) > captureQuality(text)) text = retry;
          }
          recognized.push(text);
        }
        texts = recognized;
      }
      // Le type choisi n'est qu'un indice : on suit le vocabulaire des captures.
      const { kind: detected, others } = dominantKind(texts);
      const effectiveKind: CaptureKind = detected ?? kind;
      const notes: string[] = [];
      if (detected && detected !== kind) {
        setKind(detected);
        notes.push(`Captures reconnues comme ${KIND_LABEL[detected]} : analyse adaptée.`);
      }
      if (others) notes.push(`${others} capture(s) d'un autre type mise(s) de côté : importe-les séparément.`);
      setNotice(notes.join(" "));
      const relevant = texts.filter((text) => {
        const textKind = detectCaptureKind(text);
        return !textKind || textKind === effectiveKind;
      });

      if (effectiveKind === "credit") {
        const loans = parseLoanCaptures(relevant);
        if (!loans.prets.length) {
          setMessage(loans.avertissements[0] ?? "Aucun crédit reconnu.");
          return;
        }
        setExtraction(null);
        setLoanWarnings(loans.avertissements);
        setLoanRows(
          loans.prets.map((pret, index) => {
            const match = matchLoan(pret, assets);
            return {
              id: `loan-${index}-${uid()}`,
              pret,
              nom: match ? String(match.data["name"] ?? pret.nom) : pret.nom,
              capitalInitial: pret.capitalInitial === null ? "" : String(pret.capitalInitial),
              taux: pret.taux === null ? "" : String(pret.taux),
              dureeMois: pret.dureeMois === null ? "" : String(pret.dureeMois),
              dateDebut: pret.dateDebut ?? "",
              mensualite: pret.mensualite === null ? "" : String(pret.mensualite),
              refCapital: pret.refCapital === null ? "" : String(pret.refCapital),
              refDate: pret.refDate ?? "",
              action: match ? "update" : "create",
              assetId: match?.id ?? "",
              bienId: match ? String(match.data["bienId"] ?? "") : "",
              appliquerPaliers: Boolean(pret.paliers?.length) && !(match && match.data["paliers"]),
            };
          }),
        );
        setCaptures([]);
        setStage("review");
        return;
      }
      setLoanRows([]);
      const result = parsePositionText(relevant.join("\n"), effectiveKind);
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
      await worker?.terminate();
      setProgress("");
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

  useEffect(() => {
    if (!autoRun || inputMode !== "text" || !pastedText.trim() || busy) return;
    setAutoRun(false);
    void analyze();
    // analyze lit l'état de ce rendu : on ne relance que sur ces dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, inputMode, pastedText, busy]);

  const validateImport = () => {
    if (!validRows || !hasSelectedRows) return;
    const previousAssets = assets;
    const timestamp = new Date().toISOString();
    if (loanMode) {
      const nextAssets = applyLoanDecisions(
        previousAssets,
        loanRows.map((row) => ({
          action: row.action,
          ...(row.assetId ? { assetId: row.assetId } : {}),
          ...(row.bienId ? { bienId: row.bienId } : {}),
          appliquerPaliers: row.appliquerPaliers,
          pret: loanDraftToImport(row),
        })),
        timestamp,
        uid,
      );
      setAssets(nextAssets);
      close(false);
      toast.success("Crédits mis à jour", {
        duration: 10_000,
        action: {
          label: "Annuler",
          onClick: () => {
            setAssets(previousAssets);
            toast.success("Import annulé");
          },
        },
      });
      return;
    }
    if (!extraction) return;
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
                <div className="grid grid-cols-3 gap-2">
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
                  <button
                    type="button"
                    aria-pressed={kind === "credit"}
                    onClick={() => setKind("credit")}
                    className={`tap rounded-xl border px-3 py-3 text-left text-sm font-semibold ${kind === "credit" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                  >
                    Crédit
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {kind === "credit"
                    ? "Fiche du crédit dans l'appli de ta banque : prends le haut et le bas de la page, et une fiche par prêt (prêt principal et PTZ ensemble pour détecter un lissage)."
                    : "Le type est vérifié automatiquement d'après le contenu des captures."}
                </p>
              </fieldset>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Méthode d’import">
                <button type="button" aria-pressed={inputMode === "image"} onClick={() => setInputMode("image")} className={`tap flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${inputMode === "image" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}><FileImage className="size-4" aria-hidden="true" /> Choisir des captures</button>
                <button type="button" aria-pressed={inputMode === "text"} onClick={() => setInputMode("text")} className={`tap flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${inputMode === "text" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}><ClipboardPaste className="size-4" aria-hidden="true" /> Coller le texte</button>
              </div>
              <ShortcutHelp />
              {inputMode === "image" ? (
                <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-card px-5 py-8 text-center transition-colors hover:bg-primary/5">
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><FileImage className="size-5" aria-hidden="true" /></span>
                  <span className="text-sm font-semibold">Choisir 1 à 8 captures</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">Lues sur ton téléphone, en pleine résolution</span>
                  <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(event) => { void selectCaptures(event.currentTarget.files); event.currentTarget.value = ""; }} />
                </label>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="position-import-text" className="text-sm font-semibold">Texte de la capture</label>
                    <button type="button" onClick={() => void pasteFromClipboard()} disabled={busy} className="tap flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-primary">
                      <ClipboardPaste className="size-3.5" aria-hidden="true" /> Coller
                    </button>
                  </div>
                  <textarea id="position-import-text" value={pastedText} onChange={(event) => setPastedText(event.target.value)} rows={8} disabled={busy} className="w-full resize-y rounded-xl border border-border bg-card px-3 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="Colle ici le texte de tes positions, de ton livret ou de ton crédit…" />
                  <p className="text-xs leading-relaxed text-muted-foreground">Sur iPhone : ouvre la capture dans Photos, maintiens le doigt sur le texte, Tout sélectionner, Copier, puis colle ici. Plusieurs captures : sépare-les par une ligne « {CAPTURE_MARKER} ».</p>
                </div>
              )}
              {busy && !extraction && (
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground" role="status">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> {progress || (inputMode === "image" ? "Préparation des captures…" : "Lecture du texte…")}
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
                        {formatBytes(capture.file.size)}
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
                disabled={(inputMode === "image" ? !captures.length : !pastedText.trim()) || busy}
                onClick={() => void analyze()}
                className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {busy ? "Lecture en cours…" : inputMode === "image" ? "Analyser les captures" : "Analyser le texte"}
              </button>
            </div>
          ) : loanMode ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Vérification manuelle</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {loanRows.length > 1 ? `${loanRows.length} crédits reconnus.` : "1 crédit reconnu."} Les modifications restent locales à cette étape.
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                  <ShieldCheck className="size-3" aria-hidden="true" /> Rien d&apos;enregistré
                </span>
              </div>
              {notice && <p className="rounded-lg bg-elevated px-3 py-2 text-xs text-muted-foreground" role="status">{notice}</p>}
              <ImportLoanReview
                rows={loanRows}
                assets={assets}
                warnings={loanWarnings}
                onChange={(id, patch) => setLoanRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))}
              />
            </div>
          ) : extraction ? (
            <div className="flex flex-col gap-4">
              {notice && <p className="rounded-lg bg-elevated px-3 py-2 text-xs text-muted-foreground" role="status">{notice}</p>}
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

async function compressCapture(file: File): Promise<Omit<Capture, "file">> {
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
  const scale = Math.min(1, 600 / Math.max(width, height));
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

async function preprocessCapture(file: File, variant: OcrVariant): Promise<HTMLCanvasElement> {
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
  const scale = ocrScale(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Prétraitement indisponible sur cet appareil.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap ?? image!, 0, 0, canvas.width, canvas.height);
  bitmap?.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  prepareForOcr({ data: pixels.data, width: canvas.width, height: canvas.height }, variant);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** Pas à pas du raccourci iPhone : la reconnaissance de texte d'Apple, plus précise, sans rien envoyer. */
function ShortcutHelp() {
  const [origin, setOrigin] = useState("https://asset-whisperer-96.vercel.app");
  useEffect(() => setOrigin(window.location.origin), []);
  const steps = [
    "App Raccourcis → « + » → nomme-le « Importer dans Patrimoine ». Dans ⓘ, active « Afficher dans la feuille de partage » (Images).",
    "Ajoute « Répéter avec chaque élément » sur l'entrée du raccourci.",
    `Dans la boucle : « Extraire le texte de l'image » (Élément de répétition), puis « Texte » : ${CAPTURE_MARKER}, un retour à la ligne, et la variable « Texte extrait ».`,
    "Après la boucle : « Combiner le texte » (Résultats de la répétition, avec Nouvelles lignes), puis « Copier dans le presse-papiers ».",
    `« Encoder en URL » le texte combiné, puis « Ouvrir les URL » avec : ${origin}/patrimoine#import= suivi du texte encodé.`,
  ];
  return (
    <details className="rounded-xl border border-border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <summary className="cursor-pointer py-1 text-sm font-semibold text-foreground">
        Raccourci iPhone · lecture d&apos;Apple, plus précise
      </summary>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-4">
        {steps.map((step) => (
          <li key={step} className="break-words">{step}</li>
        ))}
      </ol>
      <p className="mt-2">
        Ensuite : dans Photos, sélectionne tes captures → Partager → « Importer dans Patrimoine ». L&apos;analyse démarre
        seule. Le texte passe après le « # » de l&apos;adresse, partie jamais envoyée au serveur. Appli installée sur
        l&apos;écran d&apos;accueil : ouvre-la, choisis « Coller le texte », puis « Coller ».
      </p>
    </details>
  );
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
