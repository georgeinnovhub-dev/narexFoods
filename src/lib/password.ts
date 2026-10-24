import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Scrypt-based password hashing (no external dependency).
 * Format: scrypt$<saltHex>$<hashHex>
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = scryptSync(password, salt, 64);
    return timingSafeEqual(salt.length ? actual : actual, expected);
  } catch {
    return false;
  }
}

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}
