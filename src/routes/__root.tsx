import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "@/components/AppProvider";
import { BottomNav } from "@/components/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AssetModal } from "@/components/AssetModal";
import { Onboarding } from "@/components/Onboarding";
import { useApp } from "@/lib/storage";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Cette page n'a pas pu se charger</h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { name: "theme-color", content: "#F2F2F7" },
      { title: "Patrimoine — Pilotage de patrimoine personnel" },
      {
        name: "description",
        content:
          "Suivez vos actifs, dettes, allocation et objectifs d'investissement dans une seule app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      // Icône du raccourci sur l'écran d'accueil iOS. C'est un simple
      // fichier image : elle n'installe aucun service worker et ne
      // touche donc pas au cycle de mise à jour de l'application.
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      // Le manifeste rend l'application installable : lancée depuis
      // l'écran d'accueil, elle s'affiche sans les barres du navigateur.
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Shell />
      </AppProvider>
    </QueryClientProvider>
  );
}

function Shell() {
  const { profile, ready, saveProfile, upsertAsset } = useApp();
  // Ouvre le modal d'ajout si l'onboarding s'est terminé sur « Ajouter ma première ligne ».
  const [adding, setAdding] = useState(false);

  // Ouvre le modal si l'onboarding s'est terminé sur « Ajouter ma première ligne ».
  useEffect(() => {
    if (window.sessionStorage.getItem("patrimoine.openAdd") === "1") {
      window.sessionStorage.removeItem("patrimoine.openAdd");
      setAdding(true);
    }
  }, [profile]);

  if (!ready) return <div className="min-h-screen bg-background" />;
  if (!profile) return <Onboarding onDone={saveProfile} />;

  return (
    <div className="mx-auto min-h-screen max-w-[480px] pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Required: nested routes render here. */}
      <Outlet />
      <BottomNav onAdd={() => setAdding(true)} />
      {adding && (
        <AssetModal
          asset={null}
          onClose={() => setAdding(false)}
          onSave={(a) => {
            upsertAsset(a);
            setAdding(false);
            toast.success("Ligne ajoutée");
          }}
        />
      )}
      <Toaster position="top-center" />
    </div>
  );
}
