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
| Multilingual assistant | Answers yatra questions in English and Hindi (more via Bhashini), with sources and dates | Script-based language detection, TF-IDF + logistic-regression intent model, hybrid TF-IDF retrieval (RAG), OpenRouter LLM through LangChain with a numeric-grounding guardrail |
| Crowd forecast | 7-day footfall forecast per shrine vs. carrying capacity, lighter dates and alternatives | Histogram gradient boosting regressor on calendar + weather features |
| Route risk | Live risk map and per-segment risk with explanations, safe-halt suggestion | Transparent weighted risk score (IMD alert, rain, road status, terrain) |
| Health check | Readiness category, screening points and medical posts on the route | Rule-based triage (no diagnosis) |
| Trip alerts and SOS | Consent-based trip subscription, WhatsApp alerts with SMS fallback, SOS with nearest help | Haversine nearest-facility search |
| Officials' dashboard | Advisory drafting and four-eyes approval, road status, IMD alerts, delivery log, model metrics, audit log | Role-based access control |

## Quick start (macOS / Linux)

```bash
cd YatraSetu-AI
cp .env.example .env          # optional: add OPENROUTER_API_KEY for generative answers
./run.sh
```

Then open <http://127.0.0.1:8000> (traveller app) and <http://127.0.0.1:8000/admin> (dashboard).
Demo logins: `editor / editor123` (drafts advisories) and `approver / approver123` (publishes them).

Manual setup:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # optional AI provider config
python scripts/generate_data.py      # synthetic footfall history (already included)
python scripts/seed_demo.py          # demo weather alerts, road status, subscriptions
uvicorn app.main:app --reload
```

## AI stack: OpenRouter + LangChain

The generative layer is a LangChain **LCEL** chain:

```
ChatPromptTemplate  →  ChatOpenAI(OpenRouter)  →  StrOutputParser
```

Set `OPENROUTER_API_KEY` in `.env` (get one at <https://openrouter.ai/keys>) and optionally
`OPENROUTER_MODEL` (default `openai/gpt-4o-mini`). OpenRouter's attribution headers
(`HTTP-Referer`, `X-Title`) and a fallback-model list are supported.

Safety and cost controls stay in front of and behind the model:

* emergencies are answered by a deterministic template and **never** call the LLM;
* retrieval only sends approved knowledge-base passages and live service data;
* every number in the generated answer must appear in those passages, otherwise the
  answer is rejected and the extractive response is shown;
* phone numbers and e-mails are redacted before text leaves the system;
* responses are cached in-process and the chain degrades gracefully to offline mode on
  timeout, auth or quota errors.

Without a key the app still runs end to end using extractive answers. The current mode is
visible in the traveller UI and at `GET /api/ai/status`.

## Tests and evaluation

```bash
pytest -v                            # 23 unit and API tests
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

## Demo materials

| File | What it is |
|---|---|
| `presentation/YatraSetu_AI_Demo.pptx` | 17-slide live-demo deck with speaker notes on every slide |
| `docs/DEMO_SCRIPT.md` | Pre-flight checklist, timed run sheet, exact demo inputs, fallback table and Q&A |
| `presentation/YatraSetu_AI_Pitch.pptx` | 15-slide project pitch for reviews and funding conversations |

Rebuild the demo deck with `python scripts/make_demo_deck.py`.

## Optional integrations

Set these environment variables (or put them in `.env`) to switch on external services:

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | OpenRouter model used through the LangChain chain (generative RAG answers) |
| `OPENROUTER_FALLBACK_MODELS` | Comma-separated OpenRouter fallback models |
| `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` | Any other OpenAI-compatible endpoint (used only when the OpenRouter key is empty) |
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
  llm.py             LangChain + OpenRouter chain, grounding guardrail and PII redaction
  forecast.py        crowd forecasting model and evaluation
  risk.py            route-risk scoring and safe-halt search
  health.py          health-readiness rules
  alerts.py          subscriptions, advisories (four-eyes), alert dispatch with SMS fallback
  db.py, config.py   SQLite persistence and configuration
  data/              knowledge base, shrines, route network, footfall history
  static/            traveller PWA and officials' dashboard (HTML/CSS/JS, no external libraries)
scripts/             data generation, demo seeding, evaluation, demo-deck build
tests/               pytest suite and bilingual gold question set
docs/                screenshots, diagrams, evaluation results, demo runbook
presentation/        live-demo deck and project pitch
```

## Data notes

* Carrying-capacity values are from the 2025 study reported by ETV Bharat (May 2026).
* The daily footfall history is **synthetic**, calibrated to published season totals, because shrine-wise daily
  data needs a data-sharing agreement. Replace `app/data/footfall_history.csv` with official data to retrain.
* Knowledge-base content and route attributes are compiled for demonstration and must be verified against current
  official advisories before any real deployment.
