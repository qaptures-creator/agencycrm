import "server-only";
import { prisma } from "@/lib/prisma";
import { getAshbourneConfig } from "./config";
import { withAshbourneBrowser } from "./client";
import { loginToAshbourne } from "./auth";
import { fetchAshbourneMembers } from "./reports";
import type { AshbourneMember } from "./types";
import { AshbourneConnectorError } from "./types";

/**
 * Matching (Phase 5): ashbourneMemberNo first, then memberNumber (catches
 * everyone already linked via the existing CSV import, whose memberNumber
 * is Ashbourne's InternalID — see the schema comment on GymMember), then a
 * conservative single-match-only email fallback. Ambiguous or conflicting
 * matches are never auto-merged — they're flagged reviewRequired instead.
 *
 * Field ownership (Phase 6): Ashbourne fields (ashbourneStatus/
 * ashbourneMembershipType/ashbourneExpiryDate/ashbourneLastSyncedAt) are
 * always refreshed on a match. email/phone are filled only if currently
 * empty — never overwritten. fullName/joinDate/notes/address and
 * everything else CRM-owned is left untouched on existing members.
 *
 * ashbourneCardNumber (Card No, added for live-entry matching — distinct
 * from Member No) follows the same Ashbourne-owned rule but only when the
 * report row actually has one: set/refreshed whenever record.cardNo is
 * present, left as-is when a row is missing it rather than blanking out a
 * previously-synced value.
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
};

function fullNameOf(m: AshbourneMember): string {
  return [m.firstName, m.surname].filter(Boolean).join(" ").trim() || m.memberNo;
}

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
    data: { status: "RUNNING", dryRun: opts.dryRun, reportUrl: cfg.memberReportUrl },
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
  };

  try {
    const result = await withAshbourneBrowser(async (page, config) => {
      await loginToAshbourne(page, config);
      return fetchAshbourneMembers(page, config);
    });

    outcome.recordsFound = result.members.length;

    for (const record of result.members) {
      try {
        if (!record.memberNo) {
          outcome.skipped++;
          continue;
        }

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
          continue;
        }

        if (match.kind === "none") {
          if (opts.dryRun) {
            outcome.created++;
            if (outcome.sample!.length < 10) outcome.sample!.push({ action: "create", memberNo: record.memberNo, name: fullNameOf(record) });
            continue;
          }
          await prisma.gymMember.create({
            data: {
              memberNumber: record.memberNo,
              fullName: fullNameOf(record),
              email: record.email ?? null,
              phone: record.mobile ?? null,
              joinDate: record.clubInfoDate ?? new Date(),
              ashbourneMemberNo: record.memberNo,
              ashbourneCardNumber: record.cardNo ?? null,
              ashbourneStatus: record.status ?? null,
              ashbourneMembershipType: record.membershipType ?? null,
              ashbourneExpiryDate: record.expiryDate ?? null,
              ashbourneLastSyncedAt: new Date(),
            },
          });
          outcome.created++;
          continue;
        }

        // member-no / member-number / email match — update in place.
        const memberId = match.memberId;
        const existing = await prisma.gymMember.findUniqueOrThrow({
          where: { id: memberId },
          select: {
            email: true,
            phone: true,
            ashbourneMemberNo: true,
            ashbourneCardNumber: true,
            ashbourneStatus: true,
            ashbourneMembershipType: true,
            ashbourneExpiryDate: true,
          },
        });

        const fieldsChanged =
          existing.ashbourneMemberNo !== record.memberNo ||
          (!!record.cardNo && existing.ashbourneCardNumber !== record.cardNo) ||
          existing.ashbourneStatus !== (record.status ?? null) ||
          existing.ashbourneMembershipType !== (record.membershipType ?? null) ||
          (existing.ashbourneExpiryDate?.getTime() ?? null) !== (record.expiryDate?.getTime() ?? null) ||
          (!existing.email && !!record.email) ||
          (!existing.phone && !!record.mobile);

        if (opts.dryRun) {
          if (fieldsChanged) {
            outcome.updated++;
            if (outcome.sample!.length < 10) outcome.sample!.push({ action: "update", memberNo: record.memberNo, name: fullNameOf(record) });
          } else {
            outcome.unchanged++;
          }
          continue;
        }

        await prisma.gymMember.update({
          where: { id: memberId },
          data: {
            ashbourneMemberNo: record.memberNo,
            ashbourneStatus: record.status ?? null,
            ashbourneMembershipType: record.membershipType ?? null,
            ashbourneExpiryDate: record.expiryDate ?? null,
            ashbourneLastSyncedAt: new Date(),
            // Refreshed only when this report row actually has a Card No —
            // a row missing it doesn't blank out a previously-synced value.
            ...(record.cardNo ? { ashbourneCardNumber: record.cardNo } : {}),
            // Fill-only — never overwrite an existing value.
            ...(!existing.email && record.email ? { email: record.email } : {}),
            ...(!existing.phone && record.mobile ? { phone: record.mobile } : {}),
          },
        });

        if (fieldsChanged) outcome.updated++;
        else outcome.unchanged++;
      } catch {
        outcome.failed++;
      }
    }

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
