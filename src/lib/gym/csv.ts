import "server-only";

/** Shared CSV building for every server-side export in the gym CRM — one
 * escaping implementation (commas, quotes, and embedded newlines) rather
 * than each export route reinventing it slightly differently. */
export function escapeCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const line = (cells: (string | number | null)[]) => cells.map((c) => escapeCsvField(c === null ? "" : String(c))).join(",");
  return [line(headers), ...rows.map(line)].join("\r\n");
}

/** A safe, descriptive filename segment from arbitrary label text — lowercased,
 * non-alphanumerics collapsed to single hyphens, trimmed. */
export function slugifyForFilename(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
