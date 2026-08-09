import { useEffect } from "react";

/**
 * Marque le document pendant qu'une feuille plein écran est ouverte.
 *
 * Trois effets :
 *  - la barre de navigation et le bouton d'ajout sont masqués, la règle
 *    correspondante existant dans la feuille de style ;
 *  - le défilement du document est bloqué, ce qui évite que la page
 *    dessous bouge et que les barres du navigateur réapparaissent ;
 *  - le marquage persiste un court instant après la fermeture, le temps
 *    que le doigt quitte l'écran. Sans ce délai, un appui près du bas
 *    atteint la barre de navigation une fois la feuille démontée et
 *    renvoie sur un autre onglet.
 */
export function useSheet(): void {
  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.dataset["sheet"] = "true";
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
      window.setTimeout(() => {
        delete body.dataset["sheet"];
      }, 400);
    };
  }, []);
}
