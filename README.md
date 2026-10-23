# YatraSetu AI

**AI-powered multilingual safe-travel and crowd advisory assistant for Uttarakhand**
Minor Project, B.Tech CSE (AI/ML), Roorkee Institute of Technology, Roorkee
Ayush Singh, Roll No. 230240170024

YatraSetu (*setu* = bridge) connects Char Dham and Hemkund Sahib pilgrims with verified, personalised safety
information in their own language, and gives district officials one place to publish advisories and reach
travellers on an affected route.

## Features

| Module | What it does | AI / technique |
|---|---|---|
| Multilingual assistant | Answers yatra questions in English and Hindi (more via Bhashini), with sources and dates | Script-based language detection, TF-IDF + logistic-regression intent model, hybrid TF-IDF retrieval (RAG), optional LLM with numeric-grounding guardrail |
| Crowd forecast | 7-day footfall forecast per shrine vs. carrying capacity, lighter dates and alternatives | Histogram gradient boosting regressor on calendar + weather features |
| Route risk | Live risk map and per-segment risk with explanations, safe-halt suggestion | Transparent weighted risk score (IMD alert, rain, road status, terrain) |
| Health check | Readiness category, screening points and medical posts on the route | Rule-based triage (no diagnosis) |
| Trip alerts and SOS | Consent-based trip subscription, WhatsApp alerts with SMS fallback, SOS with nearest help | Haversine nearest-facility search |
| Officials' dashboard | Advisory drafting and four-eyes approval, road status, IMD alerts, delivery log, model metrics, audit log | Role-based access control |

## Quick start (macOS / Linux)

```bash
cd YatraSetu-AI
./run.sh
```

Then open <http://127.0.0.1:8000> (traveller app) and <http://127.0.0.1:8000/admin> (dashboard).
Demo logins: `editor / editor123` (drafts advisories) and `approver / approver123` (publishes them).

Manual setup:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/generate_data.py      # synthetic footfall history (already included)
python scripts/seed_demo.py          # demo weather alerts, road status, subscriptions
uvicorn app.main:app --reload
```

## Tests and evaluation

```bash
pytest -v                            # 18 unit and API tests
python scripts/evaluate.py           # retrieval, intent, emergency and forecast metrics
```

Latest results (see `docs/evaluation_results.json`):

| Metric | Result |
|---|---|
| Retrieval top-1 / top-3 accuracy (40 bilingual questions) | 87.5% / 95.0% |
| Intent accuracy (unseen questions) | 85.0% |
| Emergency recall | 100% |
| Off-topic rejection | 80% |
| Forecast MAPE, normal days (held-out 2025 season) | 13.3% |
| Crowd-band accuracy | 80.3% |

## Optional integrations

Set these environment variables to switch on external services:

| Variable | Purpose |
|---|---|
| `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` | Any OpenAI-compatible chat-completions endpoint for generative RAG answers |
| `BHASHINI_API_KEY`, `BHASHINI_USER_ID` | Bhashini translation for Indian languages beyond English and Hindi |

Without them the app runs fully offline with extractive answers.

## Project structure

```
app/
  main.py            FastAPI app: REST API, WhatsApp webhook, static pages
  assistant.py       conversation orchestrator (language -> intent -> retrieval -> live data -> answer)
  knowledge_base.py  bilingual knowledge base + hybrid TF-IDF retriever
  intent.py          intent classifier, emergency override, entity extraction
  language.py        language detection + Bhashini client
  llm.py             optional LLM call with grounding guardrail and PII redaction
  forecast.py        crowd forecasting model and evaluation
  risk.py            route-risk scoring and safe-halt search
  health.py          health-readiness rules
  alerts.py          subscriptions, advisories (four-eyes), alert dispatch with SMS fallback
  db.py, config.py   SQLite persistence and configuration
  data/              knowledge base, shrines, route network, footfall history
  static/            traveller PWA and officials' dashboard (HTML/CSS/JS, no external libraries)
scripts/             data generation, demo seeding, evaluation
tests/               pytest suite and bilingual gold question set
docs/                screenshots and evaluation results
```

## Data notes

* Carrying-capacity values are from the 2025 study reported by ETV Bharat (May 2026).
* The daily footfall history is **synthetic**, calibrated to published season totals, because shrine-wise daily
  data needs a data-sharing agreement. Replace `app/data/footfall_history.csv` with official data to retrain.
* Knowledge-base content and route attributes are compiled for demonstration and must be verified against current
  official advisories before any real deployment.
