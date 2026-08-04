const nbsp = "\u202f";

// Mode discret : masque tous les montants de l'app.
// Synchronisé avec profile.hideAmounts par l'AppProvider.
let masked = false;
export function setAmountMasking(on: boolean) {
  masked = on;
}

export function eur(value: number, decimals = 0): string {
  if (masked) return `\u2022\u2022\u2022\u2022\u2022${nbsp}\u20ac`;
  const rounded = Number.isFinite(value) ? value : 0;
  const s = Math.abs(rounded)
    .toFixed(decimals)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, nbsp);
  return `${rounded < 0 ? "−" : ""}${s}${nbsp}€`;
}

export function signedEur(value: number): string {
  if (masked) return eur(0);
  return `${value >= 0 ? "+" : "−"}${eur(Math.abs(value))}`;
}

export function pct(value: number, decimals = 1): string {
  const s = Math.abs(value).toFixed(decimals).replace(".", ",");
  return `${value >= 0 ? "+" : "−"}${s}${nbsp}%`;
}

export function rawPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}${nbsp}%`;
}

export function num(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace(".", ",");
}

export function sinceLabel(iso?: string): string {
  if (!iso) return "jamais actualisé";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
