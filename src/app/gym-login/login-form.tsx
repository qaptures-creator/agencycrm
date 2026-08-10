"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "@/actions/gym/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required placeholder="you@musclemassacre.com" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/gym-login/forgot" className="text-xs text-primary hover:underline">
            Forgotten password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showPassword ? "Hide password" : "Show password"}
        </button>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full font-display text-base uppercase tracking-wide" size="lg" disabled={pending}>
        {pending ? "Signing In…" : "Sign In"}
      </Button>
    </form>
  );
}
