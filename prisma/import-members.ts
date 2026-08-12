// One-time import: loads real members from the Ashbourne CSV export into
// GymMember + GymMembership, replacing the leftover demo GymMembershipPlan
// catalog with plan types derived from the actual data.
//
// Reads prisma/import-data/members.csv.gz, which is committed only for the
// duration of this one-off run and removed immediately after (see the
// commit history around this file) — it's real member PII, not something
// to leave sitting in the working tree. Safe to re-run: members are
// upserted by memberNumber, and a member's existing ASHBOURNE-sourced
// membership is updated in place rather than duplicated.
//
// Deliberately NOT wired into the normal start command — see railway.json.
import { PrismaClient } from "@prisma/client";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

const PLACEHOLDER_PLAN_NAMES = ["Off-Peak", "Full Access", "Full Access + PT", "Annual Full Access"];

const PLAN_DEFS: Record<string, { price: number; billingFrequency: string; contractLengthMonths?: number }> = {
  "Day Pass": { price: 15.99, billingFrequency: "MONTHLY" },
  "Rolling Membership": { price: 55.99, billingFrequency: "MONTHLY" },
  "12 Month Contract": { price: 44.99, billingFrequency: "MONTHLY", contractLengthMonths: 12 },
  "Presale Membership": { price: 40.99, billingFrequency: "MONTHLY" },
  "Cash Membership Temp": { price: 0, billingFrequency: "MONTHLY" },
  "Cash Membership - Day Pass": { price: 0, billingFrequency: "MONTHLY" },
};

const STATUS_MAP: Record<string, string> = {
  Live: "ACTIVE",
  New: "ACTIVE",
  "Paid in Full": "ACTIVE",
  Complete: "EXPIRED",
  Expired: "EXPIRED",
  Defaulter: "OVERDUE",
  "DD Hold": "FROZEN",
};

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  if (dd === "01" && mm === "01" && yyyy === "1900") return null; // Ashbourne's "unknown date" placeholder
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmount(s: string | undefined): number {
  const n = parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines[0].replace(/^﻿/, "").split(",");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (cells.length !== headers.length) {
      console.warn(`Skipping malformed row ${i + 1}: expected ${headers.length} fields, got ${cells.length}`);
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cells[idx].trim()));
    rows.push(row);
  }
  return rows;
}

async function main() {
  const gzPath = join(process.cwd(), "prisma/import-data/members.csv.gz");
  const csvText = gunzipSync(readFileSync(gzPath)).toString("utf-8");
  const rows = parseCsv(csvText);
  console.log(`Parsed ${rows.length} member rows from CSV.`);

  await prisma.gymMembershipPlan.deleteMany({ where: { name: { in: PLACEHOLDER_PLAN_NAMES } } });
  console.log(`Removed placeholder demo plans: ${PLACEHOLDER_PLAN_NAMES.join(", ")}`);

  const planIdByName: Record<string, string> = {};
  for (const [name, def] of Object.entries(PLAN_DEFS)) {
    let plan = await prisma.gymMembershipPlan.findFirst({ where: { name } });
    if (!plan) {
      plan = await prisma.gymMembershipPlan.create({
        data: { name, source: "ASHBOURNE", ...def },
      });
    }
    planIdByName[name] = plan.id;
  }
  console.log(`Plan catalog ready: ${Object.keys(planIdByName).join(", ")}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const memberNumber = row["Member No"];
    if (!memberNumber) {
      skipped++;
      continue;
    }

    const firstName = row["First Name"] || "";
    const surname = row["Surname"] || "";
    const knownAs = row["KnownAs"];
    let fullName = `${firstName} ${surname}`.trim();
    if (knownAs && knownAs !== firstName) fullName += ` (${knownAs})`;
    if (!fullName) fullName = `Member ${memberNumber}`;

    const email = row["Email"] ? row["Email"].toLowerCase() : null;
    const mobile = row["Mobile"];
    const phoneNo = row["Phone No"];
    const phone = mobile || (phoneNo && phoneNo !== "0000" ? phoneNo : null) || null;

    const address = row["Address"] ? `${row["Address"]}${row["Postcode"] ? ", " + row["Postcode"] : ""}` : null;

    const noteParts: string[] = [];
    if (row["Notes"]) noteParts.push(row["Notes"]);
    if (row["Club Info"]) noteParts.push(`Club Info: ${row["Club Info"]}`);
    if (row["Alert"]) noteParts.push(`Alert: ${row["Alert"]}`);
    const notes = noteParts.length ? noteParts.join("\n") : null;

    const joinDate = parseDate(row["Joined date"]) || parseDate(row["Timestamp"]) || new Date();

    const member = await prisma.gymMember.upsert({
      where: { memberNumber },
      create: {
        memberNumber,
        fullName,
        email,
        phone,
        dob: parseDate(row["DOB"]),
        address,
        joinDate,
        lastVisitAt: parseDate(row["LastVisit"]),
        notes,
      },
      update: {
        fullName,
        email,
        phone,
        dob: parseDate(row["DOB"]),
        address,
        joinDate,
        lastVisitAt: parseDate(row["LastVisit"]),
        notes,
      },
    });

    const memType = row["Mem Type"];
    const planId = planIdByName[memType];
    if (!planId) {
      console.warn(`Unknown Mem Type "${memType}" for member ${memberNumber}, skipping membership.`);
      skipped++;
      continue;
    }

    const status = STATUS_MAP[row["Status"]] ?? "ACTIVE";
    const billingAmount = parseAmount(row["Period Payment"]) || parseAmount(row["InitialPayment"]);
    const membershipData = {
      planId,
      status,
      billingAmount,
      paymentFrequency: PLAN_DEFS[memType].billingFrequency,
      paymentStatus: status === "OVERDUE" ? "OVERDUE" : "CURRENT",
      startDate: joinDate,
      renewalDate: parseDate(row["Expire Date"]),
      source: "ASHBOURNE",
    };

    const existingMembership = await prisma.gymMembership.findFirst({
      where: { memberId: member.id, source: "ASHBOURNE" },
    });

    if (existingMembership) {
      await prisma.gymMembership.update({ where: { id: existingMembership.id }, data: membershipData });
      updated++;
    } else {
      await prisma.gymMembership.create({ data: { ...membershipData, memberId: member.id } });
      created++;
    }

    const total = created + updated;
    if (total % 250 === 0) console.log(`...${total} memberships processed`);
  }

  console.log("─".repeat(60));
  console.log(`Member import complete: ${created} memberships created, ${updated} updated, ${skipped} rows skipped.`);
  console.log("─".repeat(60));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
