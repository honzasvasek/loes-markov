#!/bin/bash
# Ververst de presentatiesite: regenereert site/images + data.json uit
# data/loes.db, en pusht alleen als er daadwerkelijk iets veranderd is.
# Aangeroepen via cron, zie site/README.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$REPO_ROOT/logs/site-refresh.log"

cd "$REPO_ROOT"
echo "=== $(date -Iseconds) ===" >> "$LOG"

"$REPO_ROOT/.venv/bin/python" site/build.py >> "$LOG" 2>&1

cd "$REPO_ROOT/site"
git add -A
if git diff --cached --quiet; then
    echo "geen wijzigingen, niets te pushen" >> "$LOG"
else
    git commit -q -m "Werk verversen ($(date -Iseconds))" >> "$LOG" 2>&1
    git push -q >> "$LOG" 2>&1
    echo "gepusht" >> "$LOG"
fi
