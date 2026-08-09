import { useEffect, useRef, type ReactNode } from "react";

/**
 * Feuille plein écran.
 *
 * Centralise trois comportements qui étaient jusqu'ici absents ou
 * dupliqués :
 *
 *  - la barre de navigation et le bouton d'ajout sont masqués tant
 *    qu'une feuille est ouverte, faute de quoi ils flottent au-dessus
 *    du contenu ;
 *  - le défilement de la page en arrière-plan est verrouillé, et la
 *    position retrouvée à la fermeture ; sans cela, faire défiler une
 *    feuille entraîne la page en dessous ;
 *  - le geste de retour du navigateur ferme la feuille au lieu de
 *    quitter la page, ce qui renvoyait systématiquement sur le dernier
 *    onglet visité.
 */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const scrollY = useRef(0);

  useEffect(() => {
    const { body } = document;
    scrollY.current = window.scrollY;

    // Compteur : plusieurs feuilles peuvent se superposer, la dernière
    // fermée doit seule rendre la page au défilement.
    const depth = Number(body.dataset["sheet"] ?? 0) + 1;
    body.dataset["sheet"] = String(depth);

    if (depth === 1) {
      body.style.position = "fixed";
      body.style.top = `-${scrollY.current}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
    }

    // Une entrée d'historique dédiée : le retour la consomme et ferme la
    // feuille, sans changer de page.
    window.history.pushState({ sheet: true }, "");
    const onPop = () => onClose();
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
        window.scrollTo(0, scrollY.current);
      }
      // Si la fermeture vient d'un bouton et non du geste de retour,
      // l'entrée d'historique ajoutée doit être retirée.
      if (window.history.state?.sheet) window.history.back();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
