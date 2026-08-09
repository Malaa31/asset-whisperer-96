import { useEffect } from "react";

/**
 * Bloque le défilement de la page tant qu'une feuille plein écran est
 * ouverte.
 *
 * Sans ce verrou, un geste dans la feuille faisait défiler la page
 * dessous : au retour, l'application se retrouvait à une position
 * inattendue, et les barres de Safari réapparaissaient sans cesse
 * puisque le document bougeait en permanence.
 *
 * La position est mémorisée puis restaurée à la fermeture, pour revenir
 * exactement là où l'utilisateur avait laissé la page.
 */
export function useLockScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const y = window.scrollY;
    const { body } = document;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, y);
    };
  }, [active]);
}
