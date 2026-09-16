"use client";

import * as React from "react";
import { Save, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GYM_NAV_ITEMS } from "@/lib/gym/nav-config";
import { roleLabel } from "@/lib/gym/permissions";
import { cn } from "@/lib/utils";
import { updateRolePermissionsAction, type RolePermissionsUpdate } from "@/actions/gym/role-permissions";
import type { EditableRole } from "@/lib/gym/role-permissions-defaults";

type Matrix = Record<EditableRole, Set<string>>;

function toMatrix(rolePermissions: RolePermissionsUpdate[]): Matrix {
  const matrix = {} as Matrix;
  for (const { role, allowedTabs } of rolePermissions) {
    matrix[role] = new Set(allowedTabs);
  }
  return matrix;
}

export function RolePermissionsEditor({
  rolePermissions,
  isOwner,
}: {
  rolePermissions: RolePermissionsUpdate[];
  isOwner: boolean;
}) {
  const [matrix, setMatrix] = React.useState<Matrix>(() => toMatrix(rolePermissions));
  const [dirty, setDirty] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const roles = rolePermissions.map((r) => r.role);

  function toggle(role: EditableRole, href: string) {
    if (!isOwner) return;
    setMatrix((prev) => {
      const next = { ...prev, [role]: new Set(prev[role]) };
      if (next[role].has(href)) next[role].delete(href);
      else next[role].add(href);
      return next;
    });
    setDirty(true);
    setSavedAt(null);
  }

  function save() {
    setError(null);
    const updates: RolePermissionsUpdate[] = roles.map((role) => ({ role, allowedTabs: Array.from(matrix[role]) }));
    startTransition(async () => {
      try {
        await updateRolePermissionsAction(updates);
        setDirty(false);
        setSavedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {!isOwner && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" />
          Read-only — only the Owner can change which tabs each role can access.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card">Role</TableHead>
              {GYM_NAV_ITEMS.map((item) => (
                <TableHead key={item.href} className="whitespace-nowrap text-center">
                  {item.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">{roleLabel(role)}</TableCell>
                {GYM_NAV_ITEMS.map((item) => (
                  <TableCell key={item.href} className="text-center">
                    <input
                      type="checkbox"
                      className={cn("size-4 accent-primary", !isOwner && "cursor-not-allowed opacity-60")}
                      checked={matrix[role]?.has(item.href) ?? false}
                      disabled={!isOwner}
                      onChange={() => toggle(role, item.href)}
                      aria-label={`${roleLabel(role)} — ${item.label}`}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isOwner && (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={!dirty || pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!error && savedAt && <p className="text-xs text-success">Saved.</p>}
          {!error && dirty && !pending && <p className="text-xs text-muted-foreground">Unsaved changes.</p>}
        </div>
      )}
    </div>
  );
}
