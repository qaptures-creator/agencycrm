"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentGymUser } from "@/lib/gym/auth";

const PAGE_SIZE = 50;

export async function loadAuditLogPageAction(skip: number) {
  const user = await getCurrentGymUser();
  if (!user || user.accessRole !== "OWNER") {
    throw new Error("Only the Owner can view the audit log");
  }

  const rows = await prisma.gymAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
    skip,
    take: PAGE_SIZE,
  });

  return {
    rows,
    hasMore: rows.length === PAGE_SIZE,
  };
}
