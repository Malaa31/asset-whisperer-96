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
  maxAlternatives: number;
  abort: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

type SpeechCtor = new () => SpeechRec;

function speechCtor(): SpeechCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, SpeechCtor | undefined>;
  return w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
}

/** Traduit le code d'erreur de l'API en message actionnable. */
function micMessage(code?: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Micro refusé. Autorise-le dans les réglages du navigateur, puis réessaie.";
    case "no-speech":
      return "Rien n'a été entendu. Réessaie en parlant juste après le tap.";
    case "audio-capture":
      return "Aucun micro détecté sur cet appareil.";
    case "network":
      return "La reconnaissance vocale n'a pas pu joindre le réseau.";
    case "aborted":
      return "";
    default:
      return "La dictée du navigateur a échoué. Utilise le micro de ton clavier.";
  }
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
  const baseRef = useRef("");
  const [supported, setSupported] = useState(false);
  const [micError, setMicError] = useState("");

  useEffect(() => setSupported(Boolean(speechCtor())), []);

  useEffect(() => () => recRef.current?.abort(), []);

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    setMicError("");
    // Le texte déjà saisi est conservé : la dictée s'ajoute à la suite.
    baseRef.current = text ? text.trimEnd() + " " : "";
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let out = "";
      for (let i = 0; i < e.results.length; i++) {
        const alt = e.results[i]?.[0];
        if (alt) out += alt.transcript;
      }
      setText(baseRef.current + out);
    };
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      setMicError(micMessage(e?.error));
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() lève si une session est déjà en cours.
      setListening(false);
      setMicError("Dictée déjà en cours — réessaie dans un instant.");
    }
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

      {micError && <p className="mt-1.5 text-[11px] text-destructive">{micError}</p>}

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {supported
          ? "Tu peux aussi dicter avec le micro de ton clavier."
          : "Pour dicter, utilise le micro de ton clavier (à côté de la barre d'espace)."}
      </p>

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
