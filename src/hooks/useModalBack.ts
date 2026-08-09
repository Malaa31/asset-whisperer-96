import { useEffect, useRef } from "react";

/**
 * Rend un panneau plein écran « annulable par retour arrière ».
 *
 * Les feuilles de l'app (ajout de ligne, analyse, plan du mois, éditeur
 * d'objectif) ne sont pas des routes : ce sont des composants montés
 * par-dessus la page. Sans précaution, le geste de retour du téléphone
 * ne les ferme pas — il quitte la page courante et renvoie l'utilisateur
 * là d'où il venait, typiquement l'onglet Profil.
 *
 * Le montage empile donc une entrée d'historique factice, et le retour
 * la dépile en appelant `onClose` au lieu de changer de page. Une
 * fermeture par le bouton × dépile la même entrée, pour que
 * l'historique reste exactement dans l'état où on l'a trouvé.
 */
export function useModalBack(onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // `pushState` n'entraîne aucune navigation : l'URL reste la même,
    // seule l'entrée d'historique est ajoutée.
    window.history.pushState({ modal: token }, "");

    // Une feuille occupe tout l'écran : la barre d'onglets et le bouton
    // d'ajout n'ont rien à faire par-dessus, et la page dessous ne doit
    // pas défiler.
    const depth = Number(document.body.dataset["sheet"] ?? 0) + 1;
    document.body.dataset["sheet"] = String(depth);
    document.body.style.overflow = "hidden";
    let popped = false;

    const onPop = () => {
      popped = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      const left = Number(document.body.dataset["sheet"] ?? 1) - 1;
      if (left > 0) {
        document.body.dataset["sheet"] = String(left);
      } else {
        delete document.body.dataset["sheet"];
        document.body.style.overflow = "";
      }
      // Fermeture déclenchée par l'interface : on retire nous-mêmes
      // l'entrée ajoutée à l'ouverture.
      if (!popped && (window.history.state as { modal?: string } | null)?.modal === token) {
        window.history.back();
      }
    };
  }, []);
}
