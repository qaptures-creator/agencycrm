import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getEmailConfig, type EmailConfig } from "./config";

/** Server-only SMTP transport for outgoing mail. Every function here must
 * only ever be called from server code — see config.ts for why. */

function redact(message: string, cfg: EmailConfig): string {
  return cfg.password ? message.split(cfg.password).join("[redacted]") : message;
}

export function getSmtpTransport(): Transporter {
  const cfg = getEmailConfig();
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.username, pass: cfg.password },
  });
}

/** Verifies SMTP auth without sending anything. */
export async function testSmtpConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = getEmailConfig();
  const transport = getSmtpTransport();
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error";
    return { ok: false, error: redact(message, cfg) };
  } finally {
    transport.close();
  }
}
