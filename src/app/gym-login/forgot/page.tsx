"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/gym/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, null);

  return (
    <div className="gym-theme gym-grain flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-xl font-bold uppercase tracking-wide">Reset Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Muscle Massacre Staff Command Centre</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/40">
          {state?.submitted ? (
            <div className="space-y-4 text-sm">
              <p className="text-foreground">
                If that account exists, a reset link has been generated.
              </p>
              {state.resetLink && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning-foreground">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide">
                    Email isn&apos;t connected yet — for now, an authorised manager needs to hand you this link securely:
                  </p>
                  <code className="block break-all rounded bg-background/60 px-2 py-1.5 text-xs">
                    {typeof window !== "undefined" ? window.location.origin : ""}
                    {state.resetLink}
                  </code>
                </div>
              )}
              <Link href="/gym-login" className="block text-center text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="you@musclemassacre.com" />
              </div>
              {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending…" : "Request reset link"}
              </Button>
              <Link href="/gym-login" className="block text-center text-xs text-muted-foreground hover:text-foreground">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
