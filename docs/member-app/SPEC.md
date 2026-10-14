# Muscle Massacre Member App — Discovery Audit & Technical Specification

Status: **Discovery complete — specification approved; decisions in §12 still open. No production code, migrations, deployments or data changes have been made.**
Audit date: 2026-10-12. Legend: **[V]** verified fact (file/infra evidence) · **[A]** assumption, still to be verified · **[D]** decision requiring approval.

---

## 0. Context and headline findings

Muscle Massacre wants a native iOS and Android member app (React Native + Expo) with email one-time-code sign-in, connected securely to the existing gym CRM. This document is the discovery audit and the build plan. It contains no implementation.

Headline findings, which change the brief:

1. **[V] The gym CRM is not on `main` or on the session branch.** The session branch `claude/happy-hypatia-g7md2p` and `main` hold the *PRMOTE agency CRM*, which has no member code.
   - The gym CRM lives on branch **`claude/muscle-massacre-gym-crm-35hfhu`** (149 commits, latest 2026-10-10).
   - Railway service `Muscle-Massacre-crm` deploys from that branch, at domain `gym-crm-live-production.up.railway.app`.
   - All member-app work must be based on that branch. **[D1]**
2. **[V] Ashbourne is authoritative for membership, but there is no Ashbourne API.**
   - Data reaches the CRM by Playwright browser automation that scrapes the Ashbourne BI web UI ("All Members" CSV export).
   - Sync is **manual only**: an Owner or Manager presses "Sync Now". There is no scheduler.
   - Nothing is written back to Ashbourne.
   - So CRM data is only as fresh as the last manual sync.
3. **[V] Payment data is not reliable enough to show members.**
   - `GymPayment` holds at most one payment per member, from a one-off Sales Report CSV import, plus manual entries.
   - There is no direct debit or payment feed.
4. **[V] Member attendance exists as `GymLiveEntryEvent`.** It is gate-entry data from a Windows bridge, matched on Ashbourne card number.
   - `GymAttendance` is *staff* clock-in and is not relevant.
   - There is a known timezone bug: local times are parsed as UTC, so times are one hour off during BST.
5. **[V] The deploy pipeline is the biggest risk to adding any schema.**
   - The start command is `npx prisma db push --accept-data-loss && npm run db:seed && npm run start`.
   - There are no migrations (`prisma/migrations` does not exist).
   - The agency CRM shares the same Railway project and Postgres service. **[A]** Both services point at the same database; the gym README says they "share the same database".
   - If that is true, any deploy of a schema that lacks the `Gym*` models, such as the agency branch's own `--accept-data-loss` commit `549e072`, could **drop gym tables**.
   - This must be resolved before any member-app schema work (Phase 0).
6. **[V] There is no member identity, no outbound email sending, no rate-limiting infrastructure, no CI and no scheduler.** These are all net-new.

---

## 1. Repository structure, schema, auth and Railway (audit)

### 1.1 Repository [V]
- `qaptures-creator/agencycrm` is a single Next.js 16.3 (App Router) + React 19 + Prisma 6.19 + PostgreSQL app hosting **two products**:
  - the agency CRM at `/`
  - the gym CRM at `/gym/*` and `/gym-login`
- Gym code layout:
  - `src/app/gym/*` (pages)
  - `src/actions/gym/*` (server actions, zod-validated, permission-checked, audit-logged)
  - `src/lib/gym/*` (domain logic)
  - `src/lib/ashbourne/*` (scraper and sync)
  - `src/lib/email/*` (IMAP sync and SMTP transport)
  - `src/app/api/gym/*` (route handlers and webhooks)
- Tests: Vitest; only `src/lib/gym/membership-rules.test.ts` exists. There is no `.github/workflows`, no `middleware.ts` and no CORS config.
- Other repos the account can reach (`klassmarquees`, `the-han-cafe-website`, `slough-automotives-website`) are unrelated.

### 1.2 Railway [V] (read-only inspection; no variable values read)
- Project **Prmote** (one environment: `production`). Services:
  - `Muscle-Massacre-crm`
  - `PRMOTE` (agency, deploys `claude/video-agency-crm-system-1cancp` @ `0b95860`)
  - `Postgres`
  - three marketing websites
- `Muscle-Massacre-crm`:
  - builder Railpack, one replica (sfo), private endpoint `gym-crm-live`
  - env var *names* include `DATABASE_URL`, `ASHBOURNE_*`, `GOODTILL_*`, `GYM_EMAIL_*` (IMAP/SMTP mailbox), `LIVE_ENTRY_WEBHOOK_SECRET`, `WEBSITE_ENQUIRY_WEBHOOK_SECRET`, `MAPBOX_*`, `PLAYWRIGHT_BROWSERS_PATH`
  - **`SEED_GYM_DEMO` is defined in production.** Its value was not read. **[A]** It must be confirmed as not `"true"`.
- There are no staging or preview environments. **[D2]** Add a `staging` environment with its own Postgres before member-app backend work.

### 1.3 Data model relevant to members [V] (`prisma/schema.prisma` on the gym branch)
| Model | Role | Source of truth |
|---|---|---|
| `GymMember` | Person. `memberNumber` (unique; equals the Ashbourne Member No for imported rows), `ashbourneMemberNo` (unique), `ashbourneCardNumber` (not unique), `email` (indexed, **not unique**), phone, dob, address, emergency contact, `ashbourneStatus`, `ashbourneMembershipType`, `ashbourneExpiryDate`, `reviewRequired`, geocode fields | Ashbourne for status, type and dates. Contact fields are only filled when empty; CRM-owned fields are never overwritten |
| `GymMembership` | One `source:"ASHBOURNE"` row per member. `status` ACTIVE / FROZEN / CANCELLED / EXPIRED / OVERDUE, `startDate`, `renewalDate`, `billingAmount` (Ashbourne "Period Payment"), `paymentStatus` (manual only), freeze dates | Sync recomputes `status` with `deriveMembershipStatus`, which overrides manual freeze/cancel in the CRM |
| `GymMembershipPlan` | Plan name. Ashbourne-sourced plans are auto-created with `price:0` | Ashbourne (name only) |
| `GymMembershipEvent` | History: JOINED / FROZEN / UNFROZEN / RENEWED / UPDATED / CANCELLED / PAYMENT_FAILED | CRM |
| `GymPayment` | Sparse: one Sales Report row per member, plus manual entries; `provider` defaults to "ASHBOURNE" even for manual rows | Unreliable |
| `GymLiveEntryEvent` | Gate entries (`cardNumber`, `entryTime`, `zone`, `device`, `memberId?`), dedup key `(cardNumber, device, entryTime)` | Ashbourne MVS log via Windows bridge |
| `GymAnnouncement` | **Staff-internal** (title, body, pinned). No audience, schedule or expiry | CRM |
| `GymSettings` | Singleton: name, address, phone, email, website, `openingHours Json?` (**never read or written anywhere**), lat/lng | CRM |
| `GymAuditLog` | `userId` refers to `GymUser` (staff) only | CRM |

Ashbourne status vocabulary (`canonicalizeAshbourneStatus`): Live, New, DD Presale, DD Hold, Defaulter, Final, Paid In Full, Complete, Freeze, Expired, Prospects, Indefinite Hold.
"Active" rule (`isActiveMembership`): the type must be one of 12 Month Contract, Presale Membership or Rolling Membership, **and** the status one of Live, New, Defaulter or Paid in Full.
`deriveMembershipStatus` has no tests, and treats Final, Complete and DD Hold as ACTIVE whenever the dates are open.

### 1.4 Staff authentication [V]
- `src/lib/gym/session.ts`:
  - cookie `mm_session` (httpOnly, secure in production, SameSite=Lax), 14-day fixed TTL
  - DB-backed `GymSession { tokenHash }`, where the token comes from `generateToken()` and is hashed with SHA-256 by `hashToken()` (`password.ts`)
- Passwords use scrypt with a per-user salt.
- Roles: OWNER / MANAGER / STAFF / MARKETING.
  - Static permission matrix: `can()` in `permissions.ts`.
  - DB-backed tab access: `requireTabAccess()` / `GymRolePermission`.
  - Guards: `requireGymUser`, `requirePermission`, `assertPermission` (`src/lib/gym/auth.ts`).
- API routes authenticate by cookie only. There is no Bearer support.
- Webhooks use a shared-secret header compared with `timingSafeEqual`. The `isValidSecret` helper is copy-pasted three times.
- **Weaknesses observed (existing CRM, out of scope here but reported):**
  - no login rate limiting
  - the user-exists timing leak on login
  - `generateTempPassword` uses `Math.random` with a small keyspace
  - sessions are not revoked on password reset
  - `mustResetPassword` is never enforced
  - CSV export routes (`/api/gym/members/export`, `/api/gym/dashboard/*/export`) check login only, not permission
  - agency `/api/search`, `/api/leads/[id]` and `/api/pipeline-stages` are unauthenticated
- **Outbound email:** `getSmtpTransport()` exists (nodemailer, gym mailbox `GYM_EMAIL_*`), but nothing sends mail today.

### 1.5 Reusable assets [V]
| Asset | Path | Reuse in member app |
|---|---|---|
| `hashToken`, `generateToken`, `timingSafeEqual` pattern | `src/lib/gym/password.ts` | Opaque member tokens and OTP hashing |
| Membership rules (pure) | `src/lib/gym/membership-rules.ts` | Member-facing status mapping |
| Live-entry queries | `src/lib/gym/live-entry-data.ts`, `entry-stats.ts` | Attendance (add a per-member query) |
| `logAudit`, `notifyManagement` | `src/lib/gym/audit.ts`, `notify.ts` | Staff-side audit of link and suspend actions; staff alerts for link requests |
| Prisma singleton | `src/lib/prisma.ts` | Shared |
| zod validator style | `src/lib/gym/validators.ts` | Request validation |
| Permission and tab system | `permissions.ts`, `role-permissions*.ts` | New CRM "Member App" tab |
| SMTP transport | `src/lib/email/smtp.ts` | Fallback only (see §6) |
| Webhook secret pattern | `src/app/api/gym/webhooks/*` | Cron and internal endpoints |

There is **no** existing per-member read service: no "get my membership" or "get my payments". These are net-new. Two pieces of SQL are reusable:
- the "current membership" lateral join `MEMBER_JOIN_SQL` (`src/lib/gym/member-filters.ts:148-158`)
- the `MemberRow` DTO shape (`member-filters-shared.ts:28`)

Further facts:
- **[V]** `GymMember.lastVisitAt` is never written. "Last visit" must come from `GymLiveEntryEvent`.
- **[V]** `prisma/seed.ts` creates a bootstrap Owner with a hardcoded fallback password if `GymUser` is ever empty. This is an existing-CRM risk, flagged.
- **[V]** The settings actions allow MANAGER, while `can(…,"manageSettings")` denies it. This is an inconsistency, flagged.
- **[V]** Demo plan names in `seed-gym-demo.ts` (Off-Peak, Full Access…) don't match the real Ashbourne types. The prototype fixtures use the real type names.

---

## 2. Backend recommendation [D3]

**Recommendation: a dedicated, versioned member API module inside the existing gym CRM codebase, deployed as a separate Railway service from the same branch.**

- **Code:**
  - routes at `src/app/api/member/v1/**`
  - logic at `src/lib/member/**` (auth, tokens, rate-limit, serializers)
  - A strict boundary: member code may import `membership-rules`, `prisma`, `password` helpers; it never imports staff session or permission code.
- **Single schema owner:** the same `prisma/schema.prisma`, migrated by exactly one service. This avoids two services running `db push` against one database.
- **Deployment:** a new Railway service `muscle-massacre-member-api`, built from the same repo and branch.
  - Env `APP_SURFACE=member-api` makes `next.config`/middleware serve only `/api/member/*` and return 404 for everything else.
  - **No schema push and no seed in its start command.**
  - It gets its own domain, e.g. `api.musclemassacre.com`.
- **Why not reuse existing endpoints:** they are cookie-authenticated, staff-scoped, permission-gated server actions, so they are unsuitable for a public mobile client.
- **Why not reuse the existing web service:**
  - It runs Playwright scraping in-process, which is heavy and has crash-loop history.
  - The member API needs independent scaling, rate limits and blast-radius isolation from staff tooling.
- **Why not a separate repo or API:** it would duplicate the Prisma schema and domain rules, and risk schema drift on a shared database.
- **Simpler alternative (acceptable for the pilot):** serve `/api/member/v1` from the existing `Muscle-Massacre-crm` service. Fewer moving parts, but staff-app deploys and outages hit members.

Mobile app code: a new repo `qaptures-creator/muscle-massacre-member-app` (Expo, EAS). **[D4]** The alternative is a `/mobile` folder on the gym branch. Shared request/response types are published as a small `contracts` package, or copied with a version check, in Phase 2.

---

## 3. Email OTP authentication and member linking

### 3.1 Identity model
- A `MemberAccount` is the app identity. It links 1:1 to `GymMember` (`memberId @unique`).
- Login identifier: the email address (normalised: trimmed and lower-cased).
- Members never self-register a gym membership; they can only claim an existing `GymMember`.

### 3.2 Flow
1. `POST /api/member/v1/auth/otp/request { email }` always returns `202 { challengeId, resendAfterSec }`, whether or not the email exists, to prevent enumeration.
   - The server resolves an **eligible link**:
     - exactly one `GymMember` with that email
     - `reviewRequired=false`
     - no `MemberAccount` in SUSPENDED or DISABLED
     - the app is enabled in settings
   - Eligible: generate a 6-digit code with `crypto.randomInt` and store `codeHash = HMAC-SHA256(OTP_PEPPER, challengeId + ":" + code)`. TTL 10 min, max 5 attempts, single use. Email the code.
   - Not eligible: create the challenge anyway, flagged `deliverable=false` (constant-time path). Send a "we couldn't sign you in — contact reception" email only when the address matches **multiple** members. For an unknown address, send nothing **[D5]**.
2. `POST /api/member/v1/auth/otp/verify { challengeId, code, device:{ id, platform, model, appVersion } }`
   - Constant-time compare and increment `attempts`. Lock the challenge after 5 failures.
   - Success: create the `MemberAccount` on first login (`linkMethod=EMAIL_AUTO`), then create a `MemberSession`.
   - Response: `{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, member: MeSummary }`.
3. **Tokens:** opaque random values from `generateToken()`, stored only as SHA-256 hashes, matching the existing staff pattern.
   - Access token TTL 15 min. Refresh token TTL 60 days, rotated on every refresh.
   - **Reuse detection:** presenting an already-rotated refresh token revokes the whole session family.
   - The client stores tokens in `expo-secure-store` (Keychain/Keystore) and sends `Authorization: Bearer <access>`. No cookies, so no CSRF surface.
4. `POST /auth/refresh`, `POST /auth/logout` (revokes the current session), `DELETE /me` (account deletion, see §9).
5. Every request re-checks:
   - the session is valid
   - the account is ACTIVE
   - `GymMember` still exists
   - the app is enabled
   - the client is at or above the minimum app version (otherwise `426` → force-update screen)

### 3.3 Rate limits (Postgres-backed; no Redis needed at this scale)
- OTP request: 3 per email per 15 min, 10 per email per day, 20 per IP per hour; resend cooldown 60 s.
- OTP verify: 5 attempts per challenge; 30 per IP per hour.
- Refresh: 60 per session per hour.
- Implementation: a `MemberRateLimitBucket` table (key, window start, count) with an atomic upsert-increment. **[D6]** Alternative: add Railway Redis.

### 3.4 Linking edge cases
| Case | Handling |
|---|---|
| Email matches 0 members | No code sent. The app shows a generic "If this email is registered, a code is on its way" message, then "Didn't get a code?" help, which offers **Request access** (name, email, member number, DOB). That creates a `MemberLinkRequest` and notifies management (`notifyManagement`). |
| Email matches more than one member | **[V]** Common: Ashbourne gives each day pass a new member number, so one person often has several `GymMember` rows with the same email (`returning-day-pass.ts` header). Rule: if exactly **one** match has a current non-day-pass membership (`isActiveMembership` / most recent membership via `MEMBER_JOIN_SQL` in `member-filters.ts`), auto-link to it. Otherwise (a shared family email, or several current memberships), there is no auto-link: staff resolve it in the CRM and may set a distinct login email. **[D18]** |
| `reviewRequired=true` | No auto-link until staff resolve it. |
| Member's email changes in Ashbourne | **[V]** Sync only fills email when it is empty, so the CRM keeps the old email. The `MemberAccount.loginEmail` is independent, and staff can change it in the CRM. Flagged as a data-quality risk. |
| Membership expired or cancelled | Login allowed. The app shows the expired state and a contact-to-rejoin prompt **[D7]**. |
| `GymMember` deleted or merged | Sessions are revoked (FK cascade) and the account is disabled. |
| Staff suspend an account | All sessions are revoked immediately. |

### 3.5 OTP email delivery [D8]
- **Recommended:** a transactional email provider (Postmark or Resend) on a verified subdomain, e.g. `login@mail.musclemassacre.com`, with SPF, DKIM and DMARC. Its API key is stored only as a Railway variable.
- Fallback: the existing `GYM_EMAIL_*` SMTP mailbox (`getSmtpTransport`). Not recommended: it has deliverability and throughput limits, mixes with the enquiries inbox, and a mailbox password would sit on a second service.

---

## 4. Mobile navigation and screen inventory (Expo Router)

```
(auth) stack
  Welcome → EmailEntry → CodeEntry → [NotificationPrimer] → (tabs)
          ↘ HelpNoCode → RequestAccess → RequestSubmitted
(tabs)
  Home | Membership | Visits | Notices | Profile
modal / system
  ForceUpdate · Maintenance (app disabled) · SessionExpired · OfflineBanner (global)
```

| # | Screen | Purpose |
|---|---|---|
| A1 | Welcome | Brand, "Sign in with email", links to privacy policy and terms |
| A2 | Email entry | Email field and validation |
| A3 | Code entry | 6-digit input (iOS `oneTimeCode` autofill), resend countdown, change email |
| A4 | Help / didn't get a code | Spam-folder tip, gym contact details, Request access |
| A5 | Request access | Name, member number (optional), DOB, email → link request |
| A6 | Request submitted | Confirmation and what happens next |
| A7 | Notification primer | Explains push before the OS prompt; skippable |
| H1 | **Home** | Greeting, membership status card, visits this month and streak, pinned or latest notice, today's opening hours, quick links |
| M1 | **Membership** | Plan, status badge, start date, renewal or expiry, billing amount and frequency (**[D9]** whether to show), freeze period if any, data freshness ("Updated from Ashbourne on …") |
| M2 | Membership help | How to freeze, cancel or change; contact reception. No self-service changes in v1 (no Ashbourne write-back) |
| M3 | Digital membership card | Name and member number (**[D10]**: display only; gate entry uses Ashbourne fingerprint/card, so no QR entry) |
| V1 | **Visits** | Monthly visit count, calendar heatmap, list of entries (date, time, zone) |
| V2 | Visit month detail | Paged history |
| N1 | **Notices** | Member announcements list, pinned first, unread markers |
| N2 | Notice detail | Full body, image (optional), published date |
| P1 | **Profile** | Name, email, phone, member number |
| P2 | Personal details | Read-only identity fields; "Request a change" form → CRM enquiry |
| P3 | Emergency contact | Editable (CRM-owned field) **[D11]** |
| P4 | Notification settings | Toggles: notices, membership reminders |
| P5 | Gym info | Address, map link, phone, email, opening hours |
| P6 | Privacy and data | Privacy policy, data summary, "Download my data" request |
| P7 | Delete app account | Confirmation and explanation (does not cancel the gym membership) |
| P8 | Help and contact | FAQ, contact |
| P9 | About | Version, terms, licences |
| S1–S4 | Force update · Maintenance · Session expired · Offline | System states |

---

## 5. Data contracts (v1, JSON, `Authorization: Bearer`)

Conventions:
- Dates are ISO-8601 UTC, rendered in Europe/London on the client. Money is pence (integer) plus `currency:"GBP"`.
- Errors: `{ error: { code, message } }`. Codes: `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `ACCOUNT_SUSPENDED`, `RATE_LIMITED`, `UPGRADE_REQUIRED`, `APP_DISABLED`, `VALIDATION`, `NOT_FOUND`.
- **The member ID always comes from the session, never from the client.**

```ts
type MembershipStatus = "ACTIVE" | "FROZEN" | "EXPIRED" | "CANCELLED" | "PENDING_START" | "UNKNOWN";

interface MeSummary { accountId: string; memberNumber: string; firstName: string; fullName: string; email: string; }

// GET /api/member/v1/home
interface HomeResponse {
  member: MeSummary;
  membership: MembershipSummary | null;
  visits: { thisMonth: number; lastMonth: number; lastVisitAt: string | null; currentWeekStreak: number };
  featuredNotice: NoticeSummary | null;
  unreadNoticeCount: number;
  gym: { todayHours: { open: string; close: string } | null; isOpenNow: boolean | null };
  dataFreshness: { membershipSyncedAt: string | null; entriesUpdatedAt: string | null };
}

interface MembershipSummary {
  planName: string;                 // canonicalized, e.g. "12 Month Contract"
  status: MembershipStatus;         // mapped server-side from GymMembership.status + ashbourneStatus
  statusLabel: string;              // member-friendly copy, e.g. "Active", "Frozen until 3 Nov"
  isDayPass: boolean;
}

// GET /api/member/v1/membership
interface MembershipResponse extends MembershipSummary {
  startDate: string | null;
  renewalOrExpiryDate: string | null;
  billing: { amountPence: number; currency: "GBP"; frequency: "WEEKLY" | "MONTHLY" | "ANNUAL" } | null; // null if D9 = hide
  freeze: { start: string | null; end: string | null } | null;
  history: { type: "JOINED" | "FROZEN" | "UNFROZEN" | "RENEWED" | "CANCELLED"; at: string }[]; // filtered GymMembershipEvent
  lastSyncedAt: string | null;      // GymMember.ashbourneLastSyncedAt
  supportContact: { phone: string | null; email: string };
}
// Never exposed: raw ashbourneStatus, notes, reviewRequired, paymentStatus, geocode fields, staff identities.

// GET /api/member/v1/notices?cursor=&limit=20
interface NoticeSummary { id: string; title: string; excerpt: string; pinned: boolean; publishedAt: string; read: boolean; imageUrl: string | null; }
interface NoticesResponse { items: NoticeSummary[]; nextCursor: string | null; }
// GET /api/member/v1/notices/:id   → NoticeSummary & { body: string /* plain text or sanitised markdown */ }
// POST /api/member/v1/notices/:id/read → 204

// GET /api/member/v1/visits?month=2026-10
interface VisitsResponse {
  month: string;                    // YYYY-MM
  total: number;
  days: { date: string; count: number }[];        // heatmap
  entries: { id: string; at: string; zone: string | null }[]; // device id never exposed
  monthsAvailable: string[];
}

// GET /api/member/v1/profile
interface ProfileResponse {
  member: MeSummary & { phone: string | null; dob: string | null; addressSummary: string | null /* postcode district only */ };
  emergencyContact: { name: string | null; phone: string | null };
  notificationPrefs: { notices: boolean; membershipReminders: boolean };
  gym: { name: string; address: string | null; phone: string | null; email: string; website: string; openingHours: OpeningHours | null };
}
// PATCH /api/member/v1/profile/emergency-contact { name, phone }
// PATCH /api/member/v1/profile/notification-prefs { notices?, membershipReminders? }
// POST  /api/member/v1/profile/change-request { field: "name"|"email"|"phone"|"address"|"dob", requestedValue, note? } → creates GymEnquiry(source "MEMBER_APP")
// POST  /api/member/v1/devices { expoPushToken, platform } · DELETE /api/member/v1/devices/:id
// DELETE /api/member/v1/me   (account deletion)
type OpeningHours = Record<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun", { open: string; close: string } | null>;
```

---

## 6. Prisma schema changes (all additive; no existing column altered)

New models:
- `MemberAccount`:
  - `id`, `memberId @unique → GymMember (onDelete: Cascade)`, `loginEmail @unique`
  - `status` ACTIVE / SUSPENDED / DISABLED, `linkMethod` EMAIL_AUTO / STAFF_MANUAL / LINK_REQUEST, `linkedById → GymUser?`
  - `notifyNotices`, `notifyMembership`, `lastLoginAt`, `deletedAt`, timestamps
- `MemberOtpChallenge`:
  - `id`, `email`, `accountId?`, `memberId?`, `codeHash`, `deliverable`, `attempts`, `expiresAt`, `consumedAt`, `ipHash`, `userAgent`, `createdAt`
  - indexes on `[email, createdAt]` and `[expiresAt]`
- `MemberSession`:
  - `id`, `accountId`, `familyId`, `accessTokenHash @unique`, `refreshTokenHash @unique`, `accessExpiresAt`, `refreshExpiresAt`
  - `rotatedFromId?`, `revokedAt?`, `revokedReason?`
  - `deviceId`, `platform`, `appVersion`, `lastSeenAt`, `createdAt`
- `MemberDevice`: `id`, `accountId`, `expoPushToken @unique`, `platform`, `enabled`, `lastRegisteredAt`
- `MemberAnnouncement`:
  - `id`, `title`, `body`, `imageUrl?`, `pinned`
  - `audience` ALL / ACTIVE / DAY_PASS, `status` DRAFT / SCHEDULED / PUBLISHED / ARCHIVED
  - `publishAt?`, `expiresAt?`, `sendPush`, `pushSentAt?`, `createdById → GymUser`, timestamps
  - Deliberately separate from the staff `GymAnnouncement`, which stays untouched.
- `MemberAnnouncementRead`: `[announcementId, accountId] @@unique`, `readAt`
- `MemberNotification`: `id`, `accountId`, `type`, `title`, `body`, `data Json?`, `sentAt`, `expoTicketId?`, `receiptStatus?`, `error?`
- `MemberLinkRequest`: `id`, `email`, `fullName`, `memberNumber?`, `dob?`, `status` PENDING / LINKED / REJECTED, `resolvedById?`, `resolvedMemberId?`, `note?`, timestamps
- `MemberSecurityEvent`: `id`, `accountId?`, `type` (OTP_REQUESTED, OTP_FAILED, LOGIN, REFRESH_REUSE_DETECTED, LOGOUT, SUSPENDED, DELETED, …), `ipHash`, `metadata Json?`, `createdAt`
- `MemberRateLimitBucket`: `key @id`, `windowStart`, `count`
- `MemberAppSettings` (singleton): `enabled`, `minSupportedVersionIos`, `minSupportedVersionAndroid`, `supportMessage?`, `updatedAt`

Additions to existing models (relation back-fields only, with no column change on the existing tables): `GymMember.memberAccount MemberAccount?`, plus `GymUser` back-relations for `linkedBy`, `createdBy` and `resolvedBy`.
`GymSettings.openingHours` is reused; the CRM gets an editor for it.

**Migration strategy (Phase 0, prerequisite):**
1. Verify whether `PRMOTE` and `Muscle-Massacre-crm` share one database. Check variable *references* in the Railway dashboard; don't read the values.
2. Generate a baseline migration from the current gym schema with `prisma migrate diff --from-empty --to-schema-datamodel` → `0_baseline`. Mark it applied in each environment with `prisma migrate resolve --applied 0_baseline`. This step needs approval and is executed by the owner.
3. Change the gym start command to `prisma migrate deploy && npm run db:seed && npm run start`, removing `db push --accept-data-loss`.
4. Then ship member-app tables as normal migrations, rehearsed on `staging` first.

If the databases are shared, the agency service must also stop running `db push` against them, or move to its own Postgres. **[D12]**

---

## 7. CRM management controls (new, additive)

All of this sits in a new sidebar tab **"Member App"** (`/gym/member-app`):
- new permission key `manageMemberApp` (OWNER and MANAGER by default)
- the href is added to `ALL_TAB_HREFS`; no existing tab changes

1. **Accounts:**
   - Lists linked accounts, last login, devices, status.
   - Actions: link a member manually, change login email, suspend/reinstate, revoke all sessions, unlink.
   - Every action calls `logAudit`.
2. **Link requests:** a queue with suggested matches (member number, DOB, email, name). Approve → link; reject → reason.
3. **Member announcements:**
   - Create, edit, schedule, publish or archive; audience; "send push" toggle; phone preview.
   - Shows read counts and push delivery stats.
4. **Notifications log:** push sends, failures and invalid tokens.
5. **App settings:**
   - kill switch (`enabled`), minimum app versions, support message
   - opening-hours editor (writes `GymSettings.openingHours`)
6. **Member profile integration:** an "App access" panel on `/gym/members/[id]` showing status, last login and quick actions.
7. **Security events:** Owner-only view of `MemberSecurityEvent`.
8. **Change requests:** they arrive in the existing Enquiries inbox as `source:"MEMBER_APP"`, using the existing workflow unchanged.

---

## 8. Notifications

- **Expo Push Service** via `expo-server-sdk`, using APNs key and FCM v1 credentials configured in EAS.
- Push tokens live in `MemberDevice`. Invalid tokens (`DeviceNotRegistered` receipts) are disabled automatically.
- **Triggers in v1:**
  - a member announcement is published with `sendPush`
  - membership expiring in 7 days (rolling and contract types, if `renewalOrExpiryDate` is known)
  - a freeze ends tomorrow
  - optional "we've missed you" message after N days with no visits **[D13]**, off by default, opt-in only
- **Scheduler:** a Railway **cron service** from the same repo runs `node scripts/member-cron.js` every 15 min. It handles scheduled announcements, reminders, receipt polling, and purging expired OTPs and sessions.
- **Optional, separate approval:** scheduled Ashbourne sync, e.g. every 4 h, to keep app data fresh. **[D14]**
- Every push is also an in-app record; push content never includes sensitive data (no amounts, no health information).
- Members opt in: the OS prompt comes after the primer, with per-category toggles.

---

## 9. Security, privacy and store compliance

**Security:**
- OWASP MASVS L1 and the OWASP API Top 10. Specifically:
  - object-level authorisation is enforced by deriving `memberId` from the session only
  - generic auth responses
  - rate limits
  - hashed tokens and OTPs
  - refresh rotation with reuse detection
  - TLS only
  - strict zod schemas (`.strict()`)
  - no PII or tokens in logs
  - a request size cap
  - `Cache-Control: no-store`
- CORS: deny all; the native app doesn't need it.
- Secrets: `OTP_PEPPER`, the email-provider key and the Expo access token are Railway variables on the member-api service only. They are never in the client bundle; Expo `EXPO_PUBLIC_*` holds only the API base URL.
- Biometrics: **[V]** none are stored or transmitted today; the member app keeps it that way. Optionally, a device-biometric unlock of the stored refresh token (local only).
- Pre-launch: dependency audit, a security review of `/api/member/**`, and a third-party pen test **[D15]**.

**Privacy (UK GDPR / DPA 2018):**
- Lawful basis: contract (performance of the membership).
- Update the privacy notice to cover the app. Record a DPIA-lite, given gate-entry data is location/behavioural data.
- Retention:
  - OTP challenges: 24 h
  - sessions: purge 30 days after expiry
  - security events: 12 months
  - push logs: 90 days
- Data subject rights: export-on-request through the CRM; in-app account deletion removes the `MemberAccount`, sessions, devices, reads and notifications, and leaves the gym membership record, which is governed by the gym's contract and retention policy.
- Data minimisation: the app shows only the postcode district, never the full address; never shows device IDs or raw Ashbourne statuses.
- Processors to list: Railway, the email provider, Expo/Apple/Google push.

**App Store (Apple):**
- in-app account deletion (guideline 5.1.1(v))
- privacy policy URL; App Privacy "nutrition label" (contact info, identifiers, usage data; no tracking → no ATT prompt)
- privacy manifest (Expo SDK supplies the required-reason APIs)
- review demo access **[D16]**: a reviewer account whose OTP goes to a gym-controlled mailbox, or a server-side fixed code allow-listed for one dedicated test member in production behind a flag
- No in-app purchases in v1. If memberships are later sold in-app, assess guideline 3.1.3(e) (services consumed outside the app may use external payment).
- Sign in with Apple is not required: there is no third-party social login.

**Google Play:**
- Data safety form; account-deletion web URL (Play requires a web page, not only in-app)
- target API level current at submission; `POST_NOTIFICATIONS` runtime permission (Android 13+)

---

## 10. Phased implementation plan

| Phase | Scope | Depends on | Key risks | Acceptance criteria |
|---|---|---|---|---|
| **0. Foundations (owner-approved ops)** | Resolve D1–D16; confirm DB sharing and `SEED_GYM_DEMO`; create `staging` env and DB; baseline migration and `migrate deploy`; fix BST parsing in live-entry; tests for `deriveMembershipStatus`; email provider domain set up; Apple and Google developer accounts; privacy policy draft | Approval | Shared-DB data loss; Ashbourne scraper fragility | Gym service deploys via `migrate deploy` on staging and prod with zero drift (`migrate diff` empty); no `--accept-data-loss` anywhere; entry times correct across a BST/GMT boundary in tests |
| **1. Interactive prototype** | Standalone Expo app, mock data, every screen in §4 (see §11) | Phase-0 decisions D4, D7, D9–D11 | Scope creep | Stakeholders can walk every flow on device and web; sign-off on navigation and copy |
| **2. Member API + auth** | Schema migration (§6); `/api/member/v1` auth, home, membership, visits, notices, profile; rate limits; security events; unit and integration tests (Vitest against a test DB); GitHub Actions CI (lint, typecheck, test) | 0 | OTP deliverability; linking ambiguity | All contracts pass contract tests; OTP limits enforced; cross-member access impossible (tests attempt IDOR); p95 < 300 ms on staging |
| **3. CRM controls** | Member App tab (§7), announcement composer, link-request queue, opening-hours editor, member-profile panel | 2 | Accidental change to existing CRM | Existing pages unchanged (smoke tests of current tabs); new permission enforced server-side; every action audit-logged |
| **4. Mobile app (real)** | Swap prototype mocks for the API client; secure storage; token refresh; offline cache (read-only); error and system states; accessibility (Dynamic Type, VoiceOver/TalkBack); EAS dev, preview and production builds | 1, 2 | Expo/SDK upgrades; OTP autofill differences | E2E (Maestro) for sign-in, home, membership, visits, notices, profile, delete account on iOS and Android; crash-free sessions ≥ 99.5% in beta |
| **5. Notifications + cron** | `MemberDevice` registration, Expo push, Railway cron service, reminders, receipts | 2, 3, 4 | Push credential setup; over-notifying | Announcement push reaches beta devices; invalid tokens disabled; opt-out respected |
| **6. Hardening and beta** | Security review and pen test, DPIA, store listings, TestFlight and Play internal testing with ~20 members | 4, 5 | Store rejection (demo access, deletion) | No high or critical findings open; privacy labels match actual data; beta feedback triaged |
| **7. Launch** | Store submission, phased rollout, monitoring (Railway metrics, error tracking e.g. Sentry **[D17]**), runbook | 6 | Load on OTP sending at launch | Approved in both stores; kill switch tested; on-call runbook signed off |

Cross-cutting risks:
- **Ashbourne freshness.** Manual sync means stale app data. Show "updated on" timestamps and decide on D14.
- **Data quality.** Shared emails, `reviewRequired`, Final/Complete/DD Hold treated as ACTIVE. Phase 0 should review `deriveMembershipStatus` with the owner.
- **Ashbourne UI changes** can break the scraper silently. Add a sync-failure alert to management.

---

## 11. Proposed standalone interactive prototype (Phase 1)

- **What:** an Expo (latest stable SDK) + Expo Router + TypeScript app in the new member-app repo (D4).
  - Every screen in §4 and the dark/purple Muscle Massacre theme from `.gym-theme`.
  - A `MockApiClient` that implements the exact §5 contracts from local fixtures, with simulated latency, plus a "scenario switcher" in a hidden dev menu: active, frozen, expired, day-pass, no visits, unlinked email, rate-limited, offline.
- **Mock data:** a realistic but fictional fixture set modelled on the shapes in `prisma/seed-gym-demo.ts`.
  - real plan names (12 Month Contract, Rolling Membership, Presale Membership, Day Pass)
  - about 3 months of plausible gate entries
  - 6 notices
  - opening hours
  - **No production data, database access, network calls or credentials.**
  - The OTP screen accepts `123456` in the prototype only; the code path is compiled out of real builds.
- **How reviewed:**
  - Expo Go on phones (QR code)
  - a static web export (`expo export -p web`) published as a private shareable link for stakeholders without a device
- **Out of scope:** real auth, push, persistence.

---

## 12. Decisions requiring approval

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Base all member-app backend work on `claude/muscle-massacre-gym-crm-35hfhu`, not the session branch | Yes. Also consider promoting the gym branch to a proper long-lived branch or repo |
| D2 | Create a Railway `staging` environment and DB | Yes |
| D3 | Member API as a module in the gym codebase, deployed as a separate Railway service | Yes (pilot fallback: same service) |
| D4 | Mobile app in a new repo | Yes |
| D5 | Email response for unknown addresses | Send nothing; identical API response |
| D6 | Rate-limit store | Postgres table (no Redis) |
| D7 | Expired or cancelled members may sign in | Yes, with a rejoin prompt |
| D8 | OTP email provider | Postmark or Resend on a subdomain |
| D9 | Show billing amount | Hide in v1 (Period Payment quality unverified) |
| D10 | Digital card is display-only (no QR entry) | Yes |
| D11 | Members can edit emergency contact in-app; other fields via change request | Yes |
| D12 | Separate the agency CRM database from the gym database | Yes, strongly |
| D13 | "We've missed you" re-engagement push | Off by default |
| D14 | Scheduled Ashbourne sync | Every 4 h, after the scraper gets alerting |
| D15 | Third-party pen test before launch | Yes |
| D16 | App Review demo-access method | Gym-controlled mailbox |
| D17 | Error tracking (Sentry) | Yes, PII scrubbing on |
| D18 | Auto-link rule when an email matches several `GymMember` rows | Link only if exactly one has a current non-day-pass membership; otherwise staff review |

## 13. Next steps after approval (nothing executed yet)

1. Commit this specification as `docs/member-app/SPEC.md`, on the approved branch (D1).
2. Build the Phase 1 prototype in the approved location (D4). It is mock-only and has no production access.
3. Phase 0 ops items: run only with explicit owner sign-off, each listed command reviewed first.

## Verification of this audit
- Gym code was read from a detached read-only worktree of `origin/claude/muscle-massacre-gym-crm-35hfhu` in the scratchpad.
- Railway was inspected with read-only MCP calls (project, service list, service config, variable *names* only).
- No writes to GitHub, Railway or any database.
