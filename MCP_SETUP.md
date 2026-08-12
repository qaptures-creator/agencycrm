# PRMOTE MCP — connecting ChatGPT to the CRM

This document covers the Model Context Protocol (MCP) integration that lets
ChatGPT read and (in a controlled way) write PRMOTE CRM data — leads,
clients, tasks, invoices, projects, deliverables, and activity notes.

## 1. Architecture overview

```
ChatGPT  →  HTTPS (Streamable HTTP, bearer token)  →  POST/GET /api/mcp
                                                              │
                                                    src/app/api/mcp/route.ts
                                                    (auth check, then mcp-handler)
                                                              │
                                                       src/mcp/register.ts
                                                        ├─ read-tools.ts
                                                        └─ write-tools.ts
                                                              │
                                                        src/mcp/resolve.ts   (id-or-name lookups)
                                                        src/mcp/audit.ts     (Activity audit trail)
                                                              │
                                                          Prisma  →  the SAME production Postgres
                                                                     the CRM app already uses
```

The MCP server is **not** a separate service. It's a couple of new route
handlers inside the existing Next.js app (`src/app/api/mcp/*`), registered
alongside the CRM's existing pages and API routes. It:

- runs in the same Railway service, on the same deploy, with the same
  `DATABASE_URL` — no second database, no second set of credentials to
  manage or leak, no second thing to keep in sync.
- shares nothing with the CRM's rendering code — it's purely additive.
  No existing page, action, or route was modified to build it.
- talks to the database exclusively through Prisma (the same client the
  rest of the app uses), never raw SQL.

This was the deliberate choice over a separate Railway service: a second
service would need its own copy of `DATABASE_URL` (another place for the
production connection string to leak) or an internal API layer to proxy
through, for no real benefit — Railway already puts this app on HTTPS with
a stable public domain, which is all a remote MCP server needs.

### Why no login/session auth was reused

The CRM app itself has **no authentication system** — no login page, no
sessions, no NextAuth, nothing. Anyone with the app's URL already has full
read/write access through the UI. So there was nothing to "reuse" for MCP
auth. Instead, the MCP endpoint gets its own gate: a single shared-secret
bearer token (`PRMOTE_MCP_API_KEY`), checked before any MCP request reaches
the database. See [Security considerations](#9-security-considerations).

## 2. MCP tools available

### Read-only

| Tool | Description |
|---|---|
| `get_clients` | List clients, optionally by status |
| `get_client` | Full detail for one client (by id or company name) |
| `search_clients` | Free-text search across company/contact/email |
| `get_leads` | List leads, optionally by stage |
| `get_lead` | Full detail for one lead (by id or company name) |
| `search_leads` | Free-text search across company/contact/email |
| `get_leads_by_stage` | All leads in a given pipeline stage |
| `get_leads_needing_followup` | Leads whose next-follow-up date has arrived |
| `get_tasks` | Scheduled follow-ups (activities with a due date) |
| `get_overdue_tasks` | Tasks past due and not completed |
| `get_invoices` | Invoices, optionally by status/client |
| `get_overdue_invoices` | Unpaid invoices past their due date |
| `get_projects` | Projects/shoots, optionally by status/client |
| `get_upcoming_projects` | Projects with a future shoot date |
| `get_deliverables` | Content deliverables, optionally by type/client |
| `get_recent_activity` | Latest activity log entries across the CRM |

### Controlled writes

| Tool | Description |
|---|---|
| `create_lead` | Create a new lead (defaults to the first pipeline stage) |
| `update_lead` | Update a lead's details |
| `update_lead_stage` | Move a lead to a different pipeline stage |
| `create_client` | Create a new client directly |
| `update_client` | Update a client's details |
| `add_lead_note` | Add a note to a lead |
| `add_client_note` | Add a note to a client |
| `create_task` | Create a follow-up task against a lead or client |
| `update_task` | Update a task's subject, due date, or notes |
| `complete_task` | Mark a task as completed |
| `log_activity` | Log a call/email/meeting/DM/proposal/etc. against a lead or client |

**No delete tools exist**, on purpose. There is no `execute_sql`,
`run_query`, or any raw-database-access tool — every tool is scoped to one
specific, validated operation on one specific Prisma model.

### A note on "tasks"

The schema has no separate `Task` model. Tasks are `Activity` rows with a
`dueAt` set — the same model the CRM UI already uses for follow-ups. The
MCP tools work against that directly; nothing was added to the schema.

### Audit trail

Every write that isn't itself an activity (`create_lead`, `update_lead`,
`update_lead_stage`, `create_client`, `update_client`) creates a `NOTE`
activity on the affected record, e.g. *"Lead created through PRMOTE MCP
(ChatGPT)."* — visible in the CRM's own activity feed. Writes that already
are activities (`add_lead_note`, `create_task`, `log_activity`, etc.) don't
need a second entry.

## 3. Required environment variables

Add one new variable to the **existing** PRMOTE Railway service (same
service, no new service):

```
PRMOTE_MCP_API_KEY=<a long random secret>
```

Generate one with:

```
openssl rand -hex 32
```

If this variable is unset, `/api/mcp` responds `503` and does nothing else
— it never falls open. No other new environment variables are needed;
everything else (`DATABASE_URL`, etc.) is already configured.

## 4. Local development

```
npm install
npm run dev
```

The MCP endpoint is at `http://localhost:3000/api/mcp`, gated by whatever
`PRMOTE_MCP_API_KEY` you put in your local `.env`. A plain reachability
check (no auth, no data) is at `http://localhost:3000/api/mcp/health`.

## 5. Railway deployment

Nothing new to deploy — this ships as part of the existing PRMOTE service's
next commit/deploy. Steps:

1. In the Railway dashboard, open the **PRMOTE** service → **Variables**.
2. Add `PRMOTE_MCP_API_KEY` (generate with `openssl rand -hex 32`).
3. Deploy the branch as usual (build command, start command, health check,
   and `PORT` handling are all unchanged from what's already configured —
   this doesn't touch any of that).
4. Confirm it's live: `curl https://<your-railway-domain>/api/mcp/health`
   should return `{"ok":true,"service":"PRMOTE MCP"}`.

**Do not** create a second Railway service or a second Postgres database
for this — it isn't needed, and it would just be another copy of
`DATABASE_URL` to secure.

## 6. MCP endpoint format

- **Transport:** Streamable HTTP (the current MCP spec's recommended remote
  transport). SSE is explicitly disabled — it's deprecated in the spec and
  unnecessary here.
- **URL:** `https://<your-railway-domain>/api/mcp`
- **Method:** `POST` (and `GET` for the streaming channel) — same URL for
  both, per the Streamable HTTP spec.

## 7. Authentication setup

Every request must carry:

```
Authorization: Bearer <PRMOTE_MCP_API_KEY>
```

The check is a timing-safe comparison against the server's configured key
(`src/mcp/auth.ts`) — a missing or wrong token gets a `401` with a
`WWW-Authenticate: Bearer` header before the request ever reaches Prisma or
any tool code.

## 8. How to connect the MCP endpoint to ChatGPT

1. In ChatGPT, go to **Settings → Apps & Connectors → Advanced → Developer
   mode** and enable it (this exposes custom connectors).
2. **Settings → Connectors → Create**.
3. **Name:** PRMOTE CRM (or anything you like).
4. **MCP Server URL:** `https://<your-railway-domain>/api/mcp`
5. **Authentication:** choose **API key**, paste the same value you set for
   `PRMOTE_MCP_API_KEY` on Railway.
6. Save, then open a chat and enable the connector. Try: *"Show me all
   active clients."*

## 9. Security considerations

- **No raw SQL, ever.** Every tool is a specific, named Prisma operation
  with a validated input schema (zod). There is no way for ChatGPT to run
  an arbitrary query, join, or table.
- **No deletes.** Nothing in the write-tool set can remove a record.
- **Bounded reads.** Every list tool caps results (default 20, max 50) and
  every input has a length limit — no "return everything" tool exists.
- **No secrets ever returned.** `MicrosoftConnection` (OAuth tokens) is
  never touched by any MCP tool. No tool returns raw environment variables,
  connection strings, or internal ids beyond what's needed to reference a
  record back (Prisma cuids, not secrets).
- **Shared-secret auth, not OAuth** — a deliberate choice for a private,
  single-tenant integration with one trusted client. If PRMOTE ever needs
  multiple external integrations with different permission levels, that's
  the point to build out real OAuth (`withMcpAuth` from `mcp-handler`
  supports it) rather than before.
- **Ambiguous names fail safe.** If "ABC" matches three leads, the tool
  returns an error listing the candidates instead of guessing which one you
  meant.
- **Rotate the key** by changing `PRMOTE_MCP_API_KEY` in Railway and
  updating the ChatGPT connector — this instantly invalidates the old key
  everywhere.

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `503` from `/api/mcp` | `PRMOTE_MCP_API_KEY` isn't set on the Railway service |
| `401 Unauthorized` | Wrong/missing bearer token — check the key matches exactly, no extra whitespace |
| ChatGPT says "connector not safe" or similar | Usually a transport/CORS mismatch — confirm the URL is exactly `https://.../api/mcp` (not `/mcp` or with a trailing slash) and that you're on HTTPS |
| A tool call returns `Error: "X" matches multiple ...s` | Ambiguous name — pass the exact id (returned by a `get_*`/`search_*` call) instead |
| A tool call returns a generic `Error: Something went wrong...` | Check Railway logs — the real error (e.g. a Prisma error) is logged server-side but never leaked to the client |
| Health check OK but tool calls fail | Almost always a database connectivity issue — same as any other page in the app failing, check `DATABASE_URL` |

## Testing procedure

A safe way to verify the deployment without touching real data:

1. `curl https://<domain>/api/mcp/health` → expect `{"ok":true,...}`.
2. `curl -X POST https://<domain>/api/mcp` with no `Authorization` header →
   expect `401`.
3. In ChatGPT (or via curl with a proper MCP client), call `get_clients` →
   expect your real client list.
4. Call `get_leads` and `search_leads` → expect real data back.
5. Call `get_invoices` → expect real data back.
6. Call `create_lead` with `companyName: "MCP TEST - DELETE ME"` → expect a
   new lead, visible in the CRM UI, clearly named so it can't be confused
   with a real lead.
7. Call `update_lead` on that same test lead → expect the change to stick.
8. Call `create_task` against that test lead → expect it to appear under
   `get_tasks`.
9. When done, delete the `"MCP TEST - DELETE ME"` lead **manually in the
   CRM UI** — the MCP tool set intentionally has no delete tool, so this is
   the one step that isn't automatable, and nothing gets deleted without
   you explicitly doing it.
