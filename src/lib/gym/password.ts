import { randomBytes, scryptSync, timingSafeEqual, randomUUID, createHash } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  if (candidate.length !== hashBuffer.length) return false;
  return timingSafeEqual(candidate, hashBuffer);
}

/** Human-typeable one-time password for manager-issued staff accounts / resets. */
export function generateTempPassword(): string {
  const words = ["IRON", "FORGE", "GRIND", "STEEL", "POWER", "BEAST", "PLATE", "CHALK"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${word}${digits}`;
}

/** SHA-256 (not scrypt) — session/reset tokens are already high-entropy random
 * values, so a fast hash is fine and avoids scrypt's CPU cost on every request. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}
