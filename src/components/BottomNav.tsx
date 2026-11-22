import { Link } from "@tanstack/react-router";
import { Home, Wallet, User, Plus } from "lucide-react";

const items = [
  { to: "/", label: "Accueil", Icon: Home },
  { to: "/patrimoine", label: "Actifs", Icon: Wallet },
  { to: "/profil", label: "Profil", Icon: User },
] as const;

/**
 * Trois onglets de poids égal + un bouton d'ajout flottant.
 * Le bouton n'occupe plus une colonne de la barre : la navigation
 * reste lisible et l'action principale garde sa place au pouce.
 */
export function BottomNav({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Ajouter une ligne"
        className="app-chrome tap fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50vw-216px))] z-40 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/10 transition-transform active:scale-95"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      <nav className="app-chrome fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="grid grid-cols-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
          {items.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
            >
              <Icon className="size-[22px]" strokeWidth={1.9} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
