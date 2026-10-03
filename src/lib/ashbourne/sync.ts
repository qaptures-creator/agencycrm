import "server-only";
import { prisma } from "@/lib/prisma";
import { getAshbourneConfig } from "./config";
import { withAshbourneBrowser } from "./client";
import { loginToAshbourne } from "./auth";
import { fetchAshbourneAllMembersCsv } from "./reports";
import type { AshbourneMember } from "./types";
import { AshbourneConnectorError } from "./types";
import { canonicalizeMembershipType, canonicalizeAshbourneStatus, deriveMembershipStatus } from "@/lib/gym/membership-rules";

/**
 * Matching (Phase 5): ashbourneMemberNo first, then memberNumber (catches
 * everyone already linked via the existing CSV import, whose memberNumber
 * is Ashbourne's InternalID — see the schema comment on GymMember), then a
 * conservative single-match-only email fallback. Ambiguous or conflicting
 * matches are never auto-merged — they're flagged reviewRequired instead.
 *
 * Field ownership (Phase 6): Ashbourne fields (ashbourneStatus/
 * ashbourneMembershipType/ashbourneExpiryDate/ashbourneLastSyncedAt) are
 * always refreshed on a match. email/phone/dob/address/postcode are filled
 * only if currently empty — never overwritten. fullName/joinDate/notes and
 * everything else CRM-owned is left untouched on existing members.
 *
 * ashbourneCardNumber (Card No, added for live-entry matching — distinct
 * from Member No) follows the same Ashbourne-owned rule but only when the
 * report row actually has one: set/refreshed whenever record.cardNo is
 * present, left as-is when a row is missing it rather than blanking out a
 * previously-synced value.
 *
 * Membership status (Phase 12): fetchAshbourneAllMembersCsv (see reports.ts)
 * replaced the old "New Members" report, which had no Status/Membership
 * Type/date columns at all — every synced member now also gets its one
 * ASHBOURNE-sourced GymMembership upserted, with `status` computed by the
 * single shared deriveMembershipStatus function (membership-rules.ts) from
 * real dates, not trusted from Ashbourne's raw status text. Raw
 * Status/Membership Type values are canonicalized to a consistent casing
 * before being stored anywhere (Ashbourne's exports are ALL CAPS; the rest
 * of the app's matching logic compares Title Case) — see
 * canonicalizeAshbourneStatus/canonicalizeMembershipType.
 */

export type SyncOutcome = {
  success: boolean;
  dryRun: boolean;
  recordsFound: number;
  created: number;
  updated: number;
  unchanged: number;
  reviewRequired: number;
  skipped: number;
  failed: number;
  error?: string;
  /** Only populated for dry runs — a small sample so staff can sanity-check
   * before approving a real sync, without dumping the entire dataset. */
  sample?: { action: "create" | "update" | "unchanged" | "review"; memberNo: string; name: string }[];
  /** Split so a slow run can be diagnosed from the result alone — ashbourneMs
   * is everything up to and including the CSV download (login, the report
   * wizard, the file download itself — a third-party site's wizard, not
   * something a code change here speeds up), dbMs is the matching/upsert
   * loop against our own database (the part concurrency batching targets). */
  timing?: { ashbourneMs: number; dbMs: number; totalMs: number };
  /** Count of GymMembershipEvent rows created this run (or that WOULD be
   * created, for a dry run — same classification logic, just not written).
   * Written in one batched createMany after the loop, not per-record. */
  historyEvents?: number;
};

function fullNameOf(m: AshbourneMember): string {
  return [m.firstName, m.surname].filter(Boolean).join(" ").trim() || m.memberNo;
}

/**
 * History tracking (Tier 3): classifies whether a membership's state change
 * is "meaningful" enough to log, and as what GymMembershipEvent type — pure,
 * in-memory, zero DB calls. Every input here is already fetched as part of
 * the record's normal processing (the same `existing`/computedStatus values
 * already used for the dry-run fieldsChanged comparison), so classifying
 * costs nothing extra; only turning the result into an actual event row
 * costs anything, and even that's deferred to one batched createMany at the
 * end of the run rather than a write per record.
 */
type MembershipChangeKind = "joined" | "frozen" | "unfrozen" | "renewed" | "updated" | "none";

function classifyMembershipChange(input: {
  isNew: boolean;
  oldStatus: string | null;
  newStatus: string;
  oldRenewalDate: Date | null;
  newRenewalDate: Date | null;
  oldType: string | null;
  newType: string | null;
}): { kind: MembershipChangeKind; reason?: string } {
  if (input.isNew) return { kind: "joined" };
  if (input.newStatus === "FROZEN" && input.oldStatus !== "FROZEN") return { kind: "frozen" };
  if (input.oldStatus === "FROZEN" && input.newStatus !== "FROZEN") return { kind: "unfrozen" };
  if ((input.oldRenewalDate?.getTime() ?? null) !== (input.newRenewalDate?.getTime() ?? null)) return { kind: "renewed" };
  if (input.oldStatus !== input.newStatus) return { kind: "updated", reason: `status ${input.oldStatus ?? "none"} -> ${input.newStatus}` };
  if (input.oldType !== input.newType) return { kind: "updated", reason: `type ${input.oldType ?? "none"} -> ${input.newType ?? "none"}` };
  return { kind: "none" };
}

const EVENT_TYPE_BY_CHANGE_KIND: Record<Exclude<MembershipChangeKind, "none">, string> = {
  joined: "JOINED",
  frozen: "FROZEN",
  unfrozen: "UNFROZEN",
  renewed: "RENEWED",
  updated: "UPDATED",
};

type MatchResult =
  | { kind: "member-no"; memberId: string }
  | { kind: "member-number"; memberId: string }
  | { kind: "email"; memberId: string }
  | { kind: "review"; reason: string }
  | { kind: "none" };

async function findMatch(record: AshbourneMember): Promise<MatchResult> {
  const byAshbourneNo = await prisma.gymMember.findUnique({ where: { ashbourneMemberNo: record.memberNo }, select: { id: true } });
  if (byAshbourneNo) return { kind: "member-no", memberId: byAshbourneNo.id };

  const byMemberNumber = await prisma.gymMember.findUnique({ where: { memberNumber: record.memberNo }, select: { id: true, ashbourneMemberNo: true } });
  if (byMemberNumber) {
    if (byMemberNumber.ashbourneMemberNo && byMemberNumber.ashbourneMemberNo !== record.memberNo) {
      return { kind: "review", reason: `memberNumber ${record.memberNo} already linked to a different ashbourneMemberNo (${byMemberNumber.ashbourneMemberNo})` };
    }
    return { kind: "member-number", memberId: byMemberNumber.id };
  }

  if (record.email) {
    const emailMatches = await prisma.gymMember.findMany({ where: { email: { equals: record.email, mode: "insensitive" } }, select: { id: true, ashbourneMemberNo: true } });
    if (emailMatches.length === 1) {
      const m = emailMatches[0];
      if (m.ashbourneMemberNo && m.ashbourneMemberNo !== record.memberNo) {
        return { kind: "review", reason: `email ${record.email} matched a member already linked to a different Ashbourne Member No (${m.ashbourneMemberNo})` };
      }
      return { kind: "email", memberId: m.id };
    }
    if (emailMatches.length > 1) {
      return { kind: "review", reason: `email ${record.email} matched ${emailMatches.length} existing CRM members — ambiguous` };
    }
  }

  return { kind: "none" };
}

export async function syncAshbourneMembers(opts: { dryRun: boolean }): Promise<SyncOutcome> {
  const cfg = getAshbourneConfig(); // throws AshbourneNotConfiguredError if unset — caller handles

  const log = await prisma.gymAshbourneSyncLog.create({
    data: { status: "RUNNING", dryRun: opts.dryRun, reportUrl: cfg.allMembersReportUrl },
  });

  const outcome: SyncOutcome = {
    success: false,
    dryRun: opts.dryRun,
    recordsFound: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    reviewRequired: 0,
    skipped: 0,
    failed: 0,
    sample: [],
    historyEvents: 0,
  };

  // Plan lookups are cached per run (mirrors ashbourne-sales-import.ts) —
  // a fresh sync of ~2,375 members would otherwise re-query the same ~10
  // membership type plans thousands of times. Caches the in-flight PROMISE,
  // not just its resolved value — records now process concurrently (see the
  // batched loop below), so without this, two records hitting a brand-new
  // plan name at the same moment could both miss the cache and both race to
  // create a duplicate GymMembershipPlan row (name isn't a unique column).
  // Caching the promise means the second caller awaits the first's in-flight
  // create instead of starting its own.
  const planCache = new Map<string, Promise<string>>(); // canonical plan name -> id

  function findOrCreatePlanId(canonType: string): Promise<string> {
    const cached = planCache.get(canonType);
    if (cached) return cached;
    const promise = (async () => {
      const existingPlan = await prisma.gymMembershipPlan.findFirst({ where: { name: canonType, source: "ASHBOURNE" } });
      const plan = existingPlan ?? (await prisma.gymMembershipPlan.create({ data: { name: canonType, price: 0, source: "ASHBOURNE" } }));
      return plan.id;
    })();
    planCache.set(canonType, promise);
    return promise;
  }

  /** Upserts the one ASHBOURNE-sourced GymMembership for a member — status
   * is always computed via deriveMembershipStatus (Step 2 of the
   * membership-accuracy plan: derived from dates every sync, never trusted
   * from a stored value), never set directly from the raw Ashbourne status
   * text. freezeStart/freezeEnd/cancelledAt are never touched here —
   * Ashbourne's export has no signal for them (see deriveMembershipStatus's
   * doc comment), so those stay CRM-manual.
   *
   * Takes `existingMembershipId` rather than looking it up itself — the
   * caller already knows this (it's part of the `existing` member fetch for
   * updates, and trivially null for brand-new members), so this used to run
   * a redundant findFirst on every single record; passing it in removes
   * that query entirely rather than adding one for history tracking. */
  async function upsertMembership(
    memberId: string,
    record: AshbourneMember,
    canonType: string | null,
    canonStatus: string | null,
    existingMembershipId: string | null
  ): Promise<{ membershipId: string; status: string }> {
    const planId = await findOrCreatePlanId(canonType ?? "Unknown");
    const status = deriveMembershipStatus({ ashbourneStatus: canonStatus, startDate: record.joinedDate ?? null, endDate: record.expiryDate ?? null });

    const data = {
      planId,
      status,
      startDate: record.joinedDate ?? undefined,
      renewalDate: record.expiryDate ?? null,
      billingAmount: record.periodPayment ?? undefined,
    };

    if (existingMembershipId) {
      await prisma.gymMembership.update({ where: { id: existingMembershipId }, data });
      return { membershipId: existingMembershipId, status };
    }
    const created = await prisma.gymMembership.create({
      data: {
        memberId,
        planId,
        status,
        startDate: record.joinedDate ?? new Date(),
        renewalDate: record.expiryDate ?? null,
        billingAmount: record.periodPayment ?? 0,
        source: "ASHBOURNE",
      },
    });
    return { membershipId: created.id, status };
  }

  // History events (Tier 3) are collected here across the whole run and
  // written in ONE batched createMany after the loop — never per-record —
  // so a sync that changes 10 memberships does exactly one extra insert
  // query total, regardless of whether it's 10 or 2,000 members.
  const pendingEvents: { membershipId: string; type: string; notes: string }[] = [];

  const runStartedAt = Date.now();

  try {
    // One retry — the Ashbourne site itself has shown occasional transient
    // flakiness mid-flow (a client-side script that's supposed to re-enable
    // a form control sometimes just doesn't fire), and a full login + ~15
    // step wizard is a lot of surface area for a one-off hiccup to ruin an
    // otherwise-working run. A fresh browser session on retry sidesteps
    // whatever transient state caused the first attempt to fail.
    let result;
    try {
      result = await withAshbourneBrowser(async (page, config) => {
        await loginToAshbourne(page, config);
        return fetchAshbourneAllMembersCsv(page, config);
      });
    } catch (firstErr) {
      await new Promise((r) => setTimeout(r, 3000));
      result = await withAshbourneBrowser(async (page, config) => {
        await loginToAshbourne(page, config);
        return fetchAshbourneAllMembersCsv(page, config);
      }).catch(() => {
        throw firstErr; // the original error is more informative than a second identical failure
      });
    }

    const ashbourneMs = Date.now() - runStartedAt;
    const dbStartedAt = Date.now();

    outcome.recordsFound = result.members.length;

    // Guards against the one real race concurrent processing introduces:
    // two brand-new (no existing CRM match) rows sharing the same email
    // could, if processed at the exact same moment, both independently see
    // "0 existing matches" and both create separate members instead of one
    // correctly resolving to the other via the email-fallback match — a
    // race that doesn't exist when every record is matched against the DB
    // strictly one at a time. Claiming is synchronous (no await between
    // the check and the add), so it's race-free regardless of concurrency.
    const claimedEmails = new Set<string>();

    async function processRecord(record: AshbourneMember): Promise<void> {
      try {
        if (!record.memberNo) {
          outcome.skipped++;
          return;
        }

        const canonType = canonicalizeMembershipType(record.membershipType ?? null);
        const canonStatus = canonicalizeAshbourneStatus(record.status ?? null);

        const match = await findMatch(record);

        if (match.kind === "review") {
          if (!opts.dryRun) {
            // Best-effort — try to flag the existing member if we can find
            // one by member number, so it surfaces in the Members list.
            await prisma.gymMember
              .updateMany({ where: { memberNumber: record.memberNo }, data: { reviewRequired: true, reviewRequiredReason: match.reason } })
              .catch(() => {});
          }
          outcome.reviewRequired++;
          outcome.sample?.push({ action: "review", memberNo: record.memberNo, name: fullNameOf(record) });
          return;
        }

        if (match.kind === "none") {
          let emailRaceReason: string | null = null;
          if (record.email) {
            const emailKey = record.email.toLowerCase();
            if (claimedEmails.has(emailKey)) {
              emailRaceReason = `email ${record.email} also appears on another new member in this same sync run — not auto-merged`;
            } else {
              claimedEmails.add(emailKey);
            }
          }

          if (opts.dryRun) {
            if (emailRaceReason) {
              outcome.reviewRequired++;
              outcome.sample?.push({ action: "review", memberNo: record.memberNo, name: fullNameOf(record) });
            } else {
              outcome.created++;
              outcome.historyEvents!++; // every brand-new membership is a "joined" event
              if (outcome.sample!.length < 10) outcome.sample!.push({ action: "create", memberNo: record.memberNo, name: fullNameOf(record) });
            }
            return;
          }
          const created = await prisma.gymMember.create({
            data: {
              memberNumber: record.memberNo,
              fullName: fullNameOf(record),
              email: record.email ?? null,
              phone: record.mobile ?? null,
              dob: record.dob ?? null,
              address: record.address ?? null,
              postcode: record.postcode ?? null,
              joinDate: record.joinedDate ?? record.clubInfoDate ?? new Date(),
              ashbourneMemberNo: record.memberNo,
              ashbourneCardNumber: record.cardNo ?? null,
              ashbourneStatus: canonStatus,
              ashbourneMembershipType: canonType,
              ashbourneExpiryDate: record.expiryDate ?? null,
              ashbourneLastSyncedAt: new Date(),
              reviewRequired: !!emailRaceReason,
              reviewRequiredReason: emailRaceReason,
            },
          });
          const { membershipId } = await upsertMembership(created.id, record, canonType, canonStatus, null);
          pendingEvents.push({ membershipId, type: "JOINED", notes: "Ashbourne sync: new member" });
          if (emailRaceReason) outcome.reviewRequired++;
          else outcome.created++;
          return;
        }

        // member-no / member-number / email match — update in place.
        // Concurrent updates to the SAME existing member (e.g. two incoming
        // rows both matching one CRM record via email) are safe at the DB
        // level — Postgres serializes them, last write wins, same semantics
        // sequential processing already had.
        const memberId = match.memberId;
        const existing = await prisma.gymMember.findUniqueOrThrow({
          where: { id: memberId },
          select: {
            email: true,
            phone: true,
            dob: true,
            address: true,
            postcode: true,
            ashbourneMemberNo: true,
            ashbourneCardNumber: true,
            ashbourneStatus: true,
            ashbourneMembershipType: true,
            ashbourneExpiryDate: true,
            memberships: { where: { source: "ASHBOURNE" }, select: { id: true, status: true, renewalDate: true, startDate: true }, take: 1 },
          },
        });
        const existingMembership = existing.memberships[0] ?? null;
        const computedStatus = deriveMembershipStatus({ ashbourneStatus: canonStatus, startDate: record.joinedDate ?? null, endDate: record.expiryDate ?? null });

        const change = classifyMembershipChange({
          isNew: !existingMembership,
          oldStatus: existingMembership?.status ?? null,
          newStatus: computedStatus,
          oldRenewalDate: existingMembership?.renewalDate ?? null,
          newRenewalDate: record.expiryDate ?? null,
          oldType: existing.ashbourneMembershipType,
          newType: canonType,
        });

        const fieldsChanged =
          existing.ashbourneMemberNo !== record.memberNo ||
          (!!record.cardNo && existing.ashbourneCardNumber !== record.cardNo) ||
          existing.ashbourneStatus !== canonStatus ||
          existing.ashbourneMembershipType !== canonType ||
          (existing.ashbourneExpiryDate?.getTime() ?? null) !== (record.expiryDate?.getTime() ?? null) ||
          (!existing.email && !!record.email) ||
          (!existing.phone && !!record.mobile) ||
          (!existing.dob && !!record.dob) ||
          (!existing.address && !!record.address) ||
          (!existing.postcode && !!record.postcode) ||
          !existingMembership ||
          existingMembership.status !== computedStatus ||
          (existingMembership.renewalDate?.getTime() ?? null) !== (record.expiryDate?.getTime() ?? null);

        if (opts.dryRun) {
          if (fieldsChanged) {
            outcome.updated++;
            if (outcome.sample!.length < 10) outcome.sample!.push({ action: "update", memberNo: record.memberNo, name: fullNameOf(record) });
          } else {
            outcome.unchanged++;
          }
          if (change.kind !== "none") outcome.historyEvents!++;
          return;
        }

        await prisma.gymMember.update({
          where: { id: memberId },
          data: {
            ashbourneMemberNo: record.memberNo,
            ashbourneStatus: canonStatus,
            ashbourneMembershipType: canonType,
            ashbourneExpiryDate: record.expiryDate ?? null,
            ashbourneLastSyncedAt: new Date(),
            // Refreshed only when this report row actually has a Card No —
            // a row missing it doesn't blank out a previously-synced value.
            ...(record.cardNo ? { ashbourneCardNumber: record.cardNo } : {}),
            // Fill-only — never overwrite an existing value.
            ...(!existing.email && record.email ? { email: record.email } : {}),
            ...(!existing.phone && record.mobile ? { phone: record.mobile } : {}),
            ...(!existing.dob && record.dob ? { dob: record.dob } : {}),
            ...(!existing.address && record.address ? { address: record.address } : {}),
            ...(!existing.postcode && record.postcode ? { postcode: record.postcode } : {}),
          },
        });
        const { membershipId } = await upsertMembership(memberId, record, canonType, canonStatus, existingMembership?.id ?? null);
        if (change.kind !== "none") {
          pendingEvents.push({ membershipId, type: EVENT_TYPE_BY_CHANGE_KIND[change.kind], notes: change.reason ? `Ashbourne sync: ${change.reason}` : `Ashbourne sync: ${change.kind}` });
        }

        if (fieldsChanged) outcome.updated++;
        else outcome.unchanged++;
      } catch {
        outcome.failed++;
      }
    }

    // Processed in concurrency-limited batches rather than one at a time —
    // each record's own matching + write logic is unchanged (and the one
    // real concurrency hazard, the shared-new-email race, is guarded above),
    // so this is a straightforward latency win: ~2,375 members' worth of
    // sequential DB round-trips was the dominant cost of a sync run, not the
    // Ashbourne scrape itself.
    const CONCURRENCY = 20;
    for (let i = 0; i < result.members.length; i += CONCURRENCY) {
      await Promise.all(result.members.slice(i, i + CONCURRENCY).map(processRecord));
    }

    // The ONE extra query history tracking adds to the whole run, regardless
    // of whether 10 or 2,000 memberships changed — never a write inside the
    // per-record loop.
    if (!opts.dryRun && pendingEvents.length > 0) {
      await prisma.gymMembershipEvent.createMany({ data: pendingEvents });
    }
    if (!opts.dryRun) outcome.historyEvents = pendingEvents.length;

    const dbMs = Date.now() - dbStartedAt;
    outcome.timing = { ashbourneMs, dbMs, totalMs: ashbourneMs + dbMs };
    outcome.success = true;
  } catch (err) {
    const message = err instanceof AshbourneConnectorError ? `[${err.step}] ${err.message}` : err instanceof Error ? err.message : "Unknown Ashbourne sync error";
    outcome.error = message;
    outcome.success = false;
  }

  await prisma.gymAshbourneSyncLog.update({
    where: { id: log.id },
    data: {
      completedAt: new Date(),
      status: outcome.success ? "OK" : "ERROR",
      recordsFound: outcome.recordsFound,
      created: outcome.created,
      updated: outcome.updated,
      unchanged: outcome.unchanged,
      reviewRequired: outcome.reviewRequired,
      skipped: outcome.skipped,
      failed: outcome.failed,
      errorMessage: outcome.error ?? null,
    },
  });

  return outcome;
}

export async function getLatestAshbourneSyncLog() {
  return prisma.gymAshbourneSyncLog.findFirst({ orderBy: { startedAt: "desc" }, where: { dryRun: false } });
}
