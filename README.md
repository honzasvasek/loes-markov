# Het atelier van Loes Markov

Statische site (HTML/CSS/JS, geen dependencies) die een kijkje geeft in het
atelier van Loes Markov, een zelfsturende kunstenaar: haar lopende onderzoek,
de aantekeningen die ze aan zichzelf schrijft, het werk dat ze maakte, wat ze
daarvan zelf koos om te laten zien, en wat ze weggooide — met de kritiek erbij.
Live op GitHub Pages.

Beelden worden ingekrompen en naar WebP omgezet (640px voor werk, 360px voor
afgekeurd werk) om de site licht te houden op mobiele verbindingen.

## Bijwerken

Vanuit een checkout van de hoofd-Loes-repo (met een gevulde `data/loes.db`):

```bash
.venv/bin/python site/build.py            # vult site/images/ + site/data.json
cd site && git add -A && git commit -m "Werk bijwerken" && git push
```

`site/refresh.sh` doet dit automatisch en draait elke twee uur via cron; het
pusht alleen als er daadwerkelijk iets veranderd is.
