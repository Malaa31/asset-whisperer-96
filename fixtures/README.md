# Captures de test

Deux dossiers, **aucun n'est versionné** (voir `.gitignore`) :

| Dossier | Contenu | Comment le remplir |
| --- | --- | --- |
| `synthetic/` | 240 fausses captures (6 courtiers × 40) et leur réponse attendue, `manifest.json` (jeux dev 70 % / test 30 %) | `npm run corpus:generate` (≈ 1 min, Chrome requis) |
| `real/` | **tes** vraies captures et leur réponse attendue | dépose les images, puis `npm run fixture:real` |

Les règles du pipeline ne s'ajustent que sur **dev**. **test** et **real** servent seulement à mesurer.

## Ajouter une vraie capture

1. Copie la capture dans `fixtures/real/` (PNG ou JPEG), par exemple `fortuneo-cto-1.png`.
2. `npm run fixture:real` : la capture est lue par le même OCR que l'appli, puis le terminal te
   propose chaque valeur. **Entrée** garde la valeur, tu tapes la bonne sinon (`1 234,56` accepté),
   `-` vide un champ. Pour chaque ligne : Entrée = juste, `c` = corriger, `s` = supprimer (ligne lue
   en trop), puis `a` pour ajouter une ligne que l'OCR a ratée.
3. À la fin, réponds `o` si tout correspond à l'écran : le fichier passe à `"verifie": true` et la
   capture compte dans le score `real` de `npm run eval:ocr`.

Variantes : `npm run fixture:real -- --auto` écrit seulement des `.json` pré-remplis
(`"verifie": false`) à corriger dans un éditeur ; `-- --check` affiche l'état et les erreurs de
forme ; `-- --force` refait les captures qui ont déjà un `.json`.

## Format du `.json` (même nom que l'image)

```json
{
  "version": 1,
  "source": "real",
  "broker": "fortuneo",
  "kind": "positions",
  "enveloppe": "CTO",
  "libelle": null,
  "total": 12850.4,
  "positions": [
    { "nom": "AIR LIQUIDE", "isin": "FR0000120073", "quantite": 12, "pru": 150, "valorisation": 2019.6 },
    { "nom": "AMUNDI MSCI WORLD UCITS ETF", "isin": "LU1681043599", "quantite": 5, "pru": null, "valorisation": 2562 }
  ],
  "verifie": true,
  "notes": "mode sombre, recadrée"
}
```

- `broker` : `boursorama`, `trade-republic`, `fortuneo`, `bourse-direct`, `degiro`, `credit-agricole` ou `autre`.
- `kind` : `positions` (portefeuille) ou `livret` (écran de solde : `libelle` = « Livret A », `total` = solde, `positions` vide).
- `total` : le total du compte **tel qu'affiché** ; `null` s'il n'est pas à l'écran.
- Une valeur **absente de l'écran** s'écrit `null` (PRU chez Trade Republic, par exemple) : elle n'est pas notée.
- `isin` : celui du titre, même s'il n'est pas affiché ; le nom lu est jugé juste s'il se rattache à cet ISIN.
- Ne mets que les lignes **entièrement visibles** sur la capture.

Notation (`npm run eval:ocr`) : quantité exacte ; PRU, valorisation et total à ±0,01 € ; nom validé
par l'ISIN ; chaque ligne lue en trop compte comme une erreur.
