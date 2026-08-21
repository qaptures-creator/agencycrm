import type { Metadata } from "next";
import { requireGymUser } from "@/lib/gym/auth";
import { GymSidebar } from "@/components/gym/sidebar";
import { GymTopbar } from "@/components/gym/topbar";
import { getNavBadgeCounts } from "@/lib/gym/nav-badges";

export const metadata: Metadata = { title: "Muscle Massacre" };

export default async function GymLayout({ children }: { children: React.ReactNode }) {
  const user = await requireGymUser("/gym");
  const displayUser = { name: user.name, accessRole: user.accessRole, position: user.staff?.position };
  const badges = await getNavBadgeCounts(user.id);

  return (
    <div className="gym-theme gym-grain flex h-screen overflow-hidden bg-background text-foreground">
      <GymSidebar user={displayUser} badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <GymTopbar user={{ id: user.id, name: user.name, accessRole: user.accessRole }} badges={badges} />
        <main className="flex-1 overflow-y-auto scrollbar-thin bg-background pb-20 lg:pb-0">
          <div className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
