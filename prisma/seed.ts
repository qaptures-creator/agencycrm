// Seeds only structural/system data — pipeline stages, deliverable statuses,
// and the signed-in team member's own account. No demo leads, clients,
// projects, or financial data are ever created here.
import { PrismaClient } from "@prisma/client";
import { DEFAULT_PIPELINE_STAGES, DEFAULT_DELIVERABLE_STATUSES } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  const stageCount = await prisma.pipelineStage.count();
  if (stageCount === 0) {
    for (let i = 0; i < DEFAULT_PIPELINE_STAGES.length; i++) {
      const stage = DEFAULT_PIPELINE_STAGES[i];
      await prisma.pipelineStage.create({
        data: { ...stage, order: i },
      });
    }
    console.log(`Seeded ${DEFAULT_PIPELINE_STAGES.length} pipeline stages.`);
  }

  const statusCount = await prisma.deliverableStatusOption.count();
  if (statusCount === 0) {
    for (let i = 0; i < DEFAULT_DELIVERABLE_STATUSES.length; i++) {
      const status = DEFAULT_DELIVERABLE_STATUSES[i];
      await prisma.deliverableStatusOption.create({
        data: { ...status, order: i },
      });
    }
    console.log(`Seeded ${DEFAULT_DELIVERABLE_STATUSES.length} deliverable statuses.`);
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await prisma.user.create({
      data: {
        name: "You",
        email: "you@agency.com",
        role: "ADMIN",
        color: "#6366f1",
      },
    });
    console.log("Seeded default team member.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
