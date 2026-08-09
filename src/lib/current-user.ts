import { prisma } from "@/lib/prisma";

/** No auth system — the CRM is single-tenant, so we treat the first-created
 * user (seeded as "You") as the acting team member for defaults/attribution. */
export async function getCurrentUser() {
  let user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    user = await prisma.user.create({
      data: { name: "You", email: "you@agency.com", role: "ADMIN" },
    });
  }
  return user;
}
