# Agency CRM + Muscle Massacre Gym CRM

This repo hosts two independent products on one Next.js app + database:

- **Agency CRM** (`/`) — a CRM and agency management system for a video marketing agency: leads, clients, shoots, content deliverables, retainers, invoicing and performance analytics.
- **Muscle Massacre — Gym CRM** (`/gym`) — an internal command centre for a bodybuilding gym: members, memberships, staff rota, tasks, enquiries, leads, equipment, maintenance, incidents, shake bar stock, marketing and finance. See [Muscle Massacre Gym CRM](#muscle-massacre-gym-crm) below.

Both are built with Next.js (App Router), TypeScript, Prisma + PostgreSQL, Tailwind CSS, and Radix UI primitives, and share the same database via clearly-prefixed Prisma models (`Gym*` for the gym product). Production starts with genuinely empty data for both — no demo data is seeded unless explicitly requested (see each product's section for details).

## Getting started

Point `DATABASE_URL` in `.env` (copy from `.env.example`) at a Postgres database — local, Docker, or a hosted instance (Railway, Neon, Supabase, RDS, etc). Then:

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying

There are no migration files checked in yet (`prisma/migrations` is empty) — `npx prisma db push` syncs the schema directly. Schema sync has to run at **deploy/start time, not build time**: most platforms (Railway included) build in an isolated environment with no network access to other services, so a database connection during the build step will fail with `P1001: Can't reach database server`. The database is only reachable once the container actually starts.

`railway.json` reflects this split:

- **Build command:** `npm run build` (just `prisma generate && next build` — no DB connection needed)
- **Start command:** `npx prisma db push && npm run db:seed && npm run start` (schema sync + structural seed run here, when the private network to Postgres is up — `db:seed` is idempotent and never seeds gym demo data unless `SEED_GYM_DEMO=true` is set, see the Gym CRM section below)

Once you start committing migrations (`npx prisma migrate dev --name <name>`), swap `db push` for `prisma migrate deploy` in the start command.

## What's included

- **Dashboard** — active clients, MRR, revenue this month, pipeline value, deals won, conversion rate, upcoming shoots, deliverables due/overdue, outstanding invoices, plus revenue/leads/deals charts.
- **CRM** — lead records with full contact/deal detail, a draggable Kanban pipeline (custom stages: create, rename, reorder, delete), and a filterable list view.
- **Clients** — profile pages with contract/billing info, services, and full history: projects, deliverables, retainer usage, invoices, and activity.
- **Projects & Shoots** — board and list views, crew assignment (videographer/photographer/editor), and a shared calendar for shoots and deadlines.
- **Deliverables** — reels, TikToks, YouTube videos, photography, ad creatives, social posts and custom types, with configurable statuses and approval tracking.
- **Retainers** — monthly package usage (shoots/videos/photos) with visual progress against each client's plan.
- **Finance** — invoices (draft/sent/due/paid/overdue) and the calculations that back the dashboard (MRR, outstanding, overdue, pipeline value, won value).
- **Analytics** — revenue over time, leads generated, leads by source, lead→client conversion, deals won/lost, client revenue, content delivered, MRR by client.
- **Activities & follow-ups** — calls, emails, DMs, WhatsApp, meetings, proposals and notes logged against leads and clients, with schedulable follow-ups and overdue highlighting.
- **Global search** (⌘K) across leads, clients, contacts, projects and deliverables.
- **Settings** — manage pipeline stages, deliverable statuses, team members and the services catalog.

## Data model

Prisma schema in `prisma/schema.prisma`. Core relations:

```
Lead → Activities → (Won) → Client
Client → Projects → Deliverables
Client → Retainer
Client → Invoices
```

Status/type fields are plain strings backed by shared TypeScript unions in `src/lib/constants.ts` rather than native Postgres enums, since several of them (pipeline stages, deliverable statuses) are user-customizable at runtime via Settings.

## Project structure

- `src/app/(app)/*` — pages (one route per sidebar item), each with a server component for data fetching and a client component for interactivity.
- `src/actions/*` — server actions (create/update/delete/reorder) for every entity.
- `src/components/ui/*` — design system primitives (button, dialog, sheet, table, etc.).
- `src/components/charts/*` — Recharts wrappers used on the dashboard and analytics page.
- `src/lib/*` — Prisma client, validators (zod), formatting helpers, and finance/chart calculations.

---

## Muscle Massacre Gym CRM

An internal staff command centre for **Muscle Massacre** — dark, purple-accented, industrial, built to sit behind reception on a monitor and on staff phones. Lives entirely under `/gym/*`, with its own login (`/gym-login`), theme (`.gym-theme` in `globals.css`), and auth system — it does not use the Agency CRM's (nonexistent) auth at all.

### Getting started

```bash
npm install
npx prisma db push        # syncs both product's models — same DATABASE_URL
npm run db:seed           # creates the bootstrap Owner login + structural rows
npm run dev
```

Open [http://localhost:3000/gym-login](http://localhost:3000/gym-login). The seed prints a one-time Owner email/password to the console (or set `GYM_OWNER_EMAIL` / `GYM_OWNER_NAME` / `GYM_OWNER_PASSWORD` beforehand to control them, e.g. for a real production deploy). Staff accounts are never self-registered — the Owner/Manager creates them from **Staff → Create Login Account**, which issues a one-time temporary password.

To also populate realistic **development-only demo data** (staff, rota, tasks, members, memberships, payments, enquiries, leads, equipment, shake bar stock, marketing, an incident, an announcement):

```bash
SEED_GYM_DEMO=true npm run db:seed
```

This is opt-in only and intentionally **not** inferred from `NODE_ENV` — a misconfigured production deploy should never be able to end up with fabricated members or revenue in it. `railway.json`'s start command runs the plain (non-demo) seed on every deploy so the Owner/settings/integration rows always exist, without ever seeding demo data.

### What's included

- **Dashboard** — real KPIs (active members, revenue, enquiries, leads awaiting follow-up, staff working, tasks due), today's staff & tasks, an alerts feed, honest revenue/membership snapshots (empty states rather than invented figures when nothing's connected yet), and a mobile-first "My Shift / My Tasks / quick actions" panel for staff on small screens.
- **Staff & Rota** — profiles, roles, login-account management; a weekly drag-free shift grid with create/edit/duplicate/publish, conflict + long-shift highlighting, per-staff weekly hours, and self-service clock in/out.
- **Tasks** — one-off and recurring (daily/weekly) tasks with priorities, categories, quick-complete, and completion-rate reporting.
- **Enquiries** — an inbox (Inbox/Unread/Assigned to Me/Follow-Up/Closed) with a conversation thread, assignment, status, scheduled follow-ups, and convert-to-lead/convert-to-member — architected for a real mailbox but honestly labeled "Email Integration Required" until one is connected (see Integrations).
- **Leads** — a 9-stage membership sales pipeline, kanban (drag-and-drop) and table views, conversion stats.
- **Members & Memberships** — member directory/profiles (personal details, membership, payment history, communications, notes, freeze/cancel/change-membership actions), a membership plan catalog, and a temporary manual CSV import/export.
- **Finance & Payments** — revenue/outstanding/failed-payment reporting and a payments ledger, reading only this CRM's own data with a clear "Ashbourne not connected" banner rather than any invented numbers.
- **Equipment, Maintenance, Incidents, Shake Bar** — an equipment register with issue reporting, a maintenance ticket board, a permission-restricted incident log, and stock tracking with low-stock alerts.
- **Marketing & Reports** — a content calendar, campaign tracking with live lead/conversion counts, lead-source performance, and management reports (membership/revenue/leads/staff/operations) with date filters and CSV export.
- **Communications & Notifications** — internal announcements (shown on login/dashboard) and an in-app notification bell driven by real events (new enquiry, lead follow-up due, task assigned/overdue, low stock, failed payment, etc).
- **Integrations & Settings** — an honest connection-status page (Email, Ashbourne, Website, Google Calendar, Meta — nothing is ever shown as "Connected" unless it genuinely is), gym details, and an Owner-only audit log.

### Integration architecture

Two integrations aren't available yet — there's no authorised access to either:

1. **Email** (`admin@musclemassacre.com`) — `src/lib/gym/integrations/email-provider.ts` defines the `EmailProvider` contract (`getMessages`/`getThread`/`sendMessage`/`markRead`). Implement it for Microsoft 365/Graph, Gmail, or IMAP once credentials exist, and wire it into `getEmailProvider()`.
2. **Ashbourne Membership Management** (the gym's real membership/payment system) — `src/lib/gym/integrations/ashbourne-provider.ts` defines the `MembershipProvider` contract. Implement it once Ashbourne API/export access is available, and wire it into `getMembershipProvider()`.

Both helpers return `null` until connected; nothing in the codebase fabricates a connection, invented members, or invented revenue — every page that depends on them shows an explicit "Not Connected" state instead.

### Data model

All gym models are prefixed `Gym*` in `prisma/schema.prisma` to stay isolated from the Agency CRM's models in the same database — `GymUser`/`GymStaff`/`GymSession` (auth), `GymMember`/`GymMembership`/`GymMembershipPlan`/`GymPayment`, `GymEnquiry`/`GymEnquiryMessage`, `GymLead`/`GymLeadActivity`, `GymRotaShift`/`GymAttendance`, `GymTask`/`GymTaskComment`, `GymEquipment`/`GymMaintenanceTicket`, `GymIncident`, `GymShakeBarProduct`/`GymInventoryTransaction`, `GymMarketingCampaign`/`GymMarketingContent`, `GymNotification`/`GymAnnouncement`, `GymIntegration`, `GymAuditLog`, `GymSettings`.

### Project structure

- `src/app/gym/*` — one folder per sidebar section, each a server component page plus client components for forms/interactivity, matching the Agency CRM's page pattern.
- `src/app/gym-login/*` — login, forgot/reset password (unauthenticated, outside the `/gym` layout's auth guard).
- `src/actions/gym/*` — server actions, one file per entity, each validating with zod, permission-checking via `src/lib/gym/auth.ts`, and audit-logging via `src/lib/gym/audit.ts`.
- `src/lib/gym/auth.ts`, `session.ts`, `password.ts` — cookie-session auth (scrypt-hashed passwords, DB-backed sessions).
- `src/lib/gym/permissions.ts` — the Owner/Manager/Staff/Marketing role matrix, enforced server-side (not just hidden buttons).
- `src/lib/gym/constants.ts`, `validators.ts` — shared string-enum vocab and zod schemas for every entity.
- `src/components/gym/*` — sidebar, topbar, global search, notifications, quick add, and other gym-specific shared UI (reuses the Agency CRM's theme-agnostic `src/components/ui/*` primitives throughout, just re-skinned by `.gym-theme`).
