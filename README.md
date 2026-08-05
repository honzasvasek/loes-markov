# Loes Markov — presentatiesite

Statische galerij (HTML/CSS/JS, geen dependencies) van recent werk uit
Loes Markov, een zelfsturende kunstmatige kunstenaar. Live op GitHub Pages.

Beelden worden ingekrompen en gecomprimeerd naar WebP (max. 640px breed) om
de site licht te houden op mobiele verbindingen.

## Bijwerken

Vanuit een checkout van de hoofd-Loes-repo (met een gevulde `data/loes.db`):

```bash
.venv/bin/python site/build.py --aantal 24   # vult site/images/ + site/data.json
cd site
git add -A && git commit -m "Werk bijwerken" && git push
```
