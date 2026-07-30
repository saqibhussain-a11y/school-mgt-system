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

`POST /api/auth/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password`. Access tokens are short-lived JWTs (15m); refresh tokens are rotated on every use and revoked on reuse.

## Email notifications (V2)

Real email, via Nodemailer (`apps/api/src/lib/mailer.ts`) — not console-logged codes anymore:

- **Forgot-password OTP** — emailed instead of printed to the API console.
- **Welcome email with credentials** — sent whenever an account gets an auto-generated temporary password (school admin, staff, student, guardian, including every row of a CSV bulk import). If an admin explicitly sets a password themselves instead of letting one be generated, no email goes out (matches the existing "temp password shown once" logic — nothing to email in that case).
- **"Your password was changed"** — sent after an admin-triggered reset or a forgot-password/OTP reset, as a security signal to the account owner. Not sent for the self-service "change password while logged in" flow, since that's already an active, authenticated action with immediate in-app feedback.

**No SMTP setup needed for local dev**: leave `SMTP_HOST` unset in `apps/api/.env` and the mailer auto-provisions a disposable [Ethereal](https://ethereal.email) inbox on first send — nothing leaves the building, and a preview link for every email is logged to the API console (`[mail] "..." to ... — preview: https://ethereal.email/message/...`). Open that link to see exactly what the recipient would have received. To send through a real mailbox, fill in `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` in `.env` (see `.env.example`) — same code path, no code changes needed.

`POST /api/auth/register` is `SUPER_ADMIN`-only and can **only** create a `SCHOOL_ADMIN` (`registerSchema` enforces `role: z.literal("SCHOOL_ADMIN")` — it's not a general-purpose "create any role" endpoint). Every other role has its own dedicated creation endpoint that also provisions the matching profile row (`/api/staff` for `PRINCIPAL`/`TEACHER`/etc., `/api/students`, `/api/guardians`) — those no longer accept `SUPER_ADMIN` as a caller.

## Account-creation hierarchy (V1)

- **`SUPER_ADMIN`** creates and manages **`SCHOOL_ADMIN`** accounts only (`/dashboard/school-admins`, `SUPER_ADMIN`-only nav item). They keep read-only visibility into staff/students/guardians for oversight, but the create/edit/deactivate actions and APIs are no longer available to them.
- **`SCHOOL_ADMIN`** is the one who actually runs the school day to day: creates/edits staff (including `PRINCIPAL`), students, and guardians.
- This is a straightforward least-privilege split, not multi-tenancy — there's still exactly one `School` row. A `SUPER_ADMIN` overseeing multiple *actual* schools (with a "which organization is this teacher in" view) is the SaaS conversion already earmarked for later, not something this change touches.

## Academic structure module (V1)

`GET/POST/PATCH/DELETE /api/academic-sessions`, `/classes`, `/subjects`, `/sections`. Reads are open to any authenticated role; writes require `SUPER_ADMIN`/`SCHOOL_ADMIN`/`PRINCIPAL`. Classes and sections live inside an academic session so promotion/repeated years keep separate records.

## User/profile management module (V1)

`GET/POST/PATCH/DELETE /api/students`, `/api/staff`, `/api/guardians` — each create is transactional (a linked `User` login + profile row in one go, atomic rollback on failure). Writes require `SCHOOL_ADMIN` (see "Account-creation hierarchy" above); `SUPER_ADMIN` and other staff-facing roles keep read access. `DELETE` never hard-deletes — students go to `WITHDRAWN`, staff to `DEACTIVATED`, so historical records stay attributable.

- `POST /api/students/:id/guardians` links an existing guardian (by `guardianId` or `guardianEmail`) to a student with a `relationshipType` (FATHER/MOTHER/GRANDPARENT/LEGAL_GUARDIAN/OTHER) — supports siblings sharing one guardian and a student having multiple guardians.
- `POST /api/students/bulk-import` accepts a CSV (`multipart/form-data`, field `file`; columns: `email,firstName,lastName,admissionNo,classId,sectionId,dob`). The whole batch is one transaction — one bad row rolls back the entire import, never a half-imported batch.
- Passwords are optional on create; when omitted, a random temporary password is generated and returned once in the response (no email provider is wired up yet, so it isn't emailed automatically).

## Attendance module (V1)

`POST /api/attendance` marks a whole class/section's roster for a date in one atomic call (`{classId, sectionId, date, records: [{studentId, status, remarks?}]}`, status one of `PRESENT`/`ABSENT`/`HALF_DAY`/`LEAVE`); re-marking the same student/date corrects the existing record instead of duplicating it. Marking is blocked on a date listed in `/api/holidays` (admin-managed), so closures are never counted as absences. Restricted to `SUPER_ADMIN`/`SCHOOL_ADMIN`/`PRINCIPAL`/`TEACHER`.

`GET /api/attendance/students/:studentId` (history) and `/summary` (`{totalDays, percentage, breakdown}`, `HALF_DAY` counts as 0.5) are self-scoped: staff roles can view any student, a `STUDENT` can only view their own record, and a `PARENT` can only view a student they're linked to via `StudentGuardian` — everyone else gets `403`.

## Announcements module (V1)

`GET/POST/PATCH/DELETE /api/announcements`. Creating is restricted to `SUPER_ADMIN`/`SCHOOL_ADMIN`/`PRINCIPAL`/`TEACHER`; editing/deleting requires being the original creator or an admin role (a teacher can't edit another teacher's post). An announcement can be school-wide (no target), role-specific (`targetRole`), class-wide (`targetClassId`), or both — staff roles always see everything, while a `STUDENT`/`PARENT` only sees announcements matching their own role and their (or their linked child's) class. Full create/edit/delete UI lives at `/dashboard/announcements`.

## Passwords (V1)

Three ways a password can change, each for a different situation:

- **Self-service** — `POST /api/auth/change-password` (authenticated, `{currentPassword, newPassword}`). Any logged-in user reaches this from the topbar profile menu → **Change password**. Verifies the current password, then revokes all of that user's refresh tokens (forces re-login everywhere, including the tab that just changed it).
- **Admin-initiated reset** — `POST /api/users/:id/reset-password` (`SUPER_ADMIN`/`SCHOOL_ADMIN` only, scoped to their own school). Generates a new temporary password without needing the old one — this is the answer to "how does a staff member get back in if they forget their password," since no email provider is wired up yet so the OTP flow below isn't practically usable. Surfaced as a key icon button next to Staff/Guardians rows and on a student's detail page. The generated password is shown once, never stored in plaintext, and the old one stops working immediately.
- **Forgot password (OTP)** — `POST /api/auth/forgot-password` → `POST /api/auth/reset-password`, unauthenticated. Now actually emailed (see "Email notifications" below) instead of only logged to the console.

## Teacher class assignments

A `TEACHER` only sees students in, and can only mark attendance for, the specific class+section combos they've been assigned to teach (e.g. "Grade 5 - A" but not "Grade 5 - B") — enforced server-side in `student.route.ts` and `attendance.route.ts`, not just hidden in the UI. `SCHOOL_ADMIN`/`PRINCIPAL` are unrestricted.

- `SCHOOL_ADMIN` manages this from the **Staff** page — a graduation-cap icon next to each teacher opens **Manage classes**, where you pick a class then a section and add it; each assignment can be removed independently.
- `GET/POST/DELETE /api/staff/:id/assignments` (`SCHOOL_ADMIN`-only) manage the underlying `TeacherAssignment` rows; `GET /api/me/assignments` is the self-service version a teacher's own UI uses to restrict its class/section pickers (returns `[]` for non-teachers).
- A teacher with no assignments yet sees an empty student list and can't mark attendance anywhere — that's expected, not a bug; assign them a class/section first.

## Admission numbers

`admissionNo` is auto-generated server-side (`ADM-<year>-<sequence>`, e.g. `ADM-2026-0001`) whenever a student is created through the **New student** form — there's no field to type one in, so there's no way for staff to accidentally reuse a number already assigned to someone else. The one exception is CSV bulk import, where the column is optional: leave it blank to auto-assign, or fill it in per-row when migrating admission numbers a school already had in an existing system.

## Frontend dashboard (V1)

A full UI for every backend module built so far, at `apps/web`.

```bash
npm run dev:api    # terminal 1 — :4000
npm run dev:web    # terminal 2 — :3000
```

Open `http://localhost:3000` (redirects to `/login` if you're not signed in). Sign in with the seeded admin (`admin@school.test` / `ChangeMe123!`, or any user created via the API). The login page doesn't ask for a school — single-tenant mode auto-resolves the one school via `GET /api/schools`.

- **Layout:** `components/layout/` — `Sidebar` (desktop rail) + `MobileSidebar` (Sheet-based drawer) + `Topbar` (user menu with theme toggle and profile dropdown — Change password and Log out) composed in `DashboardShell`, which guards every `/dashboard/*` route. Nav items are filtered per role in `lib/nav-config.ts`.
- **Theme:** light/dark via `next-themes`. Colors are the dataviz skill's validated palette (blue primary, reserved status colors for attendance %) — see `app/globals.css`.
- **Dashboard** (`/dashboard`, backed by `GET /api/dashboard`): role-aware stat cards/widgets + recent announcements.
- **Academics** (`/dashboard/academics`): tabbed CRUD for Sessions, Classes, Sections, Subjects.
- **Announcements** (`/dashboard/announcements`): create/edit/delete for roles allowed to post, targeting by role and/or class; everyone sees the feed filtered to what applies to them.
- **Students** (`/dashboard/students`): filterable list, create form, CSV bulk import, and a detail page (edit, link/unlink guardians with relationship type, withdraw).
- **Staff** (`/dashboard/staff`) and **Guardians** (`/dashboard/guardians`): list + create + edit (staff also deactivate) — `SCHOOL_ADMIN` only for the write actions; `SUPER_ADMIN` sees the same lists read-only. Teachers additionally get a **Manage classes** action — see "Teacher class assignments" below.
- **School Admins** (`/dashboard/school-admins`, `SUPER_ADMIN`-only nav item): list + create `SCHOOL_ADMIN` accounts, plus a password-reset action — see "Account-creation hierarchy" above.
- **Attendance** (`/dashboard/attendance`): a mark-attendance grid (class/section/date → per-student status + remarks, pre-filled from existing marks) and holiday management for staff; a personal history + % view for students/parents.
- All mutating dialogs are role-gated client-side to match the backend's RBAC (e.g. only `SCHOOL_ADMIN` can create students/staff/guardians, only `SUPER_ADMIN` can create school admins) — the backend still enforces it independently.
- **Reusable pieces:** `StatCard`, `AnnouncementCard`, `PageHeader`, `StatusBadge`, `ConfirmDialog`, `useApi` (fetch hook), `apiFetch`/`ApiError` (auth-aware fetch wrapper with token refresh-on-401).
- **Base UI gotcha:** shadcn here is the Base UI flavor, not Radix — `Select` needs an explicit `items` prop (value→label map) to show the right label before the popup has ever opened, and `DropdownMenuLabel` must live inside a `DropdownMenuGroup`. Both are already handled everywhere in this codebase; keep the pattern for new components.
- **Known simplification:** auth tokens live in `localStorage`, not httpOnly cookies — fine for local dev, revisit before any real deployment.

Verified with a real headless-browser pass (login → every page → dark mode → mobile drawer → profile dropdown → submitting attendance → creating a student), zero console errors.

## Moving to a new device (Mac ↔ Windows)

1. Push/pull this repo via git — never copy the folder manually (it would drag along `node_modules`, `.next`, and local `.env` files).
2. Re-run the **First-time setup** steps above on the new machine.
3. Everything else (Postgres, Redis) runs in Docker, so there is nothing to install natively per OS.
