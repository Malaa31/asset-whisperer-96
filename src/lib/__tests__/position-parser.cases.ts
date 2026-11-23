export const positionParserCases = {
  peaWithIsinAndHeaders: `Mon PEA\nNom Quantité PRU Cours Valorisation +/- value\nAmundi MSCI World LU1681043599 12\t410,50\t432,10\t5185,20\t+5,27%\nTotal portefeuille 5 185,20`,
  mobileStack: `Compte titres CTO\nAir Liquide\n10\n142,00 €\n145,00 €\n1450,00 €\nSanofi\n5\n90,00 €\n95,00 €\n475,00 €`,
  noIsin: `Portefeuille\nApple\n2,5\n180,00 €\n190,00 €\n475,00 €\nMicrosoft\n3\n300,00 €\n310,00 €\n930,00 €\nLiquidités 120,00 €`,
  livretA: `Livret A\nPlafond 22 950,00 €\nTaux 3,00 %\nSolde\n12345,67 €\nIntérêts acquis 125,00 €`,
  ocrNoise: `PEA\nNom Qté PRU Cours Valeur\nAmundi MSCI World LU1681043599 1O\t1O0,OO\t1O2,OO\t1O2O,OO`,
};
