// Development-only demo data for the Muscle Massacre Gym CRM.
// Guarded in prisma/seed.ts: only runs when NODE_ENV !== "production", or
// when SEED_GYM_DEMO=true is explicitly set. Never runs against a real
// production database by default. Every figure here is fabricated sample
// data for demoing the interface — none of it should ever be mistaken for
// real Ashbourne, member, or financial data (Finance/Payments/Memberships
// pages make that distinction explicit in their empty/connected states).
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/gym/password";

function daysFromNow(days: number, hours = 0, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function mondayOfThisWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function seedGymDemoData(prisma: PrismaClient) {
  // GymMember rows are only ever created by this demo seed or real member
  // entry — unlike GymStaff, which already has one row for the bootstrap
  // Owner account by the time this runs, so that's not a safe "already
  // seeded" signal.
  const alreadySeeded = await prisma.gymMember.count();
  if (alreadySeeded > 0) return;

  console.log("Seeding Muscle Massacre demo data (development only)...");

  // --- Staff -----------------------------------------------------------
  const staffDefs = [
    { fullName: "Priya Shah", position: "Manager", employmentStatus: "Active", accessRole: "MANAGER" as const, email: "priya@musclemassacre.com" },
    { fullName: "Jordan Reyes", position: "Reception", employmentStatus: "Active", accessRole: "STAFF" as const, email: "jordan@musclemassacre.com" },
    { fullName: "Marcus Webb", position: "Coach / PT", employmentStatus: "Active", accessRole: "STAFF" as const, email: "marcus@musclemassacre.com" },
    { fullName: "Ellie Novak", position: "Gym Floor Staff", employmentStatus: "Part-Time", accessRole: "STAFF" as const, email: "ellie@musclemassacre.com" },
    { fullName: "Sam Okafor", position: "Cleaner", employmentStatus: "Part-Time", accessRole: "STAFF" as const, email: "sam@musclemassacre.com" },
    { fullName: "Devon Blake", position: "Shake Bar", employmentStatus: "Casual", accessRole: "STAFF" as const, email: "devon@musclemassacre.com" },
    { fullName: "Nat Ahmed", position: "Marketing", employmentStatus: "Active", accessRole: "MARKETING" as const, email: "nat@musclemassacre.com" },
  ];

  const staff = [];
  for (const def of staffDefs) {
    const s = await prisma.gymStaff.create({
      data: {
        fullName: def.fullName,
        position: def.position,
        employmentStatus: def.employmentStatus,
        email: def.email,
        phone: "07700 900" + Math.floor(100 + Math.random() * 900),
        startDate: daysFromNow(-Math.floor(30 + Math.random() * 700)),
        typicalHours: "Mon–Fri, 9am–5pm",
        user: {
          create: {
            name: def.fullName,
            email: def.email,
            accessRole: def.accessRole,
            passwordHash: hashPassword("Password123!"),
          },
        },
      },
    });
    staff.push(s);
  }
  const [manager, reception, coach, floor, cleaner, shakeBarStaff, nat] = staff;

  // --- Rota (this week + next) ------------------------------------------
  const monday = mondayOfThisWeek();
  const rotaStaff = [reception, coach, floor, cleaner, shakeBarStaff];
  for (let week = 0; week < 2; week++) {
    for (let day = 0; day < 6; day++) {
      const date = new Date(monday);
      date.setDate(date.getDate() + week * 7 + day);
      for (const member of rotaStaff.filter(() => Math.random() > 0.3)) {
        const start = new Date(date);
        start.setHours(day % 2 === 0 ? 6 : 12, 0, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + 8);
        await prisma.gymRotaShift.create({
          data: {
            staffId: member.id,
            date,
            startTime: start,
            endTime: end,
            breakMinutes: 30,
            published: week === 0,
          },
        });
      }
    }
  }

  // --- Tasks -------------------------------------------------------------
  const taskDefs = [
    { title: "Clean changing rooms", category: "CLEANING", recurrence: "DAILY", assignedTo: cleaner },
    { title: "Check toilets", category: "CLEANING", recurrence: "DAILY", assignedTo: cleaner },
    { title: "Inspect gym floor", category: "EQUIPMENT", recurrence: "DAILY", assignedTo: floor },
    { title: "Restock paper towels", category: "CLEANING", recurrence: "DAILY", assignedTo: cleaner },
    { title: "Restock shake bar", category: "SHAKE_BAR", recurrence: "DAILY", assignedTo: shakeBarStaff },
    { title: "Stock check", category: "ADMIN", recurrence: "WEEKLY", recurrenceDay: "MON", assignedTo: manager },
    { title: "Equipment inspection", category: "EQUIPMENT", recurrence: "WEEKLY", recurrenceDay: "MON", assignedTo: floor },
    { title: "Follow up membership enquiries", category: "MEMBERSHIP", recurrence: "ONE_OFF", dueDate: daysFromNow(0), priority: "HIGH", assignedTo: reception },
    { title: "Report damaged equipment", category: "MAINTENANCE", recurrence: "ONE_OFF", dueDate: daysFromNow(1), priority: "URGENT", assignedTo: floor },
    { title: "Deep clean shower area", category: "CLEANING", recurrence: "ONE_OFF", dueDate: daysFromNow(2), assignedTo: cleaner },
  ];
  for (const t of taskDefs) {
    await prisma.gymTask.create({
      data: {
        title: t.title,
        category: t.category,
        recurrence: t.recurrence,
        recurrenceDay: t.recurrenceDay,
        dueDate: t.dueDate,
        priority: t.priority ?? "NORMAL",
        assignedToId: t.assignedTo.id,
      },
    });
  }

  // --- Membership plans ----------------------------------------------------
  const plans = await Promise.all([
    prisma.gymMembershipPlan.create({ data: { name: "Off-Peak", price: 24.99, billingFrequency: "MONTHLY", joiningFee: 0, contractLengthMonths: 1 } }),
    prisma.gymMembershipPlan.create({ data: { name: "Full Access", price: 39.99, billingFrequency: "MONTHLY", joiningFee: 20, contractLengthMonths: 12 } }),
    prisma.gymMembershipPlan.create({ data: { name: "Full Access + PT", price: 89.99, billingFrequency: "MONTHLY", joiningFee: 20, contractLengthMonths: 12 } }),
    prisma.gymMembershipPlan.create({ data: { name: "Annual Full Access", price: 399, billingFrequency: "ANNUAL", joiningFee: 0, contractLengthMonths: 12 } }),
  ]);

  // --- Members + memberships + payments -------------------------------------
  const memberNames = [
    "Chloe Bennett", "Ryan Foster", "Aisha Malik", "Tom Reilly", "Grace Kim",
    "Liam Sutton", "Maya Patel", "Owen Brooks", "Zara Hussain", "Ben Carter",
    "Freya Doyle", "Noah Fisher", "Isla Grant", "Leo Marsh", "Ruby Chen",
  ];
  const memberStatuses = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "FROZEN", "CANCELLED", "OVERDUE"];
  for (let i = 0; i < memberNames.length; i++) {
    const name = memberNames[i];
    const plan = plans[i % plans.length];
    const status = memberStatuses[i % memberStatuses.length];
    const joinDate = daysFromNow(-Math.floor(10 + Math.random() * 500));
    const member = await prisma.gymMember.create({
      data: {
        memberNumber: `MM-${String(i + 1).padStart(4, "0")}`,
        fullName: name,
        email: name.toLowerCase().replace(" ", ".") + "@example.com",
        phone: "07700 800" + Math.floor(100 + Math.random() * 900),
        joinDate,
        lastVisitAt: daysFromNow(-Math.floor(Math.random() * 10)),
      },
    });

    const membership = await prisma.gymMembership.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        startDate: joinDate,
        renewalDate: daysFromNow(Math.floor(Math.random() * 28)),
        billingAmount: plan.price,
        paymentFrequency: plan.billingFrequency,
        status,
        paymentStatus: status === "OVERDUE" ? "OVERDUE" : "CURRENT",
        cancelledAt: status === "CANCELLED" ? daysFromNow(-Math.floor(Math.random() * 20)) : undefined,
      },
    });

    await prisma.gymMembershipEvent.create({
      data: { membershipId: membership.id, type: "JOINED", notes: `${name} joined on ${plan.name}` },
    });

    // A few months of payment history for active/overdue members
    if (status !== "CANCELLED") {
      for (let m = 0; m < 3; m++) {
        await prisma.gymPayment.create({
          data: {
            memberId: member.id,
            date: daysFromNow(-30 * m - Math.floor(Math.random() * 5)),
            amount: plan.price,
            type: "MEMBERSHIP",
            status: status === "OVERDUE" && m === 0 ? "FAILED" : "PAID",
            provider: "MANUAL",
          },
        });
      }
    }
  }

  // --- Enquiries -----------------------------------------------------------
  const enquiryDefs = [
    { name: "Harriet Owen", email: "harriet.owen@example.com", subject: "Day pass availability", category: "DAY_PASS", status: "NEW" },
    { name: "Callum Reid", email: "callum.reid@example.com", subject: "PT session pricing", category: "PERSONAL_TRAINING", status: "REPLIED", assignedTo: coach },
    { name: "Sienna Blake", phone: "07711 223344", subject: "Cancelling my membership", category: "CANCELLATION", status: "FOLLOW_UP", assignedTo: reception },
    { name: "Theo Marsh", email: "theo.marsh@example.com", subject: "Failed payment on my account", category: "PAYMENT", status: "AWAITING_RESPONSE", assignedTo: manager },
    { name: "Poppy Lane", email: "poppy.lane@example.com", subject: "Membership options", category: "MEMBERSHIP", status: "NEW" },
  ];
  for (const e of enquiryDefs) {
    await prisma.gymEnquiry.create({
      data: {
        name: e.name,
        email: e.email,
        phone: e.phone,
        subject: e.subject,
        category: e.category,
        status: e.status,
        assignedToId: e.assignedTo?.id,
        source: "MANUAL",
        messages: { create: { direction: "INBOUND", body: `Hi, I'm enquiring about: ${e.subject}`, fromEmail: e.email } },
      },
    });
  }

  // --- Leads ----------------------------------------------------------------
  const leadDefs = [
    { name: "Amber Lowe", source: "INSTAGRAM", stage: "NEW_LEAD" },
    { name: "Finn Doherty", source: "WEBSITE", stage: "CONTACTED" },
    { name: "Georgia Pike", source: "REFERRAL", stage: "TOUR_BOOKED" },
    { name: "Hassan Iqbal", source: "WALK_IN", stage: "TRIAL" },
    { name: "Ivy Sullivan", source: "GOOGLE", stage: "FOLLOW_UP", nextFollowUpAt: daysFromNow(1) },
    { name: "Jack Whitfield", source: "TIKTOK", stage: "READY_TO_JOIN" },
    { name: "Katie Vance", source: "FACEBOOK", stage: "JOINED" },
    { name: "Leo Sinclair", source: "WEBSITE", stage: "LOST" },
  ];
  for (const l of leadDefs) {
    await prisma.gymLead.create({
      data: {
        name: l.name,
        source: l.source,
        stage: l.stage,
        membershipInterest: "Full Access",
        nextFollowUpAt: l.nextFollowUpAt,
        assignedToId: reception.id,
      },
    });
  }

  // --- Equipment -------------------------------------------------------------
  const equipmentDefs = [
    { name: "Olympic Squat Rack #1", category: "LEGS", condition: "EXCELLENT", location: "Free Weights Area" },
    { name: "Olympic Squat Rack #2", category: "LEGS", condition: "GOOD", location: "Free Weights Area" },
    { name: "Cybex Leg Press", category: "LEGS", condition: "GOOD", location: "Machines Floor" },
    { name: "Life Fitness Treadmill #1", category: "CARDIO", condition: "NEEDS_ATTENTION", location: "Cardio Zone" },
    { name: "Life Fitness Treadmill #2", category: "CARDIO", condition: "EXCELLENT", location: "Cardio Zone" },
    { name: "Lat Pulldown Machine", category: "BACK", condition: "GOOD", location: "Machines Floor" },
    { name: "Cable Crossover Station", category: "CHEST", condition: "OUT_OF_SERVICE", location: "Machines Floor" },
    { name: "Dumbbell Rack (5–50kg)", category: "FREE_WEIGHTS", condition: "EXCELLENT", location: "Free Weights Area" },
  ];
  const equipment = [];
  for (const eq of equipmentDefs) {
    const item = await prisma.gymEquipment.create({
      data: {
        name: eq.name,
        category: eq.category,
        condition: eq.condition,
        location: eq.location,
        manufacturer: eq.name.split(" ")[0],
        lastServiceDate: daysFromNow(-Math.floor(30 + Math.random() * 180)),
        nextServiceDate: daysFromNow(Math.floor(Math.random() * 90) - 10),
      },
    });
    equipment.push(item);
  }

  // --- Maintenance tickets ----------------------------------------------------
  await prisma.gymMaintenanceTicket.create({
    data: {
      issue: "Treadmill belt slipping",
      area: "Cardio Zone",
      equipmentId: equipment[3].id,
      priority: "HIGH",
      reportedById: floor.id,
      status: "INVESTIGATING",
    },
  });
  await prisma.gymMaintenanceTicket.create({
    data: {
      issue: "Cable snapped on crossover station",
      area: "Machines Floor",
      equipmentId: equipment[6].id,
      priority: "URGENT",
      reportedById: coach.id,
      assignedToId: manager.id,
      status: "SCHEDULED",
    },
  });
  await prisma.gymMaintenanceTicket.create({
    data: { issue: "Changing room light flickering", area: "Changing Rooms", priority: "LOW", reportedById: cleaner.id, status: "FIXED", resolvedAt: daysFromNow(-2) },
  });

  // --- Equipment Cleaning --------------------------------------------------
  // Zones are seeded structurally in seed.ts (always runs first); look them
  // up here rather than re-creating, so this stays a no-op if run twice.
  const cleaningZones = await prisma.gymCleaningZone.findMany({ orderBy: { order: "asc" } });
  const zoneByName = (name: string) => cleaningZones.find((z) => z.name === name) ?? cleaningZones[0];
  const today = daysFromNow(0);
  const yesterday = daysFromNow(-1);

  const cleaningTaskDefs = [
    { date: today, zone: "Free Weights", what: "Dumbbells, benches, mats wiped down", status: "COMPLETE", assignedTo: cleaner, completedBy: manager, notes: "Photos received on WhatsApp at 09:10" },
    { date: today, zone: "Cardio", what: "Treadmills, bikes, cross-trainers sanitised", status: "AWAITING_REVIEW", assignedTo: cleaner, notes: "Photos received on WhatsApp at 10:35" },
    { date: today, zone: "Changing Rooms", what: "Lockers, benches, mirrors, floors", status: "IN_PROGRESS", assignedTo: floor },
    { date: today, zone: "Studio", what: "Mats, mirrors, sound equipment wiped", status: "PENDING", assignedTo: cleaner },
    { date: today, zone: "Reception", what: "Front desk, seating area, entrance glass", status: "PENDING", assignedTo: reception },
    { date: yesterday, zone: "Free Weights", what: "Dumbbells, benches, mats wiped down", status: "COMPLETE", assignedTo: cleaner, completedBy: manager },
    { date: yesterday, zone: "Cardio", what: "Treadmills, bikes, cross-trainers sanitised", status: "MISSED", assignedTo: cleaner, notes: "No photos received — follow up with staff" },
    { date: yesterday, zone: "Changing Rooms", what: "Lockers, benches, mirrors, floors", status: "COMPLETE", assignedTo: floor, completedBy: manager },
    { date: yesterday, zone: "Studio", what: "Mats, mirrors, sound equipment wiped", status: "COMPLETE", assignedTo: cleaner, completedBy: manager },
    { date: yesterday, zone: "Reception", what: "Front desk, seating area, entrance glass", status: "MISSED", assignedTo: reception },
  ];
  for (const t of cleaningTaskDefs) {
    await prisma.gymCleaningTask.create({
      data: {
        date: t.date,
        zoneId: zoneByName(t.zone).id,
        whatBeingCleaned: t.what,
        status: t.status,
        assignedToId: t.assignedTo.id,
        notes: t.notes,
        completedById: t.completedBy?.userId ?? undefined,
        completedAt: t.status === "COMPLETE" ? t.date : undefined,
        createdById: manager.userId ?? undefined,
      },
    });
  }

  // --- Shake Bar ---------------------------------------------------------------
  const shakeBarDefs = [
    { name: "Whey Protein Shake - Chocolate", category: "PROTEIN", stock: 42, costPrice: 1.8, sellingPrice: 4.5, lowStockLevel: 10 },
    { name: "Whey Protein Shake - Vanilla", category: "PROTEIN", stock: 6, costPrice: 1.8, sellingPrice: 4.5, lowStockLevel: 10 },
    { name: "Pre-Workout Blast", category: "PRE_WORKOUT", stock: 18, costPrice: 1.2, sellingPrice: 3.5, lowStockLevel: 8 },
    { name: "Electrolyte Water", category: "HYDRATION", stock: 60, costPrice: 0.6, sellingPrice: 2, lowStockLevel: 15 },
    { name: "Energy Drink - Citrus", category: "ENERGY_DRINKS", stock: 4, costPrice: 0.9, sellingPrice: 2.5, lowStockLevel: 12 },
    { name: "Protein Bar - Peanut Butter", category: "SNACKS", stock: 25, costPrice: 0.8, sellingPrice: 2.2, lowStockLevel: 10 },
  ];
  for (const p of shakeBarDefs) {
    await prisma.gymShakeBarProduct.create({ data: { ...p, supplier: "Bulk Nutrition Co.", lastRestockedAt: daysFromNow(-5) } });
  }

  // --- Marketing --------------------------------------------------------------
  const campaign = await prisma.gymMarketingCampaign.create({
    data: { name: "New Year New You", type: "MEMBERSHIP_OFFER", status: "ACTIVE", startDate: daysFromNow(-10), endDate: daysFromNow(20) },
  });
  await prisma.gymLead.updateMany({ where: { name: { in: ["Amber Lowe", "Finn Doherty"] } }, data: { campaignId: campaign.id } });

  await prisma.gymMarketingContent.create({
    data: { title: "New Cybex equipment reveal", platform: "INSTAGRAM", status: "SCHEDULED", publishDate: daysFromNow(3), ownerId: nat.id },
  });

  // --- Incidents ----------------------------------------------------------------
  await prisma.gymIncident.create({
    data: {
      category: "EQUIPMENT_FAILURE",
      location: "Machines Floor",
      description: "Cable snapped on the crossover station mid-use. No injury, member was uninjured.",
      actionTaken: "Machine taken out of service immediately, maintenance ticket raised.",
      followUpRequired: true,
      followUpNotes: "Awaiting parts delivery to repair cable.",
    },
  });

  // --- Announcement ---------------------------------------------------------------
  await prisma.gymAnnouncement.create({
    data: { title: "New Cybex equipment arriving Friday", body: "New leg press and lat pulldown machines are being installed this Friday morning. The machines floor will be partially closed 8am–11am.", pinned: true },
  });

  console.log("Demo data seeded: staff, rota, tasks, members, memberships, payments, enquiries, leads, equipment, maintenance, shake bar, marketing, incident, announcement.");
}
