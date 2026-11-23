export const positionParserCases = {
  peaWithIsinAndHeaders: `Mon PEA\nNom Quantité PRU Cours Valorisation +/- value\nAmundi MSCI World LU1681043599 12\t410,50\t432,10\t5185,20\t+5,27%\nTotal portefeuille 5 185,20`,
  mobileStack: `Compte titres CTO\nAir Liquide\n10\n142,00 €\n145,00 €\n1450,00 €\nSanofi\n5\n90,00 €\n95,00 €\n475,00 €`,
  noIsin: `Portefeuille\nApple\n2,5\n180,00 €\n190,00 €\n475,00 €\nMicrosoft\n3\n300,00 €\n310,00 €\n930,00 €\nLiquidités 120,00 €`,
  livretA: `Livret A\nPlafond 22 950,00 €\nTaux 3,00 %\nSolde\n12345,67 €\nIntérêts acquis 125,00 €`,
  boursoTable: `Mon PEA\nValeur Quantité PRU Cours Valorisation +/- values\nAMUNDI MSCI WORLD UCITS ETF LU1681043599 38 452,13 € 498,20 € 18 931,60 € +10,19 %\nBNP PARIBAS FR0000131104 25 61,40 € 58,90 € 1 472,50 € -4,07 %\nTotal 20 404,10 €`,
  tradeRepublicCards: `Portefeuille\nAir Liquide\n12,5 actions\n2 103,75 €\n+4,3 %\nTotalEnergies\n30 actions\n1 812,00 €\n-2,1 %`,
  livretWithDate: `LIVRET A\nTaux annuel 1,70 %\nPlafond 22 950,00 €\nSolde au 23/11/2026\n8 412,35 €`,
  livretInline: `Livret A n° 1234\nSolde disponible : 15 300,00 €\nPlafond 22 950 €`,
  etfNamesWithNumbers: `Mon PEA\nNom Quantité PRU Cours Valorisation\nAMUNDI PEA S&P 500 UCITS ETF FR0013412285 40 30,10 € 35,20 € 1 408,00 €\nLYXOR CAC 40 FR0007052782 10 70,00 € 75,50 € 755,00 €`,
  mobileDetail: `Air Liquide\nFR0000120073\nQuantité\n12\nPRU 150,00 €\nDernier cours 168,30 €\nValorisation 2 019,60 €\n+/- value latente +219,60 €`,
  wrappedNames: `Portefeuille\nAMUNDI MSCI WORLD\nUCITS ETF EUR (C)\n5 parts\n500,00 €\n512,40 €\n2 562,00 €\nAmundi CAC 40\n3 parts\n100,00 €\n110,00 €\n330,00 €`,
  closePruCours: `Portefeuille\nHermès\n60 parts\n1 234,50 €\n1 240,00 €\n74 400,00 €`,
  // Capture de l'appli Boursorama (PEA), texte tel que lu par l'OCR de l'appli. Montants fictifs,
  // cohérents entre eux (quantité × cours = montant, PRU × quantité + plus-value = montant).
  boursoAppOcr: `13:03 à all > 22:
< 18 169,58€ eee
Valeur Montant
Cours +/- latentes (€)
Px. revient / Quantité

AMUNDI PEA EMERGENT (MSCI

EMERGING) ESG TRANSITION 1927,68€ >

UCITS ETF

30,12€ +1,42” A 368,00 €

24,37 € / 64

AMUNDI PEA MONDE MSCI 922590€ >

WORLD UCITS ETF ACC

6,03€ +0,91% A 933,30 €

5,42 € /1530

AMUNDI PEA S&P 500 UCITS 4028,54€ >

ETF ACC

56,74 € +0,94% A 893,89 €

44,15 € / 71

BNP PARIBAS EASY STOXX

EUROPE 600 UCITS ETF 2986,26€ >

CAPITALISATION

21,03€ +0,97% A 220,10 €

19,48 € / 142

CARMAT 1,20€ >

010 € +0,00 * N -222,24 €

1862 € /12

8 e = nf =
Comptes Ordres Listes Marchés Menu`,
  // Même écran, ordre de lecture type « Live Text » (colonne de droite après la gauche).
  boursoAppLiveText: `18 169,58 €
Valeur
Cours
Px. revient / Quantité
Montant
+/- latentes (€)
AMUNDI PEA EMERGENT (MSCI EMERGING) ESG TRANSITION UCITS ETF
30,12 € +1,42 %
24,37 € / 64
1 927,68 €
368,00 €
AMUNDI PEA MONDE MSCI WORLD UCITS ETF ACC
6,03 € +0,91 %
5,42 € / 1 530
9 225,90 €
933,30 €
AMUNDI PEA S&P 500 UCITS ETF ACC
56,74 € +0,94 %
44,15 € / 71
4 028,54 €
893,89 €
BNP PARIBAS EASY STOXX EUROPE 600 UCITS ETF CAPITALISATION
21,03 € +0,97 %
19,48 € / 142
2 986,26 €
220,10 €
CARMAT
0,10 € +0,00 %
18,62 € / 12
1,20 €
-222,24 €
Comptes
Ordres
Listes
Marchés
Menu`,
  // 2e capture : montant seul entre deux lignes du nom, virgule perdue (« 408392€ »). Montants fictifs.
  boursoAppOcr2: `15:49 3 all > GP
< 18 520,48€ eee
Valeur Montant
Cours +/- latentes (€)
Px. revient / Quantité
AMUNDI PEA EMERGENT
(MSCI EMERGING) ESG 2078,08€ >
TRANSITION UCITS ETF
32,47€ +7,80% A 518,40 €
24,37 € / 64
AMUNDI PEA MONDE MSCI
9 348,30 €
WORLD UCITS ETF ACC P
6,11€ +1,33% A1 055,70 €
5,42 € /1530
AMUNDI PEA S&P 500 UCITS 408392€ >
ETF ACC
57,52 € +137% A 949,27 €
44,15 € / 71
BNP PARIBAS EASY STOXX
EUROPE 600 UCITS ETF 3008,98€ >
CAPITALISATION
21,19€ +1,88% A 242,82 €
19,48 € / 142
CARMAT 1,20€ >
010 € +0,00 * Ny -222,24 €
1862 € /12
Plan d’Epargne programmé | a
8 e Ea M =
Comptes Ordres Listes Marchés Menu`,
  // Même écran, flèches collées aux montants comme sur l'iPhone (« A518,40 € », « N-222,24 € »).
  boursoAppOcr2Stuck: `15:49 3 all > GP
< 18 520,48€ eee
Valeur Montant
Cours +/- latentes (€)
Px. revient / Quantité
AMUNDI PEA EMERGENT
(MSCI EMERGING) ESG 2078,08€ >
TRANSITION UCITS ETF
32,47€ +7,80% A518,40 €
24,37 € / 64
AMUNDI PEA MONDE MSCI
9 348,30 €
WORLD UCITS ETF ACC P
6,11€ +1,33% A1 055,70 €
5,42 € /1530
AMUNDI PEA S&P 500 UCITS 408392€ >
ETF ACC
57,52 € +137% A 949,27 €
44,15 € / 71
BNP PARIBAS EASY STOXX
EUROPE 600 UCITS ETF 3008,98€ >
CAPITALISATION
21,19€ +1,88% A242,82 €
19,48 € / 142
CARMAT 1,20€ >
010 € +0,00 * N-222,24 €
1862 € /12
Plan d’Epargne programmé | a
8 e Ea M =
Comptes Ordres Listes Marchés Menu`,
  ocrNoise: `PEA\nNom Qté PRU Cours Valeur\nAmundi MSCI World LU1681043599 1O\t1O0,OO\t1O2,OO\t1O2O,OO`,
};
