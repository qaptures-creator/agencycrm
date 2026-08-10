"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPasswordAction } from "@/actions/gym/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, formAction, pending] = useActionState(resetPasswordAction, null);

  if (state?.success) {
    return (
      <div className="space-y-4 text-sm">
        <p>Password updated. You can sign in now.</p>
        <Link href="/gym-login">
          <Button className="w-full">Go to sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending || !token}>
        {pending ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="gym-theme gym-grain flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-xl font-bold uppercase tracking-wide">Set New Password</h1>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/40">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
