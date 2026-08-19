import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Imports Ashbourne "Combined Sales Report" CSV exports — the online
 * sales/signups drilldown (DateTime, InternalID, Name, MemType,
 * InitialPayment, AdminFee, OneOffAmount, Voucher, Total), not the full
 * member roster export the original import used. Reusable: designed to be
 * re-run against later "latest data" drops without duplicating anything.
 *
 * What it does per row:
 *  - Creates the GymMember only if memberNumber (InternalID) doesn't
 *    already exist — never overwrites a richer existing record.
 *  - Creates one ASHBOURNE-sourced GymMembership only if the member
 *    doesn't already have one — never touches an existing membership's
 *    current status.
 *  - Records a GymPayment for the transaction, skipped on re-run via a
 *    stable transactionRef (idempotent).
 */

// Ashbourne has referred to the same rolling-membership product under
// slightly different names across exports ("Rolling Membership" in the
// original roster export, "Monthly Rolling Membership" here) — mapped to
// the existing plan rather than fragmenting reporting across near-
// duplicate plans. Anything not listed here is created as its own plan
// using the exact name from the file.
const PLAN_NAME_ALIASES: Record<string, string> = {
  "Monthly Rolling Membership": "Rolling Membership",
};

export type AshbourneSalesRow = {
  dateTime: string;
  internalId: string;
  name: string;
  memType: string;
  total: number;
};

function parseAshbourneDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmount(s: string | undefined): number {
  const n = parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
}

/** Parses the CSV text, skipping the summary header and footer rows —
 * only the "Online Sales Drilldown" table is meaningful data. */
export function parseAshbourneSalesCsv(text: string): AshbourneSalesRow[] {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.replace(/^﻿/, "").startsWith("DateTime,InternalID"));
  if (headerIdx === -1) {
    throw new Error('Could not find the "DateTime,InternalID,..." header row — is this an Ashbourne sales report export?');
  }

  const headers = lines[headerIdx].replace(/^﻿/, "").split(",");
  const rows: AshbourneSalesRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = line.split(",");
    if (cells.length !== headers.length) continue; // footer/malformed rows

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cells[idx]?.trim() ?? ""));

    const internalId = row["InternalID"];
    const name = row["Name"];
    if (!internalId || !/^\d+$/.test(internalId) || !name) continue; // footer row has no InternalID

    rows.push({
      dateTime: row["DateTime"],
      internalId,
      name,
      memType: row["MemType"],
      total: parseAmount(row["Total"]),
    });
  }

  return rows;
}

export type ImportSummary = {
  totalRows: number;
  membersCreated: number;
  membershipsCreated: number;
  paymentsCreated: number;
  paymentsSkippedExisting: number;
  rowsSkipped: number;
  skippedReasons: string[];
};

export async function importAshbourneSalesReport(rows: AshbourneSalesRow[]): Promise<ImportSummary> {
  const summary: ImportSummary = {
    totalRows: rows.length,
    membersCreated: 0,
    membershipsCreated: 0,
    paymentsCreated: 0,
    paymentsSkippedExisting: 0,
    rowsSkipped: 0,
    skippedReasons: [],
  };

  const planCache = new Map<string, string>(); // plan name -> id

  for (const row of rows) {
    const joinDate = parseAshbourneDate(row.dateTime);
    if (!joinDate) {
      summary.rowsSkipped++;
      summary.skippedReasons.push(`${row.internalId}: unparseable date "${row.dateTime}"`);
      continue;
    }

    // --- Member: create only if missing ---
    // `joinDate` is this row's transaction date, which for Day Pass rows can
    // be a forward-dated/pre-booked visit — a member's join date can never
    // legitimately be in the future, so it's capped at today for the member
    // record itself. The transaction's real date is still used below for the
    // membership/payment records, where it's correct.
    const memberJoinDate = joinDate > new Date() ? new Date() : joinDate;
    let member = await prisma.gymMember.findUnique({ where: { memberNumber: row.internalId } });
    if (!member) {
      member = await prisma.gymMember.create({
        data: { memberNumber: row.internalId, fullName: row.name, joinDate: memberJoinDate },
      });
      summary.membersCreated++;
    }

    // --- Plan: find or create, using the alias map ---
    const planName = PLAN_NAME_ALIASES[row.memType] ?? (row.memType || "Unknown");
    let planId = planCache.get(planName);
    if (!planId) {
      const existingPlan = await prisma.gymMembershipPlan.findFirst({ where: { name: planName } });
      const plan = existingPlan ?? (await prisma.gymMembershipPlan.create({ data: { name: planName, price: row.total, source: "ASHBOURNE" } }));
      planId = plan.id;
      planCache.set(planName, planId);
    }

    // --- Membership: create only if the member has no Ashbourne membership yet ---
    const existingMembership = await prisma.gymMembership.findFirst({
      where: { memberId: member.id, source: "ASHBOURNE" },
    });
    if (!existingMembership) {
      await prisma.gymMembership.create({
        data: {
          memberId: member.id,
          planId,
          startDate: joinDate,
          billingAmount: row.total,
          source: "ASHBOURNE",
        },
      });
      summary.membershipsCreated++;
    }

    // --- Payment: idempotent on transactionRef ---
    const transactionRef = `ashbourne-sale-${row.internalId}`;
    const existingPayment = await prisma.gymPayment.findFirst({ where: { transactionRef } });
    if (existingPayment) {
      summary.paymentsSkippedExisting++;
    } else {
      await prisma.gymPayment.create({
        data: {
          memberId: member.id,
          transactionRef,
          date: joinDate,
          amount: row.total,
          type: row.memType === "Day Pass" ? "DAY_PASS" : "MEMBERSHIP",
          status: "PAID",
          provider: "ASHBOURNE",
        },
      });
      summary.paymentsCreated++;
    }
  }

  return summary;
}
