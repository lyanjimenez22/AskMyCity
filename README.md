# AskMyCity

**One box. Your language. Your city's official answer.**

Residents of the City of Miami and Miami Gardens type or say what they need in Spanish, English, or Haitian Creole. They get one card: what it means, one next step, the official link, the official phone number, and audio.

Built at SharkByte 2026 (Miami Dade College, North Campus).

- **Live app:** https://ask-miami-now.base44.app

## The problem

City information exists, but it is spread across many platforms, written in English, and organized by department instead of by what residents need. The City of Miami uses separate systems for agendas, video, 311, and elections. Miami Gardens uses CivicWeb, CityCares, and Everbridge. One example: Miami Gardens' resident employment program sits on a page under business programs, where most job seekers would never look.

## What it does

1. The resident picks a city and a language, then types or speaks the need. For programs (housing, jobs, home repair, school) there is a short questionnaire.
2. The app matches the need to a **closed catalog of 24 official entries** (13 City of Miami, 11 Miami Gardens), each written in three languages.
3. It shows one card. **The AI never writes the answer and never creates a link.** At most, it chooses which catalog entry fits.
4. If nothing fits, the card gives the city's official contact (311 in Miami, 305-622-8000 in Miami Gardens). If the message sounds like an emergency, the card says to call 911 first.

## Trust rules

- Every link and phone number comes from an official city page (miami.gov or miamigardens-fl.gov) and carries the date it was checked. The emergency card links to Miami-Dade County.
- Programs never say "you qualify". They say "this program may be for you".
- No user messages are stored. No API keys are in this repository.
- Free for residents.

## Architecture

```
Resident (es / en / ht)
   │
   ▼
1. Emergency check           "fire", "injured", "incendio", "dife"... → call 911
2. Keyword router            matches the need to ONE entry of the resident's city
   │                         (multiword phrases weigh more than single words)
   ├── one clear match ───────────────────────────────────────────► card
   │
   ▼  tie between entries, or no keyword at all
3. Prune (intake)            restates the need in one English sentence; signed receipt
4. Swarms (Finder → Judge)   on a tie: may choose ONLY among the tied entries
                             no match: chooses among the city's entries, or null
   │
   ▼
5. Guardrail (code, no AI)   the id must exist AND belong to the resident's city
   │                         otherwise → "I don't know" + official phone
   ▼
Card: title, meaning, step, link and phone always come from data/resources.json
```

The repository has two backends that share the same catalog:

| File | What it is | Status |
| --- | --- | --- |
| `backend/askCity.function.js` | The function running in the live Base44 app. Public users get steps 1 and 2; anything else goes to the official phone. The Swarms + Prune check runs in an admin demo mode. | **Live** |
| `src/askcity.mjs` → `base44/functions/askCity/entry.js` | The full pipeline above. Swarms and Prune work on real resident questions, but only when keywords are not enough. | Built and tested (28 automated tests). Same request and response shape as the live function, so it can replace it in Base44. |

## Sponsor APIs

Checked live from the app on November 8, 2026 (details in `docs/ESTADO.md`):

- **Swarms API.** `POST /v1/swarm/completions` with a `SequentialWorkflow` of two agents that choose and then verify the catalog id. About 2.5 s and $0.02 per question. `GraphWorkflow` returned `403 premium_access_required` on our account, so the pipeline tries `SequentialWorkflow` first, then one `/v1/agent/completions` call per agent, then `GraphWorkflow`.
- **Prune API.** `POST https://api.withprune.com/v1/chat/completions` (OpenAI-compatible). Every call returns a signed receipt (`prune_metadata.receipt_signature`). The trace records that a receipt exists, never the signature itself.

Why the AI is used only on ties and unmatched questions: most questions are answered by keywords instantly, for free, with no risk of a wrong guess. The AI is spent where keywords fail, and the result is measured.

## Results

We wrote 42 test questions the way residents talk (Spanish, English, Haitian Creole), covering both cities, keyword ties, paraphrases, out-of-scope questions, and emergencies (`eval/questions.json`). The questions do not change to make a version pass.

| Metric (42 questions) | Live function, public path | Pipeline, keywords only | Pipeline + Prune + Swarms |
| --- | --- | --- | --- |
| Correct | 36 (85.7%) | 37 (88.1%) | run `npm run eval:ai` |
| Confident but wrong | 1 | 0 | |
| Tie resolved to a less specific official page | n/a | 3 | |
| Fell back to the official phone | 5 | 2 | |
| Links outside official government sites | 0 | 0 | 0 by design (guardrail) |

`npm run eval:live` runs the questions through the deployed function. `npm run eval` runs them through the pipeline without AI. Full lists of misses: `eval/RESULTS-live-function.md` and `eval/RESULTS-rules.md`.

The misses are the questions keywords cannot handle, like "the road in front of my house has a big hole" or "gen fatra moun jete sou teren vid la". Those are exactly the questions the pipeline sends to the Swarms agents.

## Catalog

`data/resources.json` is the single source of truth. Each entry has:

`id, city, kind (service | program), url, phone, checked, terms[], copy{es, en, ht}: [title, meaning, step], verification{status, by, date}`

`verification.status` is `verified` (checked against the official page, with evidence), `team-checked`, or `pending`. Corrections made while checking are listed in `docs/VERIFICATION.md`. For example, a Stormwater phone number that appears on no official page was replaced with the city's main line.

`data/resources_base44.csv` is the same catalog for the Base44 table import.

## Run it

```bash
# clone this repository, then from its folder:
cp .env.example .env     # keys are optional; without them the keyword path still works
npm test                 # 28 automated tests
npm run eval             # pipeline, keywords only
npm run eval:live        # the deployed Base44 function
npm run check:swarms     # checks the Swarms key and which endpoint works on your account
npm run check:prune      # checks the Prune key and the receipt
npm run eval:ai          # full pipeline with Prune + Swarms (needs keys)
npm run build            # regenerates base44/functions/askCity/entry.js
```

Requires Node 18 or newer. No dependencies.

## Repository layout

```
backend/askCity.function.js         live Base44 function
base44/functions/askCity/entry.js   generated full pipeline for Base44 (npm run build)
src/askcity.mjs                     emergency check, router, Prune, Swarms, guardrail, cards
data/resources.json                 24 official entries (source of truth)
data/resources_base44.csv           Base44 table import
eval/                               42 questions and results
scripts/                            build, evaluations, Swarms and Prune checks, link check
test/                               automated tests
docs/                               sponsor status, verification log
```

## What's next

- Explain any official city document (PDF or link) in the resident's language.
- Big decisions (bonds, leases) explained with arguments for and against, from public sources only.
- Public meeting summaries, and how to leave a public comment without attending.
- Follow-up on reports a resident already filed.

## Team

- **Miguel Jazzan:** Base44 app
- **Lyan Jiménez:** Swarms and Prune pipeline, evaluation
- **Ronald:** data verification, delivery

## Built with AI tools

We used Claude, Claude Code, ChatGPT, and Codex as assistants during the hackathon. All project code was written during the event.
