import { ShieldAlert } from "lucide-react";
import { requireGymUser } from "@/lib/gym/auth";
import { logoutAction } from "@/actions/gym/auth";
import { Button } from "@/components/ui/button";

/**
 * Deliberately ungated beyond requiring a session — this is the landing
 * spot requireTabAccess redirects to when a role's access matrix denies a
 * tab, including potentially Dashboard itself. If this page had its own
 * tab check, a role denied everything would have nowhere to land.
 */
export default async function AccessDeniedPage() {
  await requireGymUser();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="size-7" />
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-xl font-bold">Access Restricted</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your access role doesn&apos;t have permission to view this section. Contact your gym owner if you think this is a mistake.
        </p>
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="outline">
          Log out
        </Button>
      </form>
    </div>
  );
}
