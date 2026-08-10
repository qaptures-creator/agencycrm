import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/gym/password";

export const SESSION_COOKIE = "mm_session";
const SESSION_DAYS = 14;

export async function createGymSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.gymSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyGymSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.gymSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function getGymSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.gymSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { staff: true } } },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }

  return session.user;
}
