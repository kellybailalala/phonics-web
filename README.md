# TinySteps English (MVP)

TinySteps English is a web MVP for ESL learners ages 3-5, optimized for parent-led usage in Singapore.

## Implemented scope

- Parent signup/login (`email` or `phone` identity)
- Required consent before child profile creation
- Child profile with age-based placement tracks (`starter_a`, `starter_b`, `starter_c`)
- Daily lesson generation with 5 micro-activities
- Session lifecycle (`start` -> `complete`) with idempotent completion handling
- Reward loop on full session completion
- Parent progress dashboard endpoint (sessions, units, milestones)
- Child data deletion request endpoint (queued backend job)
- Analytics event logging for core PRD events
- Mobile-first single-page frontend prototype with onboarding, lesson flow, and dashboard

## Tech stack

- Node.js + Express
- TypeScript
- Plain JS frontend (served from `src/public`)
- In-memory data storage (MVP only)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Run tests

```bash
npm test
```

## API endpoints

- `POST /api/v1/parent/signup`
- `POST /api/v1/parent/login`
- `POST /api/v1/consent`
- `POST /api/v1/children`
- `GET /api/v1/children/:childId/lesson/today`
- `POST /api/v1/children/:childId/session/start`
- `POST /api/v1/children/:childId/session/complete`
- `GET /api/v1/children/:childId/progress`
- `POST /api/v1/children/:childId/data-deletion-request`

## Notes

- Persistence is intentionally in-memory for MVP speed. Restarting the server resets data.
- Prompt audio uses browser speech synthesis (`speech:` URLs) and does not perform pronunciation scoring.
