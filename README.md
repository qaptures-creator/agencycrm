# Agency CRM

A complete CRM and agency management system for a video marketing agency — leads, clients, shoots, content deliverables, retainers, invoicing and performance analytics in one dashboard.

Built with Next.js (App Router), TypeScript, Prisma + PostgreSQL, Tailwind CSS, and Radix UI primitives. No demo data is seeded — only structural defaults (pipeline stages, deliverable statuses, and your own team member record).

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
- **Start command:** `npx prisma db push && npm run start` (schema sync runs here, when the private network to Postgres is up)

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
