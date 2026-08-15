import { prisma } from "@/lib/prisma";
import { MobileMenuButton } from "@/components/gym/mobile-menu-button";
import { GymGlobalSearch } from "@/components/gym/global-search";
import { NotificationsBell, type NotificationItem } from "@/components/gym/notifications-bell";
import { GymQuickAdd } from "@/components/gym/quick-add";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export async function GymTopbar({ user }: { user: { id: string; name: string; accessRole: string } }) {
  const notificationRows = await prisma.gymNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const notifications: NotificationItem[] = notificationRows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <MobileMenuButton user={user} />
      <div className="min-w-0 flex-1">
        <GymGlobalSearch />
      </div>
      <ThemeToggle />
      <NotificationsBell notifications={notifications} />
      <GymQuickAdd />
    </header>
  );
}
