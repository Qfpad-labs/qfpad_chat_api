# QFPad Chat API

Standalone chat and action-draft service for QFPad.

This service is intentionally separate from the allocator worker. It is the
public HTTP surface for:

- docs-grounded Q&A
- live QPAD sale Q&A
- structured action drafts for the frontend

## Setup

```bash
npm install
npm run db:migrate
```

## Run

```bash
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Docs Sync

```bash
npm run docs:sync
```

The initial docs sync is intentionally small and uses `QFPAD_DOCS_SEED_URLS`.

## Endpoints

- `GET /api/chat/health`
- `POST /api/chat`

## Guardrails

- user funds are never signed or submitted by this service
- user secrets are never requested or stored
- the model can return action drafts only; execution stays in the frontend
