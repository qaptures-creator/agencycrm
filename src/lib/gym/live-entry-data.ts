import "server-only";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

const memberSelect = {
  id: true,
  fullName: true,
  memberNumber: true,
  memberships: {
    orderBy: { startDate: "desc" as const },
    take: 1,
    select: { status: true, plan: { select: { name: true } } },
  },
};

export type LiveEntryRow = {
  id: string;
  entryTime: string;
  zone: string | null;
  device: string | null;
  memberNumber: string;
  memberName: string | null;
  membershipType: string | null;
  membershipStatus: string | null;
};

function toRow(e: {
  id: string;
  entryTime: Date;
  zone: string | null;
  device: string | null;
  memberNumber: string;
  member: { fullName: string; memberships: { status: string; plan: { name: string } }[] } | null;
}): LiveEntryRow {
  const membership = e.member?.memberships[0] ?? null;
  return {
    id: e.id,
    entryTime: e.entryTime.toISOString(),
    zone: e.zone,
    device: e.device,
    memberNumber: e.memberNumber,
    memberName: e.member?.fullName ?? null,
    membershipType: membership?.plan.name ?? null,
    membershipStatus: membership?.status ?? null,
  };
}

/** Newest-first, for the Live Entry page. */
export async function getRecentLiveEntries(limit = 100): Promise<LiveEntryRow[]> {
  const events = await prisma.gymLiveEntryEvent.findMany({
    orderBy: { entryTime: "desc" },
    take: limit,
    select: { id: true, entryTime: true, zone: true, device: true, memberNumber: true, member: { select: memberSelect } },
  });
  return events.map(toRow);
}

export type LiveEntryTodayStats = {
  uniqueMembersToday: number;
  totalEventsToday: number;
  latest: LiveEntryRow[];
};

/** Powers the dashboard's "LIVE ENTRY / WHO'S COME IN TODAY" widget. */
export async function getTodayLiveEntryStats(): Promise<LiveEntryTodayStats> {
  const now = new Date();
  const range = { gte: startOfDay(now), lte: endOfDay(now) };

  const [totalEventsToday, todaysEvents, latestRaw] = await Promise.all([
    prisma.gymLiveEntryEvent.count({ where: { entryTime: range } }),
    prisma.gymLiveEntryEvent.findMany({ where: { entryTime: range }, select: { memberNumber: true } }),
    prisma.gymLiveEntryEvent.findMany({
      orderBy: { entryTime: "desc" },
      take: 5,
      select: { id: true, entryTime: true, zone: true, device: true, memberNumber: true, member: { select: memberSelect } },
    }),
  ]);

  const uniqueMembersToday = new Set(todaysEvents.map((e) => e.memberNumber)).size;

  return {
    uniqueMembersToday,
    totalEventsToday,
    latest: latestRaw.map(toRow),
  };
}
