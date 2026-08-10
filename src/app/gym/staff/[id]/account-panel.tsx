"use client";

import * as React from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog } from "@/components/entity-dialog";
import { ACCESS_ROLES, roleLabel, type GymAccessRole } from "@/lib/gym/permissions";
import {
  createStaffAccountAction,
  resetStaffPasswordAction,
  setStaffActiveAction,
} from "@/actions/gym/auth";

type Account = { id: string; email: string; accessRole: string; active: boolean } | null;

export function AccountPanel({ staffId, account }: { staffId: string; account: Account }) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [accessRole, setAccessRole] = React.useState<GymAccessRole>("STAFF");
  const [credentials, setCredentials] = React.useState<{ email: string; tempPassword: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await createStaffAccountAction({ staffId, email, accessRole });
        setCredentials(result);
        toast.success("Login account created");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create account");
      }
    });
  }

  async function handleReset() {
    if (!account) return;
    startTransition(async () => {
      try {
        const result = await resetStaffPasswordAction(account.id);
        setCredentials({ email: account.email, tempPassword: result.tempPassword });
        toast.success("Temporary password generated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reset password");
      }
    });
  }

  async function handleToggleActive() {
    if (!account) return;
    startTransition(async () => {
      try {
        await setStaffActiveAction(account.id, !account.active);
        toast.success(account.active ? "Account disabled" : "Account enabled");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update account");
      }
    });
  }

  if (!account) {
    return (
      <>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
          <UserPlus className="size-4" />
          Create Login Account
        </Button>
        <EntityDialog open={open} onOpenChange={setOpen} title="Create Login Account" className="max-w-sm">
          {credentials ? (
            <CredentialsReveal credentials={credentials} onClose={() => setOpen(false)} />
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="acct-email">Email</Label>
                <Input id="acct-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Access Role</Label>
                <Select value={accessRole} onValueChange={(v) => setAccessRole(v as GymAccessRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating…" : "Create account"}
              </Button>
            </form>
          )}
        </EntityDialog>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        {account.active ? (
          <ShieldCheck className="size-4 text-success" />
        ) : (
          <ShieldOff className="size-4 text-muted-foreground" />
        )}
        <span className="font-medium">{account.email}</span>
        <span className="text-muted-foreground">· {roleLabel(account.accessRole)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleReset} disabled={pending}>
          <KeyRound className="size-3.5" />
          Reset Password
        </Button>
        <Button size="sm" variant={account.active ? "outline" : "default"} onClick={handleToggleActive} disabled={pending}>
          {account.active ? "Disable Account" : "Enable Account"}
        </Button>
      </div>
      {credentials && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <CredentialsReveal credentials={credentials} inline />
        </div>
      )}
    </div>
  );
}

function CredentialsReveal({
  credentials,
  onClose,
  inline,
}: {
  credentials: { email: string; tempPassword: string };
  onClose?: () => void;
  inline?: boolean;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-warning-foreground">
        Share this temporary password with {credentials.email} securely — it won&apos;t be shown again. They&apos;ll be
        asked to set a new one on first sign-in.
      </p>
      <div className="rounded-lg bg-background/60 p-3 font-mono text-sm">
        {credentials.email}
        <br />
        {credentials.tempPassword}
      </div>
      {!inline && (
        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      )}
    </div>
  );
}
