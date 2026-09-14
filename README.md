# School Management System (SMS)

A multi-tenant school management SaaS — one deployment serves many independent
schools, each with its own data, staff, students, fees, and settings, with a
separate Platform Admin layer for the SaaS owner to manage them all. Built
end-to-end: 8 role-based user types, 60+ database models, real payment and AI
integrations, and a CI/CD pipeline that gates production deploys on a real
production-boot smoke test.

This README documents the full system as it stands today — tech stack,
every module, how to run it on macOS and Windows, and how it actually
deploys to production.

## Why this project

Most portfolio CRUD apps stop at "create/read/update/delete a record." This
one is closer to what a real school-software vendor would have to build and
operate:

- **Multi-tenancy done properly** — a Prisma extension auto-scopes every
  database query to the correct school, so there is no `schoolId` to
  remember to filter by (and no way to forget it).
- **A genuine SaaS control plane** — a separate Platform Admin identity
  (not just another user role) that provisions schools, enforces seat
  limits and subscription status, and never gets to impersonate a school's
  own admin — a deliberate customer-trust boundary, not an oversight.
- **Two real external integrations**, not mocked ones — Stripe (webhook
  signature verification, idempotent payment recording, raw-body
  middleware ordering) and a provider-agnostic LLM client (5 swappable
  backends, grounded generation so the AI features can't hallucinate a
  fee balance).
- **Production engineering, not just features** — structured logging,
  graceful shutdown, Redis caching, a BullMQ background queue, rate
  limiting, an automated test suite, and a CI pipeline that only deploys
  after a real prod-boot smoke test passes.

## Tech stack

| Layer | Tools | Why |
|---|---|---|
| **Frontend** | Next.js 16 (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui (Base UI variant) | App Router for server components where they help and pure client interactivity where the data is inherently live; shadcn's Base UI flavor over Radix for a lighter-weight primitive layer. |
| **Backend** | Express · TypeScript · Zod | A plain, explicit service-layer architecture (routes never touch Prisma directly) — easy to reason about, easy to test, no framework magic hiding the request lifecycle. |
| **Database** | PostgreSQL (`pgvector` image) · Prisma 7 | Prisma's driver-adapter model plus a custom tenant-scoping extension is what makes the multi-tenancy safe by default rather than by discipline. `pgvector` is included for future embedding-based search. |
| **Cache / Queue** | Redis · BullMQ | Redis caches expensive report queries; BullMQ runs the timetable auto-generation algorithm as a background job instead of blocking a request. |
| **Realtime** | Socket.io | JWT-authenticated, per-user rooms — in-app notifications pushed live instead of polled. |
| **Payments** | Stripe (Checkout Sessions + webhooks) | Hosted checkout so no card data ever touches this app's servers; webhook-verified confirmation so a payment is only ever recorded once Stripe itself confirms it. |
| **AI** | A hand-rolled provider-agnostic LLM client — Groq, Google Gemini, Anthropic, OpenAI, or a local Ollama model | One interface, five swappable backends, chosen so the AI features work on a genuinely $0 budget (Groq/Gemini free tiers, or a fully local model) without being locked into one vendor. |
| **Storage / Email** | Cloudflare R2 (S3-compatible) · Nodemailer | R2 for assignment attachments (zero egress fees); real email via SMTP, with a zero-config disposable inbox (Ethereal) for local dev — no email provider needed to test the flow. |
| **Auth** | JWT (access + rotating refresh tokens), separate secrets for tenant users vs. the Platform Admin | Two structurally separate auth systems, not one role among many — a Platform Admin credential can never masquerade as a school user. |
| **DevOps** | Docker Compose (Postgres + Redis) · GitHub Actions CI · Render (Blueprint deploy) · Husky + lint-staged | See **Deployment** below for the full pipeline. |
| **Testing** | Vitest, real-database integration tests | Money-handling logic (fees, payroll) is tested against a real Postgres instance, not a mocked Prisma client — the class of bug this project actually caught in practice was a schema/type mismatch a mock would never have surfaced. |

## Architecture

```
apps/
  web/             Next.js frontend — the tenant dashboard AND the
                    Platform Admin console (/platform/*), one app
  api/             Express backend — routes → services → Prisma,
                    never routes → Prisma directly
packages/
  db/              Prisma schema, generated client, and the tenant-
                    scoping extension every query goes through
  shared-types/    TypeScript types shared between web and api
services/
  ml-prediction/   (reserved) Python FastAPI microservice for a future
                    performance-prediction model — not built yet
docker-compose.yml Postgres (pgvector) + Redis, identical on macOS and Windows
render.yaml        The production deployment Blueprint (see Deployment)
```

**The one rule that matters most:** route handlers never call Prisma
directly — every database access goes through a `services/*.service.ts`
function. This is what keeps 60+ models and 8 roles manageable, and it's
what made the multi-tenant conversion (see below) an additive change
instead of a rewrite.

### Multi-tenancy

Every tenant-scoped Prisma model gets `schoolId` **auto-injected** by a
custom extension in `packages/db/src/client.ts` — set once per request via
`AsyncLocalStorage` (`runWithTenant`) when a JWT is verified. A service
function can call `prisma.student.findMany({ where: { classId } })` with no
`schoolId` anywhere in sight and it is still correctly scoped. Row-Level
Security at the Postgres level was deliberately deferred — the application
layer is the enforced boundary today.

### Platform Admin (the SaaS control plane)

`PlatformAdmin` is not a `Role` value — it has no `schoolId`, authenticates
through a completely separate login (`/platform-login`) against its own JWT
secrets, and is structurally incapable of being tenant-scoped. From
`/platform`, the SaaS owner can:

- Provision new schools and their first `SCHOOL_ADMIN` (invited by email)
- Manage the plan catalog and enforce student/staff seat limits
- Suspend a school (instantly blocks login and kills its live sessions)
- View cross-school **Reports** (MRR, growth/churn, user counts) and a
  built-in **System Health** page (DB/Redis/queue status, request
  latency) — no external APM service
- Read a full audit log of every platform-level action

**Standing rule:** a Platform Admin can never log in as, or view, a school
admin's account — not even behind a safeguard. That's a deliberate
customer-trust decision, not a missing feature.

## Every module

### Core school operations
- **Academics** — sessions, classes, sections, subjects, rooms, periods
- **Students / Staff / Guardians** — full CRUD, CSV bulk admission with
  column mapping, configurable admission-number formats, decoupled
  credential flows (admin-set or self-service via email invite)
- **Attendance** — daily marking with holiday awareness, per-student
  history, class-summary views, role-scoped visibility
- **Staff Attendance** — geofenced selfie check-in/out
- **Leave management** — per-school configurable quotas, admin review,
  auto-syncs a student's attendance to `LEAVE` on approval
- **Announcements** — role/class-targeted, with real-time in-app delivery

### Academics & scheduling
- **Timetable** — a greedy/random-restart auto-generation algorithm
  (room-capacity best-fit, teacher/section overlap detection, avoidable-
  repeat detection across a week), plus manual drag-and-drop editing
- **Curriculum** — syllabus/chapter/schedule tracking, admin-authored,
  teacher-visible, with bulk generators

### Exams & results
- **Exam scheduling** — datesheets, cross-class seating allocation
  (manual column-blocked strategy), admit cards, invigilation duty
  assignment
- **Marks & results** — percentage-based grading, class result sheets with
  competition rank, publish/hide gating for student/parent visibility
- **Result card templates** — drag-to-calibrate PDF overlay onto a school's
  own pre-printed card stock, or a full generated PDF

### Fees & payments
- **Fee management** — manual invoicing with amount-snapshot-at-generation,
  scholarships that auto-apply, append-only refunds, and an overpayment
  credit-carry system (a derived credit pool, not a separate ledger table)
- **Online payment (Stripe)** — real Checkout Session + webhook
  integration, fully built and tested; currently **disabled behind one
  commented-out button** pending a PKR-capable payment gateway, since
  Stripe can't settle in the target market's currency

### HR
- **Payroll** — a school-opt-in module: salaries, monthly payslip
  generation with unpaid-leave deduction, adjustments, self-service payslip
  view

### Library & transport
- **Library** — loans, automatic per-day fines, a non-holding reservation
  queue with real notifications when a book becomes available
- **Transport** — routes, vehicles, student-to-route mapping (live GPS
  tracking explicitly out of scope for this version)

### Reports & analytics
- Attendance trend, exam performance trend, and fee collection charts
  (Recharts, a validated accessible color palette)
- **At-risk student flagging** — surfaces any student with attendance
  under 75% (30-day window) or a declining/failing exam trend, on the
  dashboard and a dedicated filterable report tab, exportable as CSV/PDF
- **AI report summaries** — a one-click, plain-language summary of any
  report, grounded strictly in that report's own already-computed data

### AI features (V4)
- **Grounded parent/student chatbot** — a persistent chat widget answering
  questions about a family's own fees, attendance, and recent
  announcements, with real conversation memory. It only ever answers from
  live-queried data injected into the prompt, and is explicitly instructed
  to say "I don't know" rather than invent a figure — verified live to
  correctly decline a question outside its given context instead of
  guessing.
- Built on a **provider-agnostic LLM client** — Groq, Gemini, Anthropic,
  OpenAI, and a local Ollama model are all interchangeable behind one
  interface, so nothing above it knows or cares which one answers.

### Platform / SaaS operations
- School provisioning, plan catalog & seat-limit enforcement, subscription
  suspension, cross-school reports, system health, full audit trail — see
  **Platform Admin** above.

### Security & reliability (cross-cutting)
- A 12-item security hardening pass across library/OTP/fee/leave/exam/
  admission/document/upload/CSV surfaces
- Rate limiting (per-IP for auth endpoints, per-user for the AI chat
  endpoint — different abuse vectors need different keys; a real IPv6
  bypass bug was caught and fixed here)
- Structured logging (Pino), graceful shutdown on `SIGTERM`, health checks
- Redis-cached reports, a BullMQ-queued timetable generator, N+1 query
  fixes, frontend code-splitting for chart-heavy pages

## Prerequisites

- **Node.js 22** (see `.nvmrc`) — `nvm use` on macOS, `nvm-windows` on
  Windows
- **Docker Desktop** — runs Postgres and Redis identically on both
  platforms. **Yes, use Docker on Windows too** — Docker Desktop's WSL2
  backend gives Windows the same Linux-container Postgres/Redis as macOS,
  which is the entire point: this project deliberately keeps zero
  natively-installed, OS-specific infrastructure. Develop *inside* WSL2 on
  Windows (not from a Windows-native terminal driving a WSL2 Docker
  backend) for the smoothest experience — file-watching and npm install
  speed are both meaningfully better from inside the Linux filesystem.

## Clone & first-time setup

Identical on macOS and Windows (inside WSL2):

```bash
git clone <repo-url>
cd school-mgt-system

# 1. Environment variables — copy each example file, then fill in real
#    values where noted (see "Environment variables" below for what each
#    one does and which are optional)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp packages/db/.env.example packages/db/.env

# 2. Install all workspace dependencies (root + apps/api + apps/web +
#    packages/db + packages/shared-types) in one pass
npm install

# 3. Start Postgres + Redis in Docker
npm run docker:up

# 4. Apply the database schema, then seed a starter school + the one
#    Platform Admin login
npm run db:migrate
npm run db:seed
```

`db:seed` prints something like:

```
Seeded school "Default School" (id: ...)
Seeded platform admin: admin@school.test / ChangeMe123!
```

override the login via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars
before seeding if you don't want the default.

### Getting your first school-admin login

The seed only creates a **Platform Admin** — there's no school-level user
yet, by design (a Platform Admin provisions schools, it doesn't come
pre-loaded with fake tenant data):

1. `npm run dev:api` and `npm run dev:web` (see **Day-to-day** below)
2. Open `http://localhost:3000/platform-login`, sign in with the seeded
   Platform Admin credentials
3. **Schools** → use the seeded "Default School" (or create a new one) →
   create its first `SCHOOL_ADMIN`
4. No SMTP configured yet? The invite email is still "sent" — to a
   disposable [Ethereal](https://ethereal.email) inbox. Check the API
   terminal for a line like `[mail] ... preview: https://ethereal.email/message/...`
   and open that link to get the real invite/claim link
5. Claim the account, set a password, and log in normally at
   `http://localhost:3000/login`

## Environment variables

Four `.env` files, one per package that needs its own config:

| File | Required vars | What's optional |
|---|---|---|
| `.env` (root) | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT` | Only read by `docker-compose.yml` — defaults work out of the box, change only if those ports conflict with something else on your machine. |
| `apps/api/.env` | `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_PLATFORM_ACCESS_SECRET`, `JWT_PLATFORM_REFRESH_SECRET`, `CORS_ORIGIN`, `WEB_APP_URL`, `API_BASE_URL` | `SMTP_*` (falls back to Ethereal), `R2_*` (falls back to local disk), `STRIPE_*` (feature returns 501 if unset), `LLM_PROVIDER`/`*_API_KEY` (AI features return 501 if unset). |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` | — |
| `packages/db/.env` | `DATABASE_URL` | `DATABASE_POOL_MAX` (defaults to 10). |

Every optional block above is deliberately **additive** — the app boots
and every core module works with none of them set; each one just unlocks
one extra capability (real email, real file storage, real online payment,
the AI features) once you provide a real key. This is why `apps/api/.env.example`
has them all pre-listed (commented out) with a one-line note on where to
get each one for free.

## Day-to-day

```bash
npm run docker:up      # start Postgres + Redis
npm run dev:api        # Express on :4000 (terminal 1)
npm run dev:web        # Next.js on :3000 (terminal 2)
npm run db:studio      # Prisma Studio — browse the DB visually
npm run docker:down    # stop Postgres + Redis
```

Other useful root scripts:

```bash
npm run typecheck      # tsc --noEmit across every workspace
npm run lint           # eslint across every workspace
npm run test           # vitest — includes real-DB integration tests
npm run build          # production build of every workspace
```

## Moving to a new device (Mac ↔ Windows)

1. Push/pull this repo via git — never copy the folder manually (it would
   drag along `node_modules`, `.next`, and local `.env` files).
2. Re-run **Clone & first-time setup** above on the new machine.
3. Everything else (Postgres, Redis) runs in Docker — there is nothing
   installed natively per OS to keep in sync.

---

## Deployment

Production runs on [Render](https://render.com), defined entirely as code
in `render.yaml` (a Render **Blueprint** — one file provisions the
database, the Redis instance, and both web services). Deploys are
**gated by CI**, not triggered automatically on every push.

### The full pipeline, in order

```
git push origin main
        │
        ▼
GitHub Actions (.github/workflows/ci.yml)
  1. Spin up real Postgres (pgvector) + Redis service containers
  2. npm ci
  3. Generate the Prisma client
  4. Apply every migration to a genuinely fresh database
     (catches a migration that doesn't apply cleanly, not just
     "it worked on my dev DB that already had the old schema")
  5. Typecheck the whole monorepo
  6. Lint the whole monorepo
  7. Run the full test suite (including real-DB integration tests)
  8. Build every workspace
        │
        ▼  (only if every step above passed)
CI calls two Render Deploy Hook URLs (stored as GitHub secrets)
        │
        ▼
Render builds and deploys sms-api and sms-web independently
```

A broken change never reaches production at all — it's caught in CI
*before* a deploy hook is ever called, rather than being deployed and then
discovered broken.

### 1. Database (Postgres)

Provisioned by the `databases:` block in `render.yaml` — Render creates a
managed Postgres instance and exposes its connection string. `sms-api`
picks it up automatically via:

```yaml
- key: DATABASE_URL
  fromDatabase: { name: sms-postgres, property: connectionString }
```

No manual connection-string copying — Render wires this at deploy time.
Migrations run automatically as Render's `preDeployCommand`
(`npm run migrate:deploy -w packages/db`) on every deploy, before the new
API code goes live.

**Free-tier note:** a free Render Postgres instance is deleted 30+14 days
after creation unless upgraded to a paid plan — fine for a portfolio demo,
not for anything you intend to keep long-term.

### 2. Backend (`sms-api`)

```yaml
buildCommand:   npm ci && npm run generate -w packages/db && npm run build -w apps/api
preDeployCommand: npm run migrate:deploy -w packages/db
startCommand:   npm run start -w apps/api
healthCheckPath: /api/health
```

Runs as a plain Node process (`tsx`/compiled JS, not a Docker image) on
Render's free web-service plan. Environment variables split into three
groups in `render.yaml`:

- **Auto-generated** (`generateValue: true`) — all four JWT secrets. Render
  creates a strong random value per secret at first sync; you never type
  these in.
- **Auto-wired** (`fromDatabase` / `fromService`) — `DATABASE_URL`,
  `REDIS_URL`.
- **Manual, one-time** (`sync: false` — the value has to be pasted into the
  Render dashboard after the first Blueprint sync, since these are real
  external credentials `render.yaml` can't know):
  `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`, `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME`.
  Leave them unset and the app runs fine with email going to a disposable
  test inbox and files on local disk — same graceful-degradation pattern
  as local dev. (`STRIPE_*` and `LLM_PROVIDER`/`*_API_KEY` aren't in
  `render.yaml` yet either, for the same reason — add them as `sync: false`
  vars the same way if you turn those features on in production.)

`CORS_ORIGIN`, `WEB_APP_URL`, and `API_BASE_URL` are hardcoded to each
service's actual Render URL rather than linked via `fromService`, because
`fromService` only exposes a private internal host:port — not the public
HTTPS URL a real browser needs.

### 3. Frontend (`sms-web`)

```yaml
buildCommand: npm ci && npm run build -w apps/web
startCommand: npm run start -w apps/web
```

One environment variable: `NEXT_PUBLIC_API_URL`, pointing at `sms-api`'s
public URL. This gets **baked into the client JavaScript bundle at build
time** (Next.js's `NEXT_PUBLIC_*` convention) — if you ever change the
API's URL, `sms-web` needs a fresh build, not just a restart.

### 4. Redis (`sms-redis`)

A Render "Key Value" service on the free plan, wired into `sms-api` via
`fromService`. Free-tier note: no disk persistence — fine for its actual
job here (caching report queries), but any BullMQ job still queued (not
yet run) at restart time is lost. Only matters for an in-flight timetable
auto-generation job, which a user can simply re-trigger.

### One-time manual setup (after the first Blueprint sync)

Render Blueprints can't express secrets or cross-service webhook URLs, so
three things happen once, by hand, in the Render dashboard:

1. Copy each web service's **Deploy Hook URL** (Settings tab) into this
   repo's GitHub secrets as `RENDER_DEPLOY_HOOK_API` and
   `RENDER_DEPLOY_HOOK_WEB` — this is what lets CI trigger a deploy only
   after everything passes.
2. Fill in the `sync: false` environment variables listed above (SMTP, R2,
   and optionally Stripe/AI provider keys) in each service's Environment
   tab.
3. Confirm the Postgres and Redis free-tier caveats above are acceptable,
   or upgrade both to a paid plan before relying on this for anything real.

From then on, every push to `main` that passes CI deploys itself — no
further manual steps.

---

## Known simplifications

Documented deliberately, not hidden:

- Auth tokens live in `localStorage`, not httpOnly cookies — the
  established tradeoff for this app's shape; it's also why Next.js
  `proxy.ts`/`middleware.ts` isn't used for route protection (it runs
  server-side and structurally can't read `localStorage` — see
  `dashboard-shell.tsx` for the client-side guard, and every Express route
  for the real, server-enforced boundary).
- Row-Level Security at the Postgres level was deferred in favor of the
  application-layer tenant-scoping extension.
- Live vehicle GPS tracking, SMS notifications, and full offline support
  were explicitly scoped out — see the project's internal roadmap notes
  for the reasoning behind each.
- Online payment (Stripe) is fully built but currently disabled — see
  **Fees & payments** above.
