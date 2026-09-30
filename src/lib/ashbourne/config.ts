import "server-only";

/**
 * Reads Ashbourne BI connection settings from Railway env vars. Mirrors the
 * pattern in src/lib/gym/integrations/goodtill-client.ts and
 * src/lib/email/config.ts: readEnv() throws a typed error listing exactly
 * which var names are missing, never the values.
 */

export class AshbourneNotConfiguredError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`Ashbourne BI is not configured — missing env var(s): ${missing.join(", ")}`);
    this.name = "AshbourneNotConfiguredError";
    this.missing = missing;
  }
}

export type AshbourneConfig = {
  baseUrl: string;
  clubId: string;
  username: string;
  password: string;
  memberReportUrl: string;
  /** The "All Members" report — the only one with Status/Membership
   * Type/Expiry Date columns (memberReportUrl above lacks all three).
   * Defaults to the standard report id (1) under baseUrl; overridable via
   * ASHBOURNE_ALL_MEMBERS_REPORT_URL since this report's id is a Muscle
   * Massacre / Ashbourne install detail, not something every gym using
   * this CRM as a template is guaranteed to share. */
  allMembersReportUrl: string;
  syncEnabled: boolean;
};

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === "") return fallback;
  return v.trim().toLowerCase() === "true" || v.trim() === "1";
}

export function getAshbourneConfig(): AshbourneConfig {
  const baseUrl = process.env.ASHBOURNE_BASE_URL;
  const clubId = process.env.ASHBOURNE_CLUB_ID;
  const username = process.env.ASHBOURNE_USERNAME;
  const password = process.env.ASHBOURNE_PASSWORD;
  const memberReportUrl = process.env.ASHBOURNE_MEMBER_REPORT_URL;

  const missing: string[] = [];
  if (!baseUrl) missing.push("ASHBOURNE_BASE_URL");
  if (!clubId) missing.push("ASHBOURNE_CLUB_ID");
  if (!username) missing.push("ASHBOURNE_USERNAME");
  if (!password) missing.push("ASHBOURNE_PASSWORD");
  if (!memberReportUrl) missing.push("ASHBOURNE_MEMBER_REPORT_URL");
  if (missing.length > 0) throw new AshbourneNotConfiguredError(missing);

  const normalizedBaseUrl = baseUrl!.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    clubId: clubId!,
    username: username!,
    password: password!,
    memberReportUrl: memberReportUrl!,
    allMembersReportUrl: process.env.ASHBOURNE_ALL_MEMBERS_REPORT_URL || `${normalizedBaseUrl}/bi/dashboard/reports/reportmembership.aspx?id=1`,
    syncEnabled: parseBool(process.env.ASHBOURNE_SYNC_ENABLED, true),
  };
}

export function isAshbourneConfigured(): boolean {
  try {
    getAshbourneConfig();
    return true;
  } catch {
    return false;
  }
}

export function getAshbourneDiagnosticEnvSummary():
  | { configured: true; baseUrl: string; usernamePreview: string; memberReportUrl: string; syncEnabled: boolean }
  | { configured: false; missing: string[] } {
  try {
    const cfg = getAshbourneConfig();
    const usernamePreview = cfg.username.length > 3 ? `${cfg.username.slice(0, 2)}***` : "***";
    return { configured: true, baseUrl: cfg.baseUrl, usernamePreview, memberReportUrl: cfg.memberReportUrl, syncEnabled: cfg.syncEnabled };
  } catch (err) {
    if (err instanceof AshbourneNotConfiguredError) return { configured: false, missing: err.missing };
    return { configured: false, missing: ["unknown"] };
  }
}
