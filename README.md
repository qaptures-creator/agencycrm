# Agency CRM

A complete CRM and agency management system for a video marketing agency — leads, clients, shoots, content deliverables, retainers, invoicing and performance analytics in one dashboard.

Built with Next.js (App Router), TypeScript, Prisma + SQLite, Tailwind CSS, and Radix UI primitives. No demo data is seeded — only structural defaults (pipeline stages, deliverable statuses, and your own team member record).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first install, Prisma generates the client and creates `prisma/dev.db` (a local SQLite file). To (re)apply the schema and seed system defaults:

```bash
npx prisma migrate dev
npm run db:seed
```

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

SQLite has no native enum type, so status/type fields are plain strings backed by shared TypeScript unions in `src/lib/constants.ts`. Swap the `DATABASE_URL` in `.env` (and the `datasource` provider in `schema.prisma`) to point at Postgres/MySQL for production use — the schema was written to be provider-portable.

## Project structure

- `src/app/(app)/*` — pages (one route per sidebar item), each with a server component for data fetching and a client component for interactivity.
- `src/actions/*` — server actions (create/update/delete/reorder) for every entity.
- `src/components/ui/*` — design system primitives (button, dialog, sheet, table, etc.).
- `src/components/charts/*` — Recharts wrappers used on the dashboard and analytics page.
- `src/lib/*` — Prisma client, validators (zod), formatting helpers, and finance/chart calculations.
