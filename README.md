# Patrimoine Clair (36)

# Prompt Lovable — App de pilotage patrimoine « Patrimoine »

> Copie-colle ce prompt dans Lovable. Il est structuré pour être lu par l'IA : stack, design, modèle de données, écrans, logique métier. Tu peux le donner en une fois, puis itérer écran par écran.

---

## 1. Vision produit

Construis une **application mobile-first de pilotage de patrimoine personnel** en français, inspirée de Finary. Elle permet à un particulier de suivre **tous ses actifs et dettes au même endroit** (bourse, assurance vie, livrets, immobilier, crypto, cash, crédits), de visualiser son **patrimoine net**, son **allocation réelle en transparence**, et de **piloter une stratégie d'investissement** avec objectifs, jauges de protection et simulateurs de crédit.

Cible : un investisseur particulier autonome qui veut de la clarté chiffrée sans jargon, et éviter de se disperser.

**Principe central : une seule vérité, pas de doublons.** Chaque donnée est saisie une fois. Le patrimoine net = somme des actifs − somme des dettes. L'allocation est calculée « en transparence » (look-through) : un ETF World compte pour ~71 % US, ~19 % Europe, etc., pas comme une ligne opaque.

---

## 2. Stack technique

- **React** (Vite) + **TypeScript**

- **Tailwind CSS** pour le style

- **lucide-react** pour les icônes

- **recharts** pour les graphiques (aires, camembert)

- **Supabase** pour l'auth + la persistence (tables `profiles`, `assets`, `snapshots`). Si Supabase n'est pas branché au départ, utilise `localStorage` avec une couche d'abstraction `storage` facile à remplacer.

- Appels API prix : **Yahoo Finance** via un proxy CORS (ou une edge function Supabase pour masquer et fiabiliser)

---

## 3. Direction artistique (design system)

**Thème sombre fintech premium, raffiné, calme.** Pas criard.

- **Fond** : quasi-noir `#0a0c0b`. Cartes `#13191a` avec bordure `#262e2f`, arrondis `rounded-2xl`.

- **Accent principal** : vert émeraude `#10b981` (valeurs positives, actions, CTA).

- **Accents secondaires** : ambre `#e0b54a` (alertes/objectifs), rouge `#ef4444` (dettes/pertes), bleu `#0ea5e9` (obligations/info), violet `#8b5cf6` (crypto), orange `#f97316` (immo).

- **Typographie** :

  - Titres et grands chiffres : **Fraunces** (serif élégant), poids 500, `font-variant-numeric: tabular-nums`.

  - Corps : **Manrope** ou system-ui.

  - Chiffres/données/tickers : police **mono** (JetBrains Mono) pour l'alignement.

- **Micro-interactions** : transitions douces, `active:scale-[0.99]` sur les cartes tapables, animations d'apparition subtiles, barres de progression et jauges animées au montage.

- **Espacements généreux**, hiérarchie claire, jamais surchargé. Chaque écran doit respirer.

- **Format** : conçu pour un écran de téléphone (max-width ~480px centré), navigation par **bottom-nav** + **bouton flottant central (+)** pour ajouter un actif.

Format monétaire : `1 234 €` (espace comme séparateur de milliers, français). Pourcentages : `+11,1 %`.

---

## 4. Modèle de données

### Profil utilisateur

```

{

  name: string,

  age: number,

  profession: string,

  incomeMonthly: number,        // revenu net mensuel

  riskProfile: 'prudent' | 'equilibre' | 'dynamique' | 'offensif',

  goal: { amount: number, horizon: number (années), dca: number (versement mensuel) }

}

```

### Actif (asset) — structure unifiée

```

{

  id: string,

  type: 'pea' | 'av' | 'livret' | 'immo' | 'crypto' | 'cash' | 'autre' | 'credit',

  data: { ... },   // champs spécifiques par type (voir ci-dessous)

  createdAt, updatedAt

}

```

**Champs `data` par type :**

- **pea** (Bourse : PEA / CTO / PEE / PER) : `envelope, name, ticker, isin, quantity, pru (prix moyen d'achat, éditable), currentPrice, sector, region, ter, currency`

- **av** (Assurance vie) : `name, assureur, dateOuverture, fondsEurosAmount, fondsEurosRendement, ucAmount, ucDescription`

- **livret** : `type (Livret A, LDDS, LEP, PEL…), amount, taux`

- **immo** : `type (Résidence principale, Locatif, SCPI…), name, adresse, surface, dpe, annee, valeurEstimee, creditRestant, mensualite, loyer`

- **crypto** : `ticker, quantity, prixUnitaire`

- **cash** : `name, amount`

- **autre** : `name, amount, description`

- **credit** (passif) : `type (Prêt immobilier, conso, auto…), name, preteur, capitalInitial, capitalRestant, taux, mensualite, dureeRestante, dateFin`

### Snapshot (historique — pour la courbe d'évolution)

```

{ date, patrimoineNet, totalActifs, totalDettes, allocation }

```

Créé automatiquement 1× par mois (ou à la demande) pour tracer l'évolution du patrimoine dans le temps.

---

## 5. Profils de risque & allocations cibles

```

prudent   → Actions 25% / Obligations 50% / Immo 15% / Cash 10%

equilibre → Actions 50% / Obligations 30% / Immo 15% / Cash 5%

dynamique → Actions 70% / Obligations 10% / Immo 15% / Cash 5%

offensif  → Actions 85% / Obligations 5%  / Immo 10% / Cash 0%

```

---

## 6. Écrans

### 6.1 Onboarding (4 étapes, plein écran, barre de progression)

1. **Bienvenue** + prénom. Montre 4 mini-cartes de features (multi-actifs, IA+recherche, protection, simulateurs).

2. **Profil** : âge, profession, revenu net mensuel.

3. **Tolérance au risque** : 4 cartes sélectionnables (les profils ci-dessus), avec aperçu de l'allocation cible.

4. **Objectif chiffré** : montant cible, horizon (années), DCA mensuel. Carte de récap.

À la fin, sauvegarde le profil et entre dans l'app.

### 6.2 Accueil (Dashboard)

De haut en bas :

- **Header** : « Bonjour {prénom} », bouton refresh prix (actualise les cours des lignes bourse via Yahoo).

- **Hero patrimoine net** : grand chiffre en Fraunces = actifs − dettes. Badge plus-value latente (+X € / +X %). Ligne de 3 stats : Actifs / Dettes / Nb de lignes.

- **Objectif** : barre de progression vers le montant cible + projection à horizon (voir §7).

- **Plan du mois** (carte accent vert, badge « AGIR ») : « Où mettre tes {DCA} € ce mois-ci ». Ventilation calculée du versement mensuel ligne par ligne, avec tags CŒUR / STOP / NEW / +X €, mini-barres et montants. Total = DCA. (Voir logique §7.)

- **Trajectoire** : graphique en aires (recharts) sur l'horizon — courbe verte « valeur projetée », courbe pointillée bleue « capital versé », ligne ambre en tirets = objectif. Marqueur au croisement de l'objectif.

### 6.3 Patrimoine (liste des actifs)

- **Toggle Actifs / Passifs** en haut (montant de chaque côté).

- **Filtres horizontaux** par type (pills scrollables).

- **Groupement par type** avec sous-total. Chaque ligne : nom, tags contextuels (enveloppe, quantité × prix, antériorité AV, taux livret, mensualité crédit), valeur, plus-value. Pour un crédit : **barre de progression de remboursement** (% remboursé).

- Tap sur une ligne → ouvre le formulaire d'édition.

- Bouton **Ajouter**.

### 6.4 Ajout / édition d'un actif (modal plein écran)

1. **Choix du type** (8 cartes).

2. Pour la Bourse : **3 onglets → Recherche / Photo / Manuel** (voir §8). Les autres types vont direct au formulaire manuel.

3. Formulaire spécifique au type avec les champs listés au §4.

4. Bouton **Récupérer le prix** (Yahoo) sur les lignes bourse. **PRU éditable.**

5. Actions : Enregistrer / Annuler / Supprimer (si édition).

### 6.5 Pilotage (le cœur stratégique — 3 sous-onglets)

**Onglet A — Allocation** (toggle Actuel / Cible / Écarts)

Tableau en transparence par région : US, Europe, Émergents, Japon, Autres dév., Commodities, Fonds €. Barres + %+ montant. En vue « Écarts », affiche les +/− points vs cible et surligne les dérives ≥ 8 pts. Dessous : cartes « Dérives détectées ».

**Onglet B — Risques**

- **3 jauges circulaires de protection** (score /100, animées) : « Choc Taïwan », « Baisse $ », « Hausse taux € ». Calculées en transparence (voir §7). Couleur : rouge <40, ambre 40-60, vert >60.

- **Scénarios de stress** : 3 cartes -20 % / -30 % / -45 % → perte en € sur la poche actions + temps de récupération estimé (DCA continu + 7,5 %/an).

- **Indicateurs marché** : 4 cartes (EUR/USD, Or, Taux BCE, VIX) avec valeur, variation, seuil d'alerte. Bouton actualiser (Yahoo : `EURUSD=X`, `GC=F`, `^VIX`).

- **Règles anti-dispersion** : liste numérotée de 5 règles (virement permanent, une revue/mois, rebalancement annuel en janvier, zéro stock-picking, en krach on accélère).

**Onglet C — Simulateurs**

- **Mensualité** : capital + taux + durée → mensualité + coût total + intérêts.

- **Capacité d'emprunt** : revenu + charges (pré-remplies depuis les crédits saisis) + taux + durée + taux d'endettement max → montant empruntable + mensualité max. Alerte si endettement actuel > seuil.

### 6.6 Profil

Infos perso éditables, profil de risque, objectif. Toggle « masquer les montants » (mode discret). Bouton reset (efface tout).

---

## 7. Logique métier (moteur de calcul)

### Valorisation

- `pea` = quantity × (currentPrice ou pru)

- `av` = fondsEurosAmount + ucAmount

- `immo` = valeurEstimee (le crédit associé est une ligne `credit` séparée, pas soustrait ici)

- `crypto` = quantity × prixUnitaire

- `livret / cash / autre` = amount

- `credit` = − capitalRestant (négatif)

- **Patrimoine net** = Σ actifs − Σ dettes

### Plus-value latente (lignes bourse)

`gain = quantity × (currentPrice − pru)`

### Allocation en transparence (look-through)

Décompose chaque ETF selon sa région :

```

Monde        → US 71%, Europe 18,5%, Japon 6%, Autre 4,5%

États-Unis   → US 100%

Europe       → Europe 100%

Émergents    → Emergents 100%

```

Un ETF dont le secteur contient « matières premières / commodities / mines » → catégorie Commodities. Le fonds € d'une AV → catégorie Fonds €. Agrège tout et calcule les % par région.

### Scores de protection (0-100, en transparence)

En fonction des expositions (part US, part émergents, part commodities, part fonds €) :

- **Choc Taïwan** : pénalisé par l'exposition US (méga-caps tech) et émergents (Chine) ; bonus commodities + fonds €.

- **Baisse du dollar** : pénalisé par l'exposition USD ; bonus commodities (or), Europe, fonds €.

- **Hausse taux €** : pénalisé par la tech growth US ; bonus fonds € (dont les rendements remontent) + commodities.

Formule indicative, borne [0,100]. Cible > 60.

### Scénarios de stress

Pour chocs -20/-30/-45 % sur la poche actions : perte en €, puis nombre de mois pour revenir au niveau initial en poursuivant le DCA à 7,5 %/an.

### Projection de trajectoire

Capitalisation mensuelle : `valeur = valeur × (1 + r/12) + dca`, avec r = 7,5 %/an par défaut, sur `horizon` années. Trace valeur projetée + capital versé cumulé. Détecte l'année de franchissement de l'objectif.

### Plan du mois (ventilation du DCA)

Analyse les lignes existantes et propose une réorientation vers une cible **défensive** sans vendre l'existant :

- World → CŒUR (part majeure)

- S&P 500 → STOP si World déjà présent (redondance US)

- Stoxx Europe 600 → renfort

- Émergents → réduit

- Commodities (CMSE) → NEW

- Small caps (Russell 2000) → NEW

- Fonds € → NEW (sécurisation)

Normalise pour que la somme = DCA. Chaque ligne : emoji, nom, tag, montant.

### Calculateurs crédit

```

mensualité = (K × r) / (1 − (1+r)^-n)   avec r = taux/12, n = durée×12

capacité   = mensualitéMax × (1 − (1+r)^-n) / r

mensualitéMax = revenu × tauxEndettement% − charges

```

---

## 8. Ajout d'un actif : recherche déroulante + prix en direct (PRIORITÉ UX)

> C'est LE point le plus important de l'app. L'ajout d'un actif bourse doit être aussi fluide que dans Trade Republic ou Finary : je tape 2-3 lettres, une liste déroulante filtrée apparaît en temps réel, je sélectionne, tout se remplit et le cours est déjà à jour. Zéro friction.

### 8.1 Composant de recherche déroulante (autocomplete / combobox)

Quand l'utilisateur ajoute une ligne bourse ou crypto, le premier champ est une **barre de recherche de type combobox** :

- **Recherche instantanée au fur et à mesure de la frappe** (debounce ~250 ms), dès le 1er caractère.

- Une **liste déroulante de résultats** s'affiche sous le champ, mise à jour en direct.

- Chaque résultat affiche : **nom complet**, **ticker**, un **badge PEA** si éligible, la **région + secteur**, et **le cours actuel déjà chargé** (petit prix à droite).

- La recherche matche sur **nom, ticker, ISIN et alias** (ex. taper « world », « sp500 », « nvidia », « émergent » doit remonter le bon fonds).

- **Navigation clavier** (flèches ↑↓ + Entrée) et tap tactile.

- Au choix d'un résultat : le formulaire se **pré-remplit intégralement** (nom, ticker, ISIN, secteur, région, devise, TER) et **récupère le prix live automatiquement**. L'utilisateur ne saisit plus que **quantité** et **PRU**.

- Un lien discret « Je ne trouve pas → saisie manuelle » en bas de la liste comme échappatoire.

### 8.2 Source de la recherche : catalogue local + recherche API en fallback

**Deux niveaux, combinés :**

1. **Catalogue local intégré** (~30-40 valeurs françaises/PEA les plus courantes) pour un affichage **instantané, hors-ligne, sans latence** dès la 1re lettre. Inclure au minimum : Amundi MSCI World (CW8.PA), Amundi PEA Monde (PCEW.PA), Amundi PEA S&P 500 (PE500.PA), Amundi Nasdaq-100 (PANX.PA), Amundi Russell 2000 (PRUS.PA), Amundi Stoxx Europe 600 (PCEU.PA), BNP Easy Stoxx 600 (BNL.PA), Amundi PEA Émergent (PAEEM.PA), iShares Commodities (CMSE.PA), actions FR/US (LVMH, TotalEnergies, Airbus, Sanofi, Apple, Nvidia, Microsoft), Bitcoin/Ethereum. Chaque entrée porte : `name, ticker, isin, region, sector, currency, ter, pea, aliases[]`.

2. **Recherche live via API** quand la requête ne matche pas le catalogue local : appelle un **endpoint de recherche de symboles** (voir 8.4) pour trouver n'importe quelle valeur mondiale par nom ou ticker, et l'ajouter dynamiquement aux résultats. Ainsi l'utilisateur n'est jamais bloqué par le catalogue.

### 8.3 Mise à jour des cours EN DIRECT dans toute l'app

Le prix ne doit jamais être une saisie figée. Câble une **API de cotation** partout :

- **À la sélection** dans la recherche → le cours de la valeur est récupéré immédiatement et affiché.

- **Sur le dashboard** → un bouton refresh global met à jour **toutes** les lignes bourse/crypto ayant un ticker, recalcule valeur nette + plus-values, et affiche l'horodatage de dernière mise à jour.

- **Rafraîchissement automatique** à l'ouverture de l'app (une fois par session, ou si le dernier fetch date de > 30 min), en tâche de fond, sans bloquer l'UI.

- **Indicateurs marché** (écran Pilotage) branchés sur la même API : EUR/USD, Or, VIX.

- Chaque ligne stocke `currentPrice` + `lastPriceUpdate` (timestamp). Afficher « Maj il y a X min ».

### 8.4 API à utiliser (recommandation)

Yahoo Finance n'a pas d'API publique officielle et bloque le CORS depuis le navigateur : **il faut passer par une edge function Supabase** (proxy serveur) qui appelle Yahoo et renvoie le JSON au front. Crée deux edge functions :

- **`search-symbols?q=...`** → proxy vers `https://query1.finance.yahoo.com/v1/finance/search?q={q}` → renvoie une liste `{ symbol, name, exchange, type }` pour alimenter la combobox en live.

- **`quote?symbols=CW8.PA,PE500.PA,...`** → proxy vers l'endpoint chart/quote de Yahoo → renvoie `{ symbol, price, currency, previousClose, changePercent }` pour un ou plusieurs tickers en un appel (batch, pour rafraîchir tout le portefeuille d'un coup).

**Alternatives si tu préfères une API officielle avec clé** (plus fiable, quotas à surveiller) : **Financial Modeling Prep**, **Twelve Data**, ou **Finnhub** — toutes trois ont un endpoint *symbol search* + *quote* et un plan gratuit. Pour la **crypto**, utilise **CoinGecko** (gratuit, pas de clé, CORS ouvert) : `/search?query=` puis `/simple/price`. Mets la clé API côté edge function, jamais dans le front.

Fonctions côté client attendues :

```

searchSymbols(query): Promise<{symbol,name,exchange,type,price?}[]>   // alimente la combobox

fetchQuote(tickers: string[]): Promise<Record<ticker,{price,currency,prevClose,changePct}>>  // batch refresh

```

Gérer proprement l'échec réseau : garder le dernier prix connu, message honnête, fallback saisie manuelle du prix.

### 8.5 Import par capture d'écran (onglet Photo — bonus)

L'utilisateur charge une **screenshot de son broker**. L'image est redimensionnée côté client (max 1024px), envoyée à un modèle de vision (edge function appelant un LLM multimodal) qui **extrait en JSON** : nom, ticker, ISIN, quantité, prix actuel, PRU, valeur totale, devise, enveloppe. Le formulaire se pré-remplit, l'utilisateur vérifie et sauve.

---

## 9. Données de démarrage (seed)

Au tout premier lancement (si aucun actif), pré-remplis un PEA de démonstration avec ces 4 lignes (protégé par un flag pour ne s'exécuter qu'une fois ; le reset réactive le seed) :

| Nom | Ticker | ISIN | Qté | PRU | Prix actuel |

|---|---|---|---|---|---|

| Amundi PEA Émergent ESG Transition | PAEEM.PA | LU2300295199 | 70 | 26,51 | 35,58 |

| Amundi PEA Monde MSCI World Acc | PCEW.PA | LU2089238385 | 1229 | 5,65 | 5,97 |

| Amundi PEA S&P 500 Acc | PE500.PA | FR0013412020 | 88 | 48,48 | 56,76 |

| BNP Easy Stoxx Europe 600 Cap. | BNL.PA | FR0011550193 | 168 | 20,06 | 20,49 |

(Total ≈ 18 263 €, plus-value latente ≈ +1 825 €.)

---

## 10. Navigation

Bottom-nav à 4 entrées + bouton flottant central (+) :

`Accueil (Dashboard)` · `Actifs (Patrimoine)` · **(+)** · `Pilotage` · `Profil`

---

## 11. Roadmap (features v2 à prévoir mais pas bloquantes)

- Snapshots mensuels automatiques + **courbe d'évolution du patrimoine dans le temps**.

- **Import CSV** d'un export broker (Boursorama, Bourse Direct).

- **Comptes agrégés** via un agrégateur bancaire (Powens/Bridge) pour remplacer la saisie manuelle.

- Multi-objectifs (retraite, achat immo, études enfants).

- Alertes push (dérive d'allocation, seuil de cours franchi).

- Export PDF du patrimoine.

---

## 12. Ordre de construction recommandé pour Lovable

1. Design system + navigation + écrans vides.

2. Modèle de données + persistence + onboarding.

3. **Recherche déroulante (combobox) + edge functions `search-symbols` et `quote` + prix live (section 8)** — à faire tôt, c'est le cœur de l'expérience d'ajout.

4. Ajout/édition/liste d'actifs, branchés sur la recherche live.

5. Dashboard : patrimoine net + allocation + objectif + refresh global des cours.

6. Pilotage : allocation transparence + jauges + scénarios + simulateurs.

7. Import par capture d'écran (vision LLM).

8. Historique + courbe d'évolution.

Commence par les points 1-5, montre-moi le résultat, puis on itère.

Commence par les points 1-4, montre-moi le résultat, puis on itère.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3aad407c-433d-446f-94ef-b01fb865fa40).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
