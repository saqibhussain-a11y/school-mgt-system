# School Management System (SMS)

Single-tenant school management system, built to convert into a multi-tenant SaaS later. See the master project doc for full scope, roadmap, and rationale.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui · Express + TypeScript · PostgreSQL (pgvector) via Prisma 7 · Redis + BullMQ.

## Repo layout

```
apps/
  web/             Next.js frontend
  api/             Express backend (routes/services/middleware/ai)
packages/
  db/              Prisma schema + client (all DB access goes through here)
  shared-types/    TS types shared between web and api
services/
  ml-prediction/   (future) Python FastAPI microservice for performance prediction
docker-compose.yml Postgres + Redis, identical on macOS and Windows
```

**Golden rule:** route handlers never call Prisma directly — always go through a `services/*.service.ts` function. This is what keeps the future multi-tenant conversion cheap (see memory / master doc Section 5).

## Prerequisites

- Node.js 22 (see `.nvmrc` — use `nvm use` on Mac, `nvm-windows` on Windows)
- Docker Desktop (uses WSL2 backend on Windows — develop inside WSL2 for the smoothest experience)

## First-time setup

```bash
git clone <repo-url>
cd sms-project
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
npm install
npm run docker:up
npm run db:migrate
```

## Day-to-day

```bash
npm run docker:up      # start Postgres + Redis
npm run dev:web        # Next.js on :3000
npm run dev:api        # Express on :4000
npm run db:studio      # Prisma Studio (browse the DB)
npm run docker:down    # stop Postgres + Redis
```

## Moving to a new device (Mac ↔ Windows)

1. Push/pull this repo via git — never copy the folder manually (it would drag along `node_modules`, `.next`, and local `.env` files).
2. Re-run the **First-time setup** steps above on the new machine.
3. Everything else (Postgres, Redis) runs in Docker, so there is nothing to install natively per OS.
