import Link from "next/link";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function GymLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentGymUser();
  if (user) redirect("/gym");
  const { next } = await searchParams;

  return (
    <div className="gym-theme gym-grain flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <span className="font-display text-2xl font-bold">MM</span>
          </div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Muscle Massacre</h1>
          <p className="mt-1 text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
            Staff Command Centre
          </p>
        </div>

        <div className="gym-hairline rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/40">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          No public sign-up — accounts are created by management.
          <br />
          musclemassacre.com
        </p>
      </div>
    </div>
  );
}
