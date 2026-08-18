import "server-only";

/**
 * Reads the mailbox connection settings from Railway env vars. Never logs or
 * returns the password/username in full — see getEmailDiagnosticEnvSummary()
 * for the only safe, redacted view of this config.
 *
 * Mirrors the pattern in src/lib/gym/integrations/goodtill-client.ts: a
 * readEnv() that throws EmailNotConfiguredError listing exactly which var
 * names are missing, so callers (and the diagnostic UI) can say precisely
 * what's absent without ever touching a real value.
 */

export class EmailNotConfiguredError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`Mailbox is not configured — missing env var(s): ${missing.join(", ")}`);
    this.name = "EmailNotConfiguredError";
    this.missing = missing;
  }
}

export type EmailConfig = {
  address: string;
  username: string;
  password: string;
  fromName: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  syncEnabled: boolean;
};

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === "") return fallback;
  return v.trim().toLowerCase() === "true" || v.trim() === "1";
}

function parsePort(v: string | undefined, fallback: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Throws EmailNotConfiguredError listing every missing var name if the
 * mailbox isn't fully configured. */
export function getEmailConfig(): EmailConfig {
  const address = process.env.GYM_EMAIL_ADDRESS;
  const username = process.env.GYM_EMAIL_USERNAME || address;
  const password = process.env.GYM_EMAIL_PASSWORD;
  const imapHost = process.env.GYM_EMAIL_IMAP_HOST;
  const smtpHost = process.env.GYM_EMAIL_SMTP_HOST;

  const missing: string[] = [];
  if (!address) missing.push("GYM_EMAIL_ADDRESS");
  if (!password) missing.push("GYM_EMAIL_PASSWORD");
  if (!imapHost) missing.push("GYM_EMAIL_IMAP_HOST");
  if (!smtpHost) missing.push("GYM_EMAIL_SMTP_HOST");
  if (missing.length > 0) throw new EmailNotConfiguredError(missing);

  return {
    address: address!,
    username: username!,
    password: password!,
    fromName: process.env.GYM_EMAIL_FROM_NAME || "Muscle Massacre",
    imapHost: imapHost!,
    imapPort: parsePort(process.env.GYM_EMAIL_IMAP_PORT, 993),
    imapSecure: parseBool(process.env.GYM_EMAIL_IMAP_SECURE, true),
    smtpHost: smtpHost!,
    smtpPort: parsePort(process.env.GYM_EMAIL_SMTP_PORT, 465),
    smtpSecure: parseBool(process.env.GYM_EMAIL_SMTP_SECURE, true),
    syncEnabled: parseBool(process.env.GYM_EMAIL_SYNC_ENABLED, true),
  };
}

export function isEmailConfigured(): boolean {
  try {
    getEmailConfig();
    return true;
  } catch {
    return false;
  }
}

function maskAddress(address: string): string {
  const [local, domain] = address.split("@");
  if (!domain) return "***";
  const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : "***";
  return `${maskedLocal}@${domain}`;
}

/** Non-secret summary for the diagnostic UI: hosts/ports/masked address —
 * never the username in full, and never the password. */
export function getEmailDiagnosticEnvSummary():
  | {
      configured: true;
      addressPreview: string;
      fromName: string;
      imapHost: string;
      imapPort: number;
      imapSecure: boolean;
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      syncEnabled: boolean;
    }
  | { configured: false; missing: string[] } {
  try {
    const cfg = getEmailConfig();
    return {
      configured: true,
      addressPreview: maskAddress(cfg.address),
      fromName: cfg.fromName,
      imapHost: cfg.imapHost,
      imapPort: cfg.imapPort,
      imapSecure: cfg.imapSecure,
      smtpHost: cfg.smtpHost,
      smtpPort: cfg.smtpPort,
      smtpSecure: cfg.smtpSecure,
      syncEnabled: cfg.syncEnabled,
    };
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) return { configured: false, missing: err.missing };
    return { configured: false, missing: ["unknown"] };
  }
}
