import { Link } from "@tanstack/react-router";
import { Home, Wallet, Compass, User, Plus } from "lucide-react";

const items = [
  { to: "/", label: "Accueil", Icon: Home },
  { to: "/patrimoine", label: "Actifs", Icon: Wallet },
  { to: "/pilotage", label: "Pilotage", Icon: Compass },
  { to: "/profil", label: "Profil", Icon: User },
] as const;

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-border bg-background/95 backdrop-blur">
      <div className="relative grid grid-cols-5 items-center px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {left.map(({ to, label, Icon }) => (
          <NavItem key={to} to={to} label={label} Icon={Icon} />
        ))}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Ajouter un actif"
            className="tap -mt-8 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_var(--primary)]"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
        </div>
        {right.map(({ to, label, Icon }) => (
          <NavItem key={to} to={to} label={label} Icon={Icon} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  Icon,
}: {
  to: string;
  label: string;
  Icon: typeof Home;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex flex-col items-center gap-1 py-1 text-[11px] text-muted-foreground transition-colors data-[status=active]:text-primary"
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
