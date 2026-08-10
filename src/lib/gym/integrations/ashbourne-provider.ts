import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Contract for Muscle Massacre's membership/payment provider, Ashbourne
 * Membership Management. Ashbourne is the source of truth for membership
 * and financial data once connected — this CRM's Members/Memberships/
 * Finance/Payments UI is built to read through this interface rather than
 * duplicate Ashbourne's data model.
 *
 * No authorised API, export, or webhook integration has been set up yet
 * (no scraping, no reverse-engineered endpoints, no fabricated data — see
 * Settings → Integrations → Ashbourne). Until it is, the CRM's own
 * database (GymMember / GymMembership / GymPayment, entered manually or via
 * CSV import) is the only source of truth, and it's clearly a manual
 * fallback rather than a live sync.
 *
 * Implement this interface (e.g. AshbourneApiProvider) once Ashbourne
 * documentation or credentials are available, and swap it in via
 * getMembershipProvider() below.
 */
export interface MembershipProvider {
  getMembers(): Promise<unknown[]>;
  getMemberships(): Promise<unknown[]>;
  getTransactions(params: { since?: Date }): Promise<unknown[]>;
  getFailedPayments(): Promise<unknown[]>;
  getRevenueSummary(params: { from: Date; to: Date }): Promise<{ total: number }>;
}

export async function isAshbourneConnected(): Promise<boolean> {
  const integration = await prisma.gymIntegration.findUnique({ where: { provider: "ASHBOURNE" } });
  return integration?.status === "CONNECTED";
}

/** Returns null until Ashbourne is genuinely connected — never fabricate a provider. */
export async function getMembershipProvider(): Promise<MembershipProvider | null> {
  const connected = await isAshbourneConnected();
  if (!connected) return null;
  throw new Error("No AshbourneMembershipProvider implementation is registered yet.");
}
