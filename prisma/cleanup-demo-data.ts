// One-time cleanup: removes all demo/seeded gym-CRM records so the real
// gym can start entering its own data, while preserving:
//   - every GymUser with accessRole "OWNER" (and their GymStaff profile)
//   - GymSettings, GymIntegration (structural config)
//   - GymMembershipPlan (kept as reusable templates, per request)
//
// This is intentionally NOT wired into the normal start command — it must
// only ever be run once, deliberately, never on a routine deploy (it would
// delete real member/business data added after this run).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owners = await prisma.gymUser.findMany({ where: { accessRole: "OWNER" }, select: { id: true } });
  const ownerIds = owners.map((o) => o.id);
  if (ownerIds.length === 0) {
    throw new Error("Refusing to run: no GymUser with accessRole OWNER found — this would delete every login.");
  }

  console.log(`Preserving ${ownerIds.length} owner account(s):`, ownerIds);

  const nonOwnerUsers = await prisma.gymUser.findMany({
    where: { accessRole: { not: "OWNER" } },
    select: { id: true },
  });
  const nonOwnerUserIds = nonOwnerUsers.map((u) => u.id);

  const nonOwnerStaff = await prisma.gymStaff.findMany({
    where: { OR: [{ userId: null }, { userId: { in: nonOwnerUserIds } }] },
    select: { id: true },
  });
  const nonOwnerStaffIds = nonOwnerStaff.map((s) => s.id);

  await prisma.$transaction([
    prisma.gymAttachment.deleteMany({}),
    prisma.gymTaskComment.deleteMany({}),
    prisma.gymNotification.deleteMany({}),
    prisma.gymAuditLog.deleteMany({}),
    prisma.gymInventoryTransaction.deleteMany({}),
    prisma.gymAttendance.deleteMany({}),
    prisma.gymMemberNote.deleteMany({}),
    prisma.gymMembershipEvent.deleteMany({}),
    prisma.gymEnquiryMessage.deleteMany({}),
    prisma.gymLeadActivity.deleteMany({}),
    prisma.gymTask.deleteMany({}),
    prisma.gymRotaShift.deleteMany({}),
    prisma.gymPayment.deleteMany({}),
    prisma.gymMembership.deleteMany({}),
    prisma.gymEnquiry.deleteMany({}),
    prisma.gymLead.deleteMany({}),
    prisma.gymMaintenanceTicket.deleteMany({}),
    prisma.gymEquipment.deleteMany({}),
    prisma.gymIncident.deleteMany({}),
    prisma.gymShakeBarProduct.deleteMany({}),
    prisma.gymMarketingContent.deleteMany({}),
    prisma.gymMarketingCampaign.deleteMany({}),
    prisma.gymAnnouncement.deleteMany({}),
    prisma.gymMember.deleteMany({}),
    prisma.gymSession.deleteMany({ where: { userId: { in: nonOwnerUserIds } } }),
    prisma.gymPasswordResetToken.deleteMany({ where: { userId: { in: nonOwnerUserIds } } }),
    prisma.gymStaff.deleteMany({ where: { id: { in: nonOwnerStaffIds } } }),
    prisma.gymUser.deleteMany({ where: { id: { in: nonOwnerUserIds } } }),
  ]);

  console.log("Demo data cleanup complete.");
  console.log("Preserved: owner login(s), GymSettings, GymIntegration rows, GymMembershipPlan catalog.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
