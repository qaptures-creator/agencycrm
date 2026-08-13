# PRMOTE MCP — connecting ChatGPT to the CRM

This document covers the Model Context Protocol (MCP) integration that lets
ChatGPT read and (in a controlled way) write PRMOTE CRM data — leads,
clients, tasks, invoices, projects, deliverables, and activity notes.

## 1. Architecture overview

```
ChatGPT  →  OAuth 2.1 + PKCE  →  WorkOS AuthKit (authorization server)
    │                                       │
    │  Bearer <WorkOS access token>         │ issues signed JWTs
    ▼                                       ▼
HTTPS (Streamable HTTP)  →  POST/GET /api/mcp
                                     │
                           src/app/api/mcp/route.ts
                           (withMcpAuth, then mcp-handler)
                                     │
                           src/mcp/auth.ts    (verifyToken: OAuth first, legacy key fallback)
                           src/mcp/oauth.ts   (verifies WorkOS JWTs via JWKS — offline, no WorkOS secret)
                                     │
                           GET /.well-known/oauth-protected-resource  (RFC 9728 — tells clients where to get a token)
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

This app is an OAuth **resource server** only — it never issues tokens and
never sees a WorkOS password or session. WorkOS AuthKit is the
**authorization server**: it runs the login screen, runs the OAuth
authorization-code + PKCE exchange with ChatGPT, and signs access tokens.
This app's only job is to verify those tokens are genuine, unexpired, and
scoped to *this* resource before letting a request reach any tool.

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
auth. Instead, the MCP endpoint gets its own gate, described below.

### Auth history: static key → OAuth

The endpoint originally shipped with a single shared-secret bearer token
(`PRMOTE_MCP_API_KEY`). ChatGPT's connector setup no longer accepts a bare
static API key for MCP connectors — current Developer Mode connectors
support **OAuth, No Authentication, or Mixed** (Mixed = manual client
credentials, or auto-discovery via a Client ID Metadata Document). So the
endpoint now does real OAuth 2.1 with WorkOS AuthKit as the authorization
server, described in full below.

`PRMOTE_MCP_API_KEY` is kept as a **temporary parallel fallback** — both
credential types are accepted — until the ChatGPT OAuth connection is
proven working end-to-end. See [§11](#11-removing-the-legacy-api-key) for
the removal plan.

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

All on the **existing** PRMOTE Railway service — still no new service.

```
MCP_OAUTH_ISSUER=https://playful-experience-27-staging.authkit.app
MCP_OAUTH_JWKS_URL=https://playful-experience-27-staging.authkit.app/oauth2/jwks
PRMOTE_MCP_API_KEY=<a long random secret>   # temporary fallback, see §11
```

`APP_URL` (already set for the Microsoft integration) is reused as the base
for both the audience/resource identifier (`<APP_URL>/api/mcp`) and the
`/.well-known/oauth-protected-resource` metadata URL — no separate
"resource URL" variable was added.

`MCP_OAUTH_JWKS_URL` is technically optional (defaults to
`<MCP_OAUTH_ISSUER>/oauth2/jwks`, WorkOS's standard path) but it's set
explicitly here to match exactly what you configured in WorkOS.

**Deliberately not added:** `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`. This app
only *verifies* tokens (signature via public JWKS, issuer, audience,
expiry, scope) — it never talks back to WorkOS's API and is never an OAuth
*client* itself, so neither a WorkOS secret key nor a client ID has any use
here. Adding them would be an unused secret sitting in the environment for
no functional benefit, so they were left out.

If neither `MCP_OAUTH_ISSUER` nor `PRMOTE_MCP_API_KEY` is set, `/api/mcp`
responds `503` and does nothing else — it never falls open.

## 4. Local development

```
npm install
npm run dev
```

The MCP endpoint is at `http://localhost:3000/api/mcp`. Locally you can
test with either credential type — set `PRMOTE_MCP_API_KEY` in your local
`.env` for the simple path, or point `MCP_OAUTH_ISSUER`/`MCP_OAUTH_JWKS_URL`
at a real (or, for a dry run, a mock) authorization server. A plain
reachability check (no auth, no data) is at
`http://localhost:3000/api/mcp/health`, and the metadata document is at
`http://localhost:3000/.well-known/oauth-protected-resource`.

## 5. Railway deployment

Nothing new to deploy — this ships as part of the existing PRMOTE service's
next commit/deploy. Steps:

1. In the Railway dashboard, open the **PRMOTE** service → **Variables**.
2. Add:
   - `MCP_OAUTH_ISSUER=https://playful-experience-27-staging.authkit.app`
   - `MCP_OAUTH_JWKS_URL=https://playful-experience-27-staging.authkit.app/oauth2/jwks`
   - Leave `PRMOTE_MCP_API_KEY` as-is (it's already set from the earlier
     deploy) — don't remove it yet.
3. Deploy the branch as usual (build command, start command, health check,
   and `PORT` handling are all unchanged from what's already configured —
   this doesn't touch any of that).
4. Confirm it's live:
   - `curl https://<your-railway-domain>/api/mcp/health` →
     `{"ok":true,"service":"PRMOTE MCP"}`
   - `curl https://<your-railway-domain>/.well-known/oauth-protected-resource`
     → `{"resource":"https://<your-railway-domain>/api/mcp","authorization_servers":["https://playful-experience-27-staging.authkit.app"]}`

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

Every `/api/mcp` request must carry a bearer token:

```
Authorization: Bearer <token>
```

Two kinds of token are accepted, checked in this order (`src/mcp/auth.ts`):

1. **A WorkOS-issued OAuth access token.** Verified in `src/mcp/oauth.ts`
   using `jose` against WorkOS's public JWKS — fully offline, no call back
   to WorkOS's API. Checks:
   - **Signature** — against the current WorkOS signing key (`kid`-matched
     via JWKS).
   - **Issuer** — must equal `MCP_OAUTH_ISSUER` exactly.
   - **Audience** — must equal `<APP_URL>/api/mcp` exactly (RFC 8707
     resource indicator — this is what stops a WorkOS token minted for some
     *other* API from being replayed against this one).
   - **Expiry / not-before** — enforced by `jose`'s `jwtVerify` itself for
     any token carrying `exp`/`nbf` claims; `withMcpAuth` (see below) also
     re-checks `exp` as a second layer.
   - **Scopes** — extracted from the token's `scope` (or `scp`) claim and
     attached to the request; no specific scope is required yet since none
     were defined on the WorkOS side — see the note in `src/mcp/oauth.ts` if
     you want to add read/write scope separation later.
2. **The legacy `PRMOTE_MCP_API_KEY`** — a plain timing-safe string
   compare, kept temporarily (§11).

If neither check passes, the request never reaches a tool. The 401 is
produced by `mcp-handler`'s `withMcpAuth` wrapper (`required: true`, so —
unlike that helper's own default — an unauthenticated request is always
rejected, never silently passed through) with a spec-correct header:

```
WWW-Authenticate: Bearer error="invalid_token", error_description="...",
  resource_metadata="https://<your-domain>/.well-known/oauth-protected-resource"
```

### `securitySchemes` on individual tools

The MCP tool spec (`registerTool`'s config) has no per-tool
"`securitySchemes`" field — authorization in MCP is a property of the
*transport/resource*, not of individual tools, so there's nothing to
attach per-tool even in principle. The standards-compliant equivalent is
exactly what's implemented: the protected-resource metadata document
(RFC 9728, §1 below) plus the `WWW-Authenticate` challenge on 401, which is
how an MCP client is supposed to discover "this resource needs OAuth, here's
the authorization server." Every tool sits behind the same one gate — there
is no tool that bypasses it.

## 8. How to connect the MCP endpoint to ChatGPT

1. In ChatGPT, go to **Settings → Apps & Connectors → Advanced → Developer
   mode** and enable it.
2. **Settings → Connectors → Create**.
3. **Name:** PRMOTE CRM.
4. **MCP Server URL:** `https://<your-railway-domain>/api/mcp`
5. **Authentication:** choose **OAuth**. Since Dynamic Client Registration
   and CIMD are both enabled on the WorkOS side, ChatGPT should be able to
   auto-discover everything from the URL alone — no client ID/secret to
   paste in.
6. Save. ChatGPT will redirect you to WorkOS's hosted login (AuthKit) —
   log in with the one admin account you created, approve access, and
   you'll land back in ChatGPT with the connector active.
7. Open a chat, enable the connector, and try: *"Show me all active
   clients."*

If ChatGPT's auto-discovery doesn't cooperate (some clients still prefer
manual credentials), fall back to **Mixed** auth: create one manual OAuth
application in WorkOS, paste its client ID/secret into ChatGPT, and
register ChatGPT's OAuth redirect URI (shown in ChatGPT's connector setup
screen at that point) as an allowed redirect URI on that WorkOS
application.

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
- **Real OAuth 2.1, not a hand-rolled scheme.** WorkOS AuthKit is the
  authorization server (PKCE, RFC 8414 metadata, DCR/CIMD); this app only
  does offline JWT verification via `jose` against WorkOS's public JWKS —
  no custom crypto, no token issuance logic written from scratch.
- **Audience-bound tokens.** A WorkOS token minted for a *different*
  resource/API is rejected here — verified in the [Testing procedure](#testing-procedure)
  below with a token carrying the wrong `aud`.
- **Single admin user.** Public sign-up is disabled on the WorkOS
  connection; only the one account you created can complete the login.
- **No WorkOS secret lives on this server.** Verification needs only the
  issuer URL and the public JWKS — see the note in §3 on why
  `WORKOS_API_KEY`/`WORKOS_CLIENT_ID` were deliberately not added. Fewer
  secrets in the environment is a smaller blast radius if the environment
  is ever compromised.
- **Ambiguous names fail safe.** If "ABC" matches three leads, the tool
  returns an error listing the candidates instead of guessing which one you
  meant.
- **Legacy key is a temporary widened surface.** While both auth paths are
  accepted, an attacker only needs to compromise *either* credential.
  That's the cost of the transition period — see §11 for closing it.
- **Rotate WorkOS access** by revoking the user's session/account in the
  WorkOS dashboard; rotate the legacy key by changing
  `PRMOTE_MCP_API_KEY` in Railway.

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `503` from `/api/mcp` | Neither `MCP_OAUTH_ISSUER` nor `PRMOTE_MCP_API_KEY` is set on the Railway service |
| `401 Unauthorized` with a WorkOS token | Check the token's `aud` claim matches `<APP_URL>/api/mcp` exactly (including scheme, no trailing slash), that it hasn't expired, and that `MCP_OAUTH_ISSUER`/`MCP_OAUTH_JWKS_URL` match your WorkOS AuthKit domain exactly |
| `401 Unauthorized` with the legacy key | Check the key matches `PRMOTE_MCP_API_KEY` exactly, no extra whitespace |
| ChatGPT can't complete the OAuth login | Confirm DCR or CIMD is actually enabled in WorkOS (both, ideally), and that public sign-up being disabled hasn't also blocked the one admin account you created |
| `GET /.well-known/oauth-protected-resource` 404s or looks wrong | Confirm `APP_URL` is set on Railway to the exact public domain (not left to proxy-header autodetection — Railway's proxy has been unreliable for this before) |
| ChatGPT says "connector not safe" or similar | Usually a transport/CORS/metadata mismatch — confirm the URL is exactly `https://.../api/mcp` and that the protected-resource metadata resolves over HTTPS |
| A tool call returns `Error: "X" matches multiple ...s` | Ambiguous name — pass the exact id (returned by a `get_*`/`search_*` call) instead |
| A tool call returns a generic `Error: Something went wrong...` | Check Railway logs — the real error (e.g. a Prisma error) is logged server-side but never leaked to the client |
| Health check OK but tool calls fail | Almost always a database connectivity issue — same as any other page in the app failing, check `DATABASE_URL` |

## 11. Removing the legacy API key

Once you've confirmed the ChatGPT connector logs in via WorkOS and can call
tools successfully:

1. Remove `PRMOTE_MCP_API_KEY` from the Railway service's variables.
2. In `src/mcp/auth.ts`, delete the legacy-key branch in
   `verifyMcpBearerToken` (the block after the OAuth `try`/`catch`) and the
   now-unused `safeEqual` helper.
3. Update `isMcpAuthConfigured()` to just return `isOAuthConfigured()`.

This is intentionally a separate, small follow-up rather than bundled into
this change, per your instruction not to remove the fallback until OAuth is
proven end-to-end.

## Testing procedure

Already verified locally (mock WorkOS issuer + JWKS, throwaway local
Postgres — no production data or credentials involved): health check;
protected-resource metadata shape; missing-token 401 with the correct
`WWW-Authenticate`; a garbage token rejected; the legacy key still working;
a validly-signed OAuth token accepted and able to call a tool; and — the
part that actually matters for security — an **expired** token, a token
with the **wrong audience**, and a token from the **wrong issuer** all
correctly rejected with 401 rather than silently falling back to
"any token works."

A safe way to re-verify against the real deployment without touching real
data:

1. `curl https://<domain>/api/mcp/health` → expect `{"ok":true,...}`.
2. `curl https://<domain>/.well-known/oauth-protected-resource` → expect
   `{"resource":"https://<domain>/api/mcp","authorization_servers":["https://playful-experience-27-staging.authkit.app"]}`.
3. `curl -X POST https://<domain>/api/mcp` with no `Authorization` header →
   expect `401` with a `WWW-Authenticate` header referencing the metadata
   URL from step 2.
4. In ChatGPT (or via curl with a proper MCP client), call `get_clients` →
   expect your real client list.
5. Call `get_leads` and `search_leads` → expect real data back.
6. Call `get_invoices` → expect real data back.
7. Call `create_lead` with `companyName: "MCP TEST - DELETE ME"` → expect a
   new lead, visible in the CRM UI, clearly named so it can't be confused
   with a real lead.
8. Call `update_lead` on that same test lead → expect the change to stick.
9. Call `create_task` against that test lead → expect it to appear under
   `get_tasks`.
10. When done, delete the `"MCP TEST - DELETE ME"` lead **manually in the
   CRM UI** — the MCP tool set intentionally has no delete tool, so this is
   the one step that isn't automatable, and nothing gets deleted without
   you explicitly doing it.
