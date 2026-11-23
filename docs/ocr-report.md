# Import par capture d'écran — rapport final OCR

**Verdict : objectifs atteints.** Jeu test ≥ 90 % pour chaque courtier (le plus bas : Trade Republic,
95,5 %) et 100 % sur les vraies captures, mais il n'y en a que **2** (Boursorama) : c'est la
principale réserve (voir Limites).

Tout tourne en local et gratuitement : PaddleOCR (modèles PP-OCRv5 mobile, Apache-2.0) exécuté par
ONNX Runtime, en WebAssembly dans le navigateur et en natif sous Node pour l'évaluation. Ce sont les
mêmes modèles et les mêmes réglages des deux côtés (`src/lib/ocr/config.ts`) : la lecture est
identique, vérifié capture par capture. Aucune API d'IA, aucun service payant, aucune requête hors
de l'appli (contrôlé par le test navigateur, qui bloque tout appel extérieur).

## Scores (champs exacts)

| Courtier | dev (réglages) | test | real |
| --- | --- | --- | --- |
| Boursorama | 99,8 % (417/418) | **97,6 %** (207/212) | **100 %** (42/42) |
| Trade Republic | 96,9 % (443/457) | **95,5 %** (169/177) | — |
| Fortuneo | 97,7 % (302/309) | **96,0 %** (119/124) | — |
| Bourse Direct | 93,6 % (540/577) | **98,6 %** (213/216) | — |
| Degiro | 98,3 % (414/421) | **98,5 %** (195/198) | — |
| Crédit Agricole (livret) | 92,6 % (50/54) | **95,7 %** (22/23) | — |
| **Global** | **96,9 %** | **97,4 %** (925/950) | **100 %** |

| Champ | dev | test | real |
| --- | --- | --- | --- |
| Nom (validé par l'ISIN) | 97,4 % | 97,6 % | 100 % |
| Quantité (exacte) | 98,4 % | 98,8 % | 100 % |
| PRU (±0,01 €) | 96,4 % | 98,4 % | 100 % |
| Valorisation (±0,01 €) | 97,8 % | 97,6 % | 100 % |
| Total du compte (±0,01 €) | 91,3 % | 97,1 % | 100 % |
| Libellé du livret | 100 % | 100 % | — |

Une ligne lue en trop compte comme une erreur (8 en dev, 6 en test).

Corpus : 240 fausses captures (6 courtiers × 40 ; mode clair/sombre, 5 tailles de téléphone, JPEG,
recadrage, barre d'état), 168 en dev et 72 en test. Les règles n'ont été ajustées que sur dev.

## Progression (détail : `docs/ocr-journal.md`)

27 lignes au journal (point de départ, corrections de la vérité terrain du corpus, puis un changement
à la fois), dont 4 changements rejetés ou non retenus.

| Étape | dev | test | real |
| --- | --- | --- | --- |
| Départ (PaddleOCR + ancien analyseur) | 37,4 % | 41,1 % | 83,3 % |
| Lecture des intitulés (grilles « Qté / Prix / Valo ») | 71,5 % | 76,3 % | 83,3 % |
| Relecture ciblée des zones peu sûres | 80,4 % | 82,1 % | 90,5 % |
| Lecteur de tableaux par colonnes + choix par cohérence | 95,6 % | 96,0 % | 90,5 % |
| Final | 96,9 % | 97,4 % | 100 % |

Rejetés : le prétraitement en niveaux de gris (real 83 → 67 %), une suppression trop large des
tickers, les triangles ▲▼ convertis en signe, et l'élargissement de la marge des logos. Ce dernier
améliorait le test mais pas dev, et l'idée venait d'une capture test : il n'a donc pas été appliqué.

## Dans l'appli

- Bouton Importer, puis « Choisir des captures » (jusqu'à 8). La lecture se fait sur le téléphone.
- Écran de revue : chaque champ qui échoue à un contrôle de cohérence est **surligné en orange**, avec
  la raison. Les contrôles sont recalculés à chaque modification :
  - quantité × cours ≠ valorisation ;
  - ISIN invalide ;
  - titre non reconnu ;
  - PRU incohérent ;
  - somme des lignes > total du compte.
- Test navigateur (`npm run e2e:ocr`, Chrome sur ordinateur) : le parcours complet (ouverture de
  l'appli, chargement des modèles, lecture d'une capture) prend 10 à 15 s. Les valeurs sont identiques à l'évaluation, aucune requête
  extérieure. Une quantité modifiée à la main passe bien en orange.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run corpus:generate` | régénère les 240 fausses captures et leurs réponses (≈ 1 min) |
| `npm run eval:ocr` | score par courtier, champ et jeu ; `reports/ocr/report.html` montre les 10 pires erreurs avec l'image et le texte lu ; `-- --journal "…"` ajoute une ligne au journal |
| `npm run test:ocr` | tests Vitest : échouent si un courtier passe sous 90 % en test ou si les vraies captures passent sous 90 % (≈ 2 min 30 sans cache, 2 s avec) |
| `npm run fixture:real` | prépare la réponse attendue de tes vraies captures (questions dans le terminal) ; format : `fixtures/README.md` |
| `npm run e2e:ocr -- <url> <image>` | test dans un vrai navigateur sur l'appli construite |

## Limites connues

1. **Très peu de vraies captures.** Il n'y en a que 2, de la même appli et du même jour. Le 100 %
   « real » ne prouve presque rien pour les autres courtiers. Les modèles de fausses captures
   reproduisent les mises en page de mémoire : une vraie appli (autre version, autres libellés)
   peut faire nettement moins bien.
2. **Petits échantillons.** Un livret Crédit Agricole compte 1 à 3 champs par capture : une seule
   erreur fait perdre environ 4 points sur le jeu test (23 champs). Les écarts de 1 à 2 points
   entre dev et test ne sont pas significatifs.
3. **Référentiel de 53 titres.** Un titre hors liste est lu, mais son nom reste « non reconnu » (en
   orange, ISIN vide) tant qu'il n'est pas choisi à la main. Un nom tronqué par l'appli
   (« Amundi PEA Monde M… ») n'est pas toujours rattaché.
4. **Faiblesses du modèle mobile.**
   - Mots collés (« AMUNDIPEA »).
   - Flèches lues comme des lettres ou des chiffres.
   - Dans un tableau dense, le « 500 » de « S&P 500 » est parfois pris pour la quantité. C'est la
     principale erreur restante chez Bourse Direct (93,6 % en dev). Le contrôle de cohérence la
     signale alors en orange.
   - Le dictionnaire du modèle n'a ni « î », ni « ï », ni « œ ».
5. **Poids et vitesse.**
   - 21 Mo de modèles et 12 Mo de moteur WebAssembly sont téléchargés à la première lecture (puis
     mis en cache par le navigateur).
   - La lecture tourne sur le fil principal : l'écran peut figer quelques secondes.
   - La vitesse sur iPhone n'a pas été mesurée.
6. **Total du compte.** Il n'est lu que s'il est à l'écran. Une somme inférieure au total n'est pas
   signalée (espèces ou lignes hors capture).
7. **Données réelles.**
   - Les tests versionnés utilisent maintenant des montants fictifs. Les vraies captures restent
     dans `fixtures/real/`, ignoré par git.
   - En revanche, les anciens commits des branches #5/#6 contiennent encore les montants
     d'origine : les effacer demanderait de réécrire l'historique, ce qu'il faut éviter avec
     Lovable.
   - Le tableau de démonstration du README (§ 9) et l'exemple de saisie rapide reprennent des
     quantités et des PRU proches d'un vrai portefeuille. Ils n'ont pas été modifiés.
8. Sans lien avec l'OCR : un test existant de `monthly-plan.cases.ts` (« dépassement de la baisse
   tolérée ») échouait déjà avant ces changements.

## Prochaines améliorations (par impact attendu)

1. **5 à 10 vraies captures par courtier** (`npm run fixture:real`, 2 minutes par capture). C'est le
   seul moyen de savoir où l'on en est vraiment, et la base de tout réglage futur.
2. Corrections apprises sur les vraies captures : confusions de caractères fréquentes, libellés
   propres à chaque appli.
3. Référentiel élargi aux ETF éligibles PEA et aux grandes valeurs européennes, embarqué dans
   l'appli, pour reconnaître plus de noms et d'ISIN.
4. Lecture dans un Web Worker (écran fluide) et mise en cache des modèles par un service worker
   (hors ligne dès la 2e visite).
5. Accélération WebGPU quand le téléphone la propose, et mesure sur iPhone.
6. Option « précision maximale » sur ordinateur avec le modèle de reconnaissance PP-OCRv5 *server*.
