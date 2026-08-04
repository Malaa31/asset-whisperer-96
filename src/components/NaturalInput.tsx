import { useEffect, useRef, useState } from "react";
import { Mic, Sparkles, Square } from "lucide-react";
import { parseAssetText, type ParsedAsset } from "@/lib/parse";
import { TYPE_LABELS } from "@/lib/types";

const EXAMPLES = [
  "Livret A 22 700",
  "Maison qui vaut 250 000, louée 700 par mois",
  "Crédit immo, capital restant 90 896, mensualité 592, taux 1,2 %",
  "88 parts d'Amundi S&P 500 à 58,14, PRU 48,48",
];

/** Reconnaissance vocale du navigateur, si disponible. */
interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechCtor = new () => SpeechRec;

function speechCtor(): SpeechCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, SpeechCtor | undefined>;
  return w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
}

/**
 * Saisie d'un actif en une phrase, tapée ou dictée.
 * L'analyse est locale et le résultat est toujours relu dans le
 * formulaire avant enregistrement — rien n'est créé à l'aveugle.
 */
export function NaturalInput({
  onParsed,
}: {
  onParsed: (parsed: ParsedAsset) => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const supported = Boolean(speechCtor());

  useEffect(() => () => recRef.current?.stop(), []);

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let out = "";
      for (let i = 0; i < e.results.length; i++) {
        const alt = e.results[i]?.[0];
        if (alt) out += alt.transcript;
      }
      setText(out);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const preview = text.trim().length > 3 ? parseAssetText(text) : null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-semibold">Décris-le en une phrase</span>
      </div>

      <div className="relative mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="J'ai une maison qui vaut 250 000 et un prêt de 180 000 à 1,2 %"
          className="w-full resize-none rounded-xl border border-border bg-card p-3 pr-12 text-sm outline-none focus:border-primary"
        />
        {supported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? "Arrêter la dictée" : "Dicter"}
            className={`tap absolute right-2 top-2 flex size-9 items-center justify-center rounded-full ${
              listening ? "animate-pulse bg-destructive text-white" : "bg-elevated text-muted-foreground"
            }`}
          >
            {listening ? <Square className="size-3.5" /> : <Mic className="size-4" />}
          </button>
        )}
      </div>

      {!supported && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Pour dicter, utilise le micro de ton clavier.
        </p>
      )}

      {preview && (
        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">{TYPE_LABELS[preview.type]}</span>
            {preview.incomplete && (
              <span className="text-[10px] text-amber">montant à compléter</span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {preview.summary.length ? preview.summary.join(" · ") : "Rien de reconnu pour l'instant."}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!preview}
        onClick={() => preview && onParsed(preview)}
        className="tap mt-3 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-30"
      >
        Remplir le formulaire
      </button>

      {!text && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setText(e)}
              className="tap rounded-full border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
