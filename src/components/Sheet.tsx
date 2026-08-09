import { useEffect, useRef, type ReactNode } from "react";

/**
 * Feuille plein écran.
 *
 * Regroupe trois comportements attendus d'une feuille :
 *  - la barre de navigation et le bouton d'ajout sont masqués tant
 *    qu'une feuille est ouverte ;
 *  - le défilement du fond est verrouillé, la position étant retrouvée
 *    à la fermeture ;
 *  - le geste de retour ferme la feuille au lieu de quitter la page.
 *
 * L'effet ne dépend de rien et ne s'exécute donc qu'au montage. La
 * fermeture passe par une référence : une fonction passée en ligne est
 * recréée à chaque rendu, et la placer en dépendance relançait l'effet
 * sans fin jusqu'au plantage de la page.
 */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const { body } = document;
    const scrollY = window.scrollY;

    // Compteur : plusieurs feuilles peuvent se superposer, seule la
    // dernière fermée rend la page au défilement.
    const depth = Number(body.dataset["sheet"] ?? 0) + 1;
    body.dataset["sheet"] = String(depth);
    if (depth === 1) {
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
    }

    // Entrée d'historique dédiée : le retour la consomme et ferme la
    // feuille, sans changer de page.
    let ownsEntry = true;
    window.history.pushState({ sheet: true }, "");
    const onPop = () => {
      // L'entrée vient d'être consommée par le geste de retour : il ne
      // faut plus la retirer au démontage.
      ownsEntry = false;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      const left = Number(body.dataset["sheet"] ?? 1) - 1;
      if (left > 0) {
        body.dataset["sheet"] = String(left);
      } else {
        delete body.dataset["sheet"];
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        window.scrollTo(0, scrollY);
      }
      // Fermeture par un bouton : l'entrée ajoutée doit être retirée.
      if (ownsEntry) window.history.back();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
