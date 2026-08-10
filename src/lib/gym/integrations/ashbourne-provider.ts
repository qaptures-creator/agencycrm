import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Contract for connecting to Ashbourne Membership Management — the gym's real
 * membership/payment system. There is currently NO authorised API/export/
 * webhook access to Ashbourne. Nothing in this codebase should ever fabricate
 * a connection, invented members, or invented revenue.
 *
 * All Members/Memberships/Finance/Payments pages read only from this CRM's
 * own database (GymMember, GymMembership, GymPayment), populated by real
 * manual entry (or later, CSV import, or later still, a genuine Ashbourne
 * sync). When credentials/API access become available, implement this
 * interface (e.g. AshbourneApiProvider) and swap it in via
 * getMembershipProvider() below.
 */
export interface MembershipProvider {
  listMembers(params?: { since?: Date }): Promise<AshbourneMemberRecord[]>;
  listPayments(params?: { since?: Date }): Promise<AshbournePaymentRecord[]>;
  syncMember(memberId: string): Promise<void>;
}

export type AshbourneMemberRecord = {
  externalId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  planName: string | null;
  status: string;
};

export type AshbournePaymentRecord = {
  externalId: string;
  memberExternalId: string;
  amount: number;
  date: Date;
  status: string;
};

export async function isAshbourneConnected(): Promise<boolean> {
  const integration = await prisma.gymIntegration.findUnique({ where: { provider: "ASHBOURNE" } });
  return integration?.status === "CONNECTED";
}

/** Returns null until a real provider is connected — callers must handle the
 * "Not Connected" state (showing manually-entered data only) rather than
 * assuming a provider always exists. */
export async function getMembershipProvider(): Promise<MembershipProvider | null> {
  const connected = await isAshbourneConnected();
  if (!connected) return null;
  throw new Error("No MembershipProvider implementation is registered yet.");
}
