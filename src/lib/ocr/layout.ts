/**
 * Reconstruction du tableau à partir des boîtes de texte de l'OCR : les boîtes alignées
 * verticalement forment une ligne, triée de gauche à droite ; un grand écart horizontal
 * devient une tabulation (changement de colonne), un petit écart une espace.
 */

export interface OcrBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface OcrPage {
  width: number;
  height: number;
  boxes: OcrBox[];
}

export interface Row {
  boxes: OcrBox[];
  top: number;
  bottom: number;
  text: string;
}

/** Recouvrement vertical relatif de deux intervalles. */
function verticalOverlap(aTop: number, aBottom: number, bTop: number, bBottom: number): number {
  const overlap = Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
  return overlap / Math.max(1, Math.min(aBottom - aTop, bBottom - bTop));
}

export function groupRows(
  boxes: OcrBox[],
  options: { overlap?: number; columnGap?: number } = {},
): Row[] {
  const minOverlap = options.overlap ?? 0.5;
  const columnGap = options.columnGap ?? 1.2;
  const sorted = boxes
    .filter((box) => box.text.trim())
    .sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
  const rows: Array<{ boxes: OcrBox[]; top: number; bottom: number }> = [];
  for (const box of sorted) {
    const row = rows.find(
      (candidate) =>
        verticalOverlap(candidate.top, candidate.bottom, box.y, box.y + box.height) >= minOverlap,
    );
    if (row) {
      row.boxes.push(box);
      row.top = Math.min(row.top, box.y);
      row.bottom = Math.max(row.bottom, box.y + box.height);
    } else {
      rows.push({ boxes: [box], top: box.y, bottom: box.y + box.height });
    }
  }
  return rows
    .sort((a, b) => a.top - b.top)
    .map((row) => {
      const ordered = row.boxes.sort((a, b) => a.x - b.x);
      let text = "";
      ordered.forEach((box, index) => {
        if (index > 0) {
          const previous = ordered[index - 1]!;
          const gap = box.x - (previous.x + previous.width);
          const charHeight = Math.min(box.height, previous.height);
          text += gap > columnGap * charHeight ? "\t" : " ";
        }
        text += box.text.trim();
      });
      return { boxes: ordered, top: row.top, bottom: row.bottom, text };
    });
}

/**
 * Éléments d'interface sans contenu : pastille de logo avec des initiales (« AM », « HE »)
 * dans la marge gauche, seule sur sa ligne ou juste devant un nom.
 */
export function dropInterfaceBoxes(page: OcrPage): OcrPage {
  const rows = groupRows(page.boxes);
  const drop = new Set<OcrBox>();
  for (const row of rows) {
    row.boxes.forEach((box, index) => {
      const text = box.text.trim();
      if (!/^[A-Za-zÀ-ÿ]{1,2}$/.test(text) || box.x + box.width > page.width * 0.16) return;
      const next = row.boxes[index + 1];
      if (
        row.boxes.length === 1 ||
        (index === 0 &&
          next &&
          /^[A-Za-zÀ-ÿ]/.test(next.text.trim()) &&
          next.x > box.x + box.width + box.height * 0.5)
      ) {
        drop.add(box);
      }
    });
  }
  return { ...page, boxes: page.boxes.filter((box) => !drop.has(box)) };
}

export function rowsToText(rows: Row[]): string {
  return rows.map((row) => row.text).join("\n");
}
