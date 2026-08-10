import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { StaffList } from "./staff-list";

export default async function StaffPage() {
  const user = await requireGymUser();
  const canManage = can(user.accessRole as GymAccessRole, "manageStaff");

  const staff = await prisma.gymStaff.findMany({
    orderBy: [{ employmentStatus: "asc" }, { fullName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Staff</h1>
        <p className="text-sm text-muted-foreground">Team profiles, roles and permissions.</p>
      </div>
      <StaffList staff={staff} canManage={canManage} />
    </div>
  );
}
