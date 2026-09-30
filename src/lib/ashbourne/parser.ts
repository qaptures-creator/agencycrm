import type { AshbourneMember } from "./types";

/**
 * Pure parsing logic — no browser/network dependency, so it can be tested
 * in isolation against sample data. Maps whatever column headers Ashbourne
 * actually uses to our normalized AshbourneMember shape via flexible
 * case-insensitive matching, since we don't yet know the exact header text
 * for every report.
 */

const HEADER_ALIASES: Record<keyof AshbourneMember, RegExp> = {
  memberNo: /^member\s*no\.?$|^member\s*number$|^internal\s*id$/i,
  cardNo: /^card\s*no\.?$|^card\s*number$/i,
  firstName: /^first\s*name$|^forename$/i,
  surname: /^surname$|^last\s*name$/i,
  email: /^e-?mail$/i,
  mobile: /^mobile$|^phone$|^telephone$/i,
  clubInfoDate: /^club\s*info\s*date$/i,
  status: /^status$|^member\s*status$/i,
  membershipType: /^membership\s*type$|^mem\s*type$|^plan$/i,
  // Ashbourne's "All Members" export uses "Expire Date", distinct from the
  // "Expiry Date"/"Renewal Date" aliases from the older report guess.
  expiryDate: /^expiry\s*date$|^expire\s*date$|^expires?$|^renewal\s*date$/i,
  joinedDate: /^joined\s*date$/i,
  lastPayDate: /^last\s*pay\s*date$/i,
  periodPayment: /^period\s*payment$/i,
  postcode: /^post\s*code$/i,
  dob: /^dob$|^date\s*of\s*birth$/i,
  address: /^address$/i,
};

/** Builds a column-index map from a header row — e.g. { memberNo: 0,
 * firstName: 2, ... } — skipping any field whose header wasn't found. */
export function mapHeaders(headers: string[]): Partial<Record<keyof AshbourneMember, number>> {
  const map: Partial<Record<keyof AshbourneMember, number>> = {};
  for (const [field, pattern] of Object.entries(HEADER_ALIASES) as [keyof AshbourneMember, RegExp][]) {
    const idx = headers.findIndex((h) => pattern.test(h.trim()));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

/** Ashbourne dates are expected as dd/mm/yyyy (UK format, consistent with
 * the existing sales-report CSV import) — falls back to null for anything
 * that doesn't parse cleanly rather than guessing.
 *
 * "Expire Date" in the All Members export uses "01/01/1900" as a sentinel
 * for "no real end date" (rolling memberships with no fixed term) — a
 * genuine 1900 date never occurs in a live gym's data, so any year before
 * 1950 is treated as null rather than a real (and very wrong) expiry, which
 * would otherwise make date-derived status logic mark an indefinite/rolling
 * membership as EXPIRED. */
function parseAshbourneDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  if (+yyyy < 1950) return null;
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

function cell(row: string[], map: Partial<Record<keyof AshbourneMember, number>>, field: keyof AshbourneMember): string | undefined {
  const idx = map[field];
  if (idx === undefined) return undefined;
  const v = row[idx]?.trim();
  return v ? v : undefined;
}

/** Ashbourne renders money as a plain decimal string ("40.9900") — falls
 * back to null rather than 0 so "no payment amount in this row" is never
 * confused with "a genuine £0 payment". */
function parseAshbourneAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** Converts parsed table rows (header row already consumed) into
 * normalized AshbourneMember records. Rows with no memberNo are dropped —
 * they're not real member records (footer/summary rows, blank rows). */
export function rowsToMembers(rows: string[][], headers: string[]): AshbourneMember[] {
  const map = mapHeaders(headers);
  const members: AshbourneMember[] = [];

  for (const row of rows) {
    const memberNo = cell(row, map, "memberNo");
    if (!memberNo) continue;

    members.push({
      memberNo,
      cardNo: cell(row, map, "cardNo"),
      firstName: cell(row, map, "firstName"),
      surname: cell(row, map, "surname"),
      email: cell(row, map, "email")?.toLowerCase(),
      mobile: cell(row, map, "mobile"),
      clubInfoDate: parseAshbourneDate(cell(row, map, "clubInfoDate")),
      status: cell(row, map, "status"),
      membershipType: cell(row, map, "membershipType"),
      expiryDate: parseAshbourneDate(cell(row, map, "expiryDate")),
      joinedDate: parseAshbourneDate(cell(row, map, "joinedDate")),
      lastPayDate: parseAshbourneDate(cell(row, map, "lastPayDate")),
      periodPayment: parseAshbourneAmount(cell(row, map, "periodPayment")),
      postcode: cell(row, map, "postcode"),
      dob: parseAshbourneDate(cell(row, map, "dob")),
      address: cell(row, map, "address"),
    });
  }

  return members;
}

/** Minimal CSV line splitter matching the convention already used by
 * ashbourne-sales-import.ts — no embedded-comma/quote handling beyond
 * simple double-quote wrapping, since that's what Ashbourne's own exports
 * have used so far. */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function parseCsvExport(text: string): AshbourneMember[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return rowsToMembers(rows, headers);
}
