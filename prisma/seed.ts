// Seeds only structural/system data — pipeline stages, deliverable statuses,
// and the signed-in team member's own account. No demo leads, clients,
// projects, or financial data are ever created here.
import { PrismaClient } from "@prisma/client";
import { DEFAULT_PIPELINE_STAGES, DEFAULT_DELIVERABLE_STATUSES } from "../src/lib/constants";
import { DEFAULT_CLEANING_ZONES } from "../src/lib/gym/constants";
import { hashPassword } from "../src/lib/gym/password";
import { seedGymDemoData } from "./seed-gym-demo";

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

  // ---------------------------------------------------------------------
  // Muscle Massacre — Gym CRM: structural bootstrap (always runs, idempotent)
  // ---------------------------------------------------------------------

  await prisma.gymSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  const zoneCount = await prisma.gymCleaningZone.count();
  if (zoneCount === 0) {
    for (let i = 0; i < DEFAULT_CLEANING_ZONES.length; i++) {
      await prisma.gymCleaningZone.create({ data: { name: DEFAULT_CLEANING_ZONES[i], order: i } });
    }
    console.log(`Seeded ${DEFAULT_CLEANING_ZONES.length} cleaning zones.`);
  }

  for (const provider of ["EMAIL", "ASHBOURNE", "WEBSITE", "GOOGLE_CALENDAR", "META"]) {
    await prisma.gymIntegration.upsert({
      where: { provider },
      create: { provider, status: "NOT_CONNECTED" },
      update: {},
    });
  }

  const gymUserCount = await prisma.gymUser.count();
  if (gymUserCount === 0) {
    const email = (process.env.GYM_OWNER_EMAIL || "admin@musclemassacre.com").toLowerCase();
    const name = process.env.GYM_OWNER_NAME || "Gym Owner";
    const password = process.env.GYM_OWNER_PASSWORD || "MuscleMassacre1!";

    const owner = await prisma.gymUser.create({
      data: {
        name,
        email,
        accessRole: "OWNER",
        passwordHash: hashPassword(password),
        mustResetPassword: !process.env.GYM_OWNER_PASSWORD,
        staff: {
          create: { fullName: name, email, position: "Owner", employmentStatus: "Active" },
        },
      },
    });

    console.log("─".repeat(60));
    console.log("Muscle Massacre — bootstrap Owner account created:");
    console.log(`  email:    ${owner.email}`);
    if (!process.env.GYM_OWNER_PASSWORD) {
      console.log(`  password: ${password}  (change GYM_OWNER_PASSWORD env var for production)`);
    } else {
      console.log("  password: set from GYM_OWNER_PASSWORD env var");
    }
    console.log("─".repeat(60));
  }

  // Demo data requires an explicit opt-in (never inferred from NODE_ENV,
  // which isn't reliably set for a one-off `tsx` process on every platform)
  // so a misconfigured production deploy can never end up with fabricated
  // staff/members/revenue in it.
  if (process.env.SEED_GYM_DEMO === "true") {
    await seedGymDemoData(prisma);
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
