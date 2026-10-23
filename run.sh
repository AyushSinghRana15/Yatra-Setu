#!/usr/bin/env bash
# One-command setup and run (macOS / Linux)
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env          # optional OpenRouter / Bhashini keys
[ -f app/data/footfall_history.csv ] || python scripts/generate_data.py
[ -f yatrasetu.db ] || python scripts/seed_demo.py
echo "Open http://127.0.0.1:8000  (officials' dashboard: http://127.0.0.1:8000/admin)"
echo "AI mode: edit .env and set OPENROUTER_API_KEY for LangChain + OpenRouter generation."
uvicorn app.main:app --host 127.0.0.1 --port 8000
