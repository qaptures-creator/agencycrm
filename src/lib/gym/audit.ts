import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.gymAuditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}
