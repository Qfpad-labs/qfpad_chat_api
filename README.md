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

This service now ships with bundled support guides for:

- the QPAD buyer quick guide
- QPAD Fiesta details

So it no longer depends on machine-local guide files from another repo.

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
It also syncs the bundled support guides from `docs/support/`.

## Render deployment

Deploy this as a separate Render Web Service.

Recommended settings:

- Runtime: `Node`
- Branch: `main`
- Build command:

```bash
npm install --include=dev && npm run build && npm run db:migrate:prod
```

- Start command:

```bash
npm run start
```

- Health check path:

```text
/api/chat/health
```

Important notes:

- The server supports Render's `PORT` env automatically.
- Set `CHAT_CORS_ORIGIN=https://qfpad.xyz`.
- Set `QPAD_STATUS_API_BASE_URL` to your allocator worker URL.
- Set your DeepSeek key and RPC URLs in Render env vars.

## Endpoints

- `GET /api/chat/health`
- `POST /api/chat`

## Guardrails

- user funds are never signed or submitted by this service
- user secrets are never requested or stored
- the model can return action drafts only; execution stays in the frontend
