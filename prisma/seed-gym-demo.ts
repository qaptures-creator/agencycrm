// Development-only demo data for the Muscle Massacre Gym CRM.
// Never runs in production unless SEED_GYM_DEMO=true is explicitly set.
// Filled in once the core modules exist — see prisma/seed.ts for the guard.
import type { PrismaClient } from "@prisma/client";

export async function seedGymDemoData(prisma: PrismaClient) {
  void prisma;
}
