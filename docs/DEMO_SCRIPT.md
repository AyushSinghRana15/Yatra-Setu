# YatraSetu AI — live demo runbook

**Deck:** [`presentation/YatraSetu_AI_Demo.pptx`](../presentation/YatraSetu_AI_Demo.pptx) — 17 slides, speaker notes on every slide.
**Duration:** 6–7 minutes of demo + 3–5 minutes of questions.
**Golden rule:** never debug in front of the audience. Switch to the screenshots, finish the story, fix it afterwards.

---

## 0. Pre-flight (do this 10 minutes before)

```bash
cd YatraSetu-AI
cp .env.example .env            # first time only
# optional: put your OpenRouter key in .env
./run.sh
```

Open these in separate browser tabs:

| Tab | URL |
|---|---|
| Traveller app | <http://127.0.0.1:8000> |
| Officials' dashboard | <http://127.0.0.1:8000/admin> |
| AI status (JSON) | <http://127.0.0.1:8000/api/ai/status> |
| API docs (backup) | <http://127.0.0.1:8000/docs> |

Checks:

```bash
source .venv/bin/activate
pytest -q                                  # expect: 23 passed
python scripts/evaluate.py                 # rewrites docs/evaluation_results.json
```

- [ ] Server responds on `:8000` and `:8000/admin`
- [ ] Dashboard has data (5 subscriptions, 1 draft/published advisory, KPI strip)
- [ ] AI badge is visible on the traveller screen
- [ ] `pytest -q` passes
- [ ] This deck is open on slide 5 (screenshots as fallback)
- [ ] Laptop volume, brightness, charger

### OpenRouter setup (optional but recommended)

1. Create a key at <https://openrouter.ai/keys>.
2. Put it in `.env`:

   ```dotenv
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=openai/gpt-4o-mini
   # optional fallbacks:
   OPENROUTER_FALLBACK_MODELS=google/gemini-2.5-flash,meta-llama/llama-3.3-70b-instruct
   ```

3. Restart `uvicorn`, then check <http://127.0.0.1:8000/api/ai/status>:

   ```json
   {"enabled": true, "provider": "openrouter", "framework": "LangChain",
    "model": "openai/gpt-4o-mini", "mode": "llm-rag"}
   ```

4. Ask one question and confirm the details panel says **Answer mode: llm-rag**.

If the key is missing, expired or out of credit, the app automatically returns to extractive mode. That is a feature — say so, don't apologise.

---

## 1. Run sheet

| Time | Slide | Screen | Exact input / action | The one line to say |
|---|---|---|---|---|
| 0:00 | 1–2 | — | — | “Five stops, one user problem each.” |
| 0:40 | 4 | — | — | “Meet Sunita, 62. She has faith and savings, not information.” |
| 1:15 | 5 | `/` Assistant | **Is Kedarnath crowded this week?** | “Grounded, with a source and date.” |
| 1:35 | 5 | `/` Assistant | **केदारनाथ में कल कितनी भीड़ होगी?** | “Same discipline in Hindi.” |
| 1:55 | 6 | `/` Assistant | **my father has chest pain near Linchauli** | “In an emergency the model is not in the loop.” |
| 2:10 | 6 | `/` Assistant | **What is the GDP of Brazil in 1990?** | “It would rather say ‘I don’t know’ than invent.” |
| 2:25 | 7 | Crowd forecast | Kedarnath → pick a May/June weekend if needed | “We don’t just predict the crowd — we move it.” |
| 3:00 | 8 | Route risk | Destination **Kedarnath** → Check route | “Not a district alert — your road, on your date.” |
| 3:40 | 9 | Health check | Age **68**, BP ticked, medium fitness → Check readiness; then tick chest pain | “It sorts risk. It does not play doctor.” |
| 4:10 | 10 | Trip alerts & SOS | Tick consent → Subscribe; then **SOS** at 30.66, 79.03 | “Alerts are targeted by road and date.” |
| 4:35 | 11 | `/admin` | Sign in **editor / editor123** → Overview → Audit | “The control room sees what pilgrims ask.” |
| 5:00 | 12 | `/admin` → Advisories | Draft the pre-filled Sonprayag advisory → submit | “The author cannot approve their own advisory.” |
| 5:20 | 12 | `/admin` | Sign in **approver / approver123** → Publish | “4 trips: 3 WhatsApp, 1 SMS fallback.” |
| 5:40 | 12 → `/` | Assistant | **Is there debris near Sonprayag?** | “Approval updates the assistant immediately.” |
| 6:00 | 13–14 | — | — | “One small LangChain chain, fenced by guardrails.” |
| 6:40 | 15–17 | — | — | “One district, one data MoU, one season.” |

---

## 2. Step-by-step script

### 2.1 Assistant (slide 5)

1. Keep language on **Auto**.
2. Ask `Is Kedarnath crowded this week?`
   - Point at the **live forecast** in the answer.
   - Point at the **source chip** with the last-updated date.
   - Point at **Last response details**: intent `crowd`, confidence, shrine `kedarnath`.
3. Ask `केदारनाथ में कल कितनी भीड़ होगी?`
   - Answer stays in Hindi.
   - Same source discipline.

**Say:** “The model is allowed to phrase an answer. It is not allowed to decide the facts.”

### 2.2 Emergency + honest fallback (slide 6)

1. Ask `my father has chest pain near Linchauli`.
   - Red SOS bubble, **Call 112**, ambulance 108.
   - Details show `emergency` with confidence 1.0.
2. Ask `What is the GDP of Brazil in 1990?`
   - Fallback: “I could not find a verified answer… in an emergency dial 112.”

**Say:** “Emergency recall is 100% in evaluation, and emergencies never touch the LLM.”

### 2.3 Crowd forecast (slide 7)

1. Open **Crowd forecast**, choose **Kedarnath**.
2. Walk the seven day cards: Low, Moderate, High, Over capacity.
3. If no High day appears, move the date to a May/June weekend.
4. Show the lighter-date and alternative-shrine suggestion.

**Say:** “Kedarnath’s recommended capacity is 13,111 a day. The model’s held-out error is 13.3% on normal days.”

### 2.4 Route risk (slide 8)

1. Open **Route risk**, destination **Kedarnath**, click **Check route**.
2. Read the worst segment and the “why” column.
3. Hover a coloured segment on the map.
4. Point at the safe halt if the segment is Orange/Red.

**Say:** “The score is explainable: IMD alert, rain, official road status, terrain. A closed road is always Red.”

### 2.5 Health readiness (slide 9)

1. Age `68`, high blood pressure ticked, fitness “can walk 5 km”, destination Kedarnath.
2. **Check readiness** → “Consult doctor first”.
3. Point at screening point **Sonprayag** and the medical posts.
4. Tick **chest pain or pressure**, run again → “Do not trek now”.
5. Untick it before moving on.

**Say:** “Rules, not ML — a red flag deserves a deterministic answer.”

### 2.6 Alerts and SOS (slide 10)

1. Tick the consent box.
2. Subscribe `9876543210` for Kedarnath (demo convention: numbers ending in 0 force SMS fallback).
3. Show the returned segment list and the masked number.
4. Click **SOS** with the pre-filled coordinates.
5. Show nearest help (Kedarnath, ~1 km), 112 link and WhatsApp share.

**Say:** “Targeted by route segment and travel date. Consent first, hashed number, SMS fallback.”

### 2.7 Officials' dashboard (slides 11–12)

1. `/admin` → sign in **editor / editor123**.
2. Overview: KPI strip, queries by intent and language, live route risk.
3. **Advisories** tab: the Sonprayag form is pre-filled → **Submit for approval**.
4. Try to approve it as editor → HTTP 403 (four-eyes rule).
5. Sign in **approver / approver123** → **Publish**.
6. Point at the result: **4 recipients · 3 WhatsApp · 1 SMS fallback**.
7. Back to the traveller app: `Is there debris near Sonprayag?` → the new advisory is a source.
8. Optional: **Audit log** shows login/draft/approve/road/weather events.

**Say:** “A publish reaches only the trips on that road, and the assistant can cite it immediately.”

### 2.8 Architecture and proof (slides 13–14)

Do not click anything. Point at the four boxes:

1. language + intent (emergency override first),
2. hybrid TF-IDF retrieval over approved documents,
3. LangChain LCEL: prompt → OpenRouter → parser,
4. guardrail: every number must exist in the retrieved passages, else fall back.

**Say:** “23 tests, 100% emergency recall, 13.3% forecast error. Reproducible with two commands.”

---

## 3. If something breaks

| Symptom | Recovery |
|---|---|
| No internet / no API key | Offline extractive mode is automatic. Continue; the badge explains it. |
| OpenRouter 401 / 429 / timeout | Check key and credits. `generate()` returns `None` and the app falls back to extractive. |
| Dashboard empty or stale | `rm yatrasetu.db && python scripts/seed_demo.py`, restart uvicorn. |
| Port 8000 busy | `uvicorn app.main:app --port 8001`, use `:8001` in the browser. |
| Browser/projector fails | Use `docs/screenshots/` and the screenshot slides in this deck. |
| Advisory already published | Draft a new one with a different title; the demo form is pre-filled. |
| Hindi font missing | Use the English questions; the deck screenshots show both. |

---

## 4. Likely questions

**Is the footfall data real?**
Daily shrine-wise history is synthetic, calibrated to published season totals. Capacity values and knowledge-base content are sourced. Official daily counts need a data-sharing MoU; the pipeline accepts them without code changes.

**Can the LLM hallucinate?**
It only sees retrieved passages. Every number it writes must appear in those passages, otherwise the answer is discarded. Emergencies bypass the model entirely.

**What about privacy?**
Explicit consent, SHA-256 hashed phone numbers, masked display numbers, PII redaction before any model call, 90-day retention promise. Aligned with the DPDP Act 2023.

**Why will officials use it?**
One publish reaches only affected trips; four-eyes approval is enforced in code; every action is audited. It replaces phone calls with a delivery report.

**What do you need next?**
A data-sharing MoU, two pilot districts (Rudraprayag + Chamoli), and WhatsApp Business / Bhashini sandboxes.

---

## 5. After the demo

```bash
# stop the server: Ctrl+C
# reset the demo database for the next run
rm -f yatrasetu.db
python scripts/seed_demo.py
```

Do **not** commit `.env`, `yatrasetu.db`, `.venv/` or `__pycache__/` — they are already in `.gitignore`.

---

## 6. Where the numbers come from

| Claim | Source |
|---|---|
| 23 / 23 tests | `pytest -q` |
| 87.5% / 95.0% retrieval | `scripts/evaluate.py` on `tests/gold_set.json` |
| 100% emergency recall | 10 bilingual emergency phrasings in `scripts/evaluate.py` |
| 13.3% MAPE / 80.3% band accuracy | held-out 2025 season, `docs/evaluation_results.json` |
| 1.3 ms retrieval + intent | same evaluation run, CPU only |
| 4 recipients / 3 WhatsApp / 1 SMS | live advisory workflow in the seeded demo DB |
