"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createStage(name: string, color = "#6366f1") {
  const maxOrder = await prisma.pipelineStage.aggregate({ _max: { order: true } });
  const stage = await prisma.pipelineStage.create({
    data: { name, color, order: (maxOrder._max.order ?? -1) + 1 },
  });
  revalidatePath("/crm");
  revalidatePath("/settings");
  return stage;
}

export async function updateStage(
  id: string,
  data: { name?: string; color?: string; isWon?: boolean; isLost?: boolean }
) {
  const stage = await prisma.pipelineStage.update({ where: { id }, data });
  revalidatePath("/crm");
  revalidatePath("/settings");
  return stage;
}

export async function deleteStage(id: string, fallbackStageId?: string) {
  const leadCount = await prisma.lead.count({ where: { stageId: id } });

  if (leadCount > 0) {
    if (!fallbackStageId) {
      throw new Error(
        `This stage has ${leadCount} lead(s). Choose a stage to move them to before deleting.`
      );
    }
    await prisma.lead.updateMany({ where: { stageId: id }, data: { stageId: fallbackStageId } });
  }

  await prisma.pipelineStage.delete({ where: { id } });
  revalidatePath("/crm");
  revalidatePath("/settings");
}

export async function reorderStages(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.pipelineStage.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath("/crm");
  revalidatePath("/settings");
}
