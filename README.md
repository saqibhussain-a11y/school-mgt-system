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
npm run db:seed
```

`db:seed` creates a default school and one `SUPER_ADMIN` login: `admin@school.test` / `ChangeMe123!` (override via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars). All further users are created through `POST /api/auth/register`, which only an authenticated `SUPER_ADMIN`/`SCHOOL_ADMIN` can call — matching the "no public signup" rule.

## Day-to-day

```bash
npm run docker:up      # start Postgres + Redis
npm run dev:web        # Next.js on :3000
npm run dev:api        # Express on :4000
npm run db:studio      # Prisma Studio (browse the DB)
npm run docker:down    # stop Postgres + Redis
```

## Auth module (V1)

`POST /api/auth/login`, `/refresh`, `/logout`, `/register` (admin-only), `/forgot-password`, `/reset-password`. Access tokens are short-lived JWTs (15m); refresh tokens are rotated on every use and revoked on reuse. Password reset OTPs are logged to the API console instead of emailed — no email provider is wired up yet (that's the Communication module, later on the roadmap).

## Academic structure module (V1)

`GET/POST/PATCH/DELETE /api/academic-sessions`, `/classes`, `/subjects`, `/sections`. Reads are open to any authenticated role; writes require `SUPER_ADMIN`/`SCHOOL_ADMIN`/`PRINCIPAL`. Classes and sections live inside an academic session so promotion/repeated years keep separate records.

## User/profile management module (V1)

`GET/POST/PATCH/DELETE /api/students`, `/api/staff`, `/api/guardians` — each create is transactional (a linked `User` login + profile row in one go, atomic rollback on failure). Writes require `SUPER_ADMIN`/`SCHOOL_ADMIN` (matches the "admin-created accounts, no public signup" rule); reads are scoped to staff-facing roles. `DELETE` never hard-deletes — students go to `WITHDRAWN`, staff to `DEACTIVATED`, so historical records stay attributable.

- `POST /api/students/:id/guardians` links an existing guardian (by `guardianId` or `guardianEmail`) to a student with a `relationshipType` (FATHER/MOTHER/GRANDPARENT/LEGAL_GUARDIAN/OTHER) — supports siblings sharing one guardian and a student having multiple guardians.
- `POST /api/students/bulk-import` accepts a CSV (`multipart/form-data`, field `file`; columns: `email,firstName,lastName,admissionNo,classId,sectionId,dob`). The whole batch is one transaction — one bad row rolls back the entire import, never a half-imported batch.
- Passwords are optional on create; when omitted, a random temporary password is generated and returned once in the response (no email provider is wired up yet, so it isn't emailed automatically).

## Moving to a new device (Mac ↔ Windows)

1. Push/pull this repo via git — never copy the folder manually (it would drag along `node_modules`, `.next`, and local `.env` files).
2. Re-run the **First-time setup** steps above on the new machine.
3. Everything else (Postgres, Redis) runs in Docker, so there is nothing to install natively per OS.
