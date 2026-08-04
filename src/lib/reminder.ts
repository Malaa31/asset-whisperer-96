import type { Profile } from "./types";

/**
 * Rappel de versement du mois.
 *
 * Deux niveaux, parce qu'une app web ne peut pas garantir la notification :
 * 1. Une bannière dans l'app, toujours fiable, dès que le mois en cours
 *    n'a pas encore été marqué comme versé.
 * 2. Une notification système, si l'utilisateur l'a autorisée et que le
 *    navigateur le permet. Sur iPhone, cela suppose que l'app ait été
 *    ajoutée à l'écran d'accueil (« Partager » → « Sur l'écran d'accueil »).
 */

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Le versement du mois en cours reste-t-il à faire ? */
export function contributionDue(profile: Profile | null): boolean {
  if (!profile?.monthlyReminder) return false;
  return profile.lastContribution !== currentMonth();
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsGranted(): boolean {
  return notificationsSupported() && Notification.permission === "granted";
}

/** Demande l'autorisation ; retourne true si accordée. */
export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

const SEEN_KEY = "patrimoine.reminderShown";

/**
 * Affiche la notification du mois au plus une fois.
 * Appelé à l'ouverture de l'app : sans service worker, un rappel ne peut
 * pas partir quand l'app est fermée — c'est la limite du web.
 */
export function maybeNotify(profile: Profile | null, dca: number): void {
  if (!contributionDue(profile) || !notificationsGranted()) return;
  const month = currentMonth();
  try {
    if (window.localStorage.getItem(SEEN_KEY) === month) return;
    window.localStorage.setItem(SEEN_KEY, month);
  } catch {
    return;
  }
  const amount = dca > 0 ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(dca) : null;
  new Notification("Versement du mois", {
    body: amount
      ? `C'est le moment de placer tes ${amount}. Ouvre ton plan pour la répartition.`
      : "C'est le moment de ton versement mensuel.",
    icon: "/favicon.ico",
    tag: `patrimoine-${month}`,
  });
}
