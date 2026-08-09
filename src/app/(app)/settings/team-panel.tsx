"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonAvatar } from "@/components/ui/avatar";
import { EntityDialog } from "@/components/entity-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUser, updateUser, deleteUser } from "@/actions/users";
import type { User } from "@prisma/client";

const COLORS = ["#6366f1", "#8b5cf6", "#d946ef", "#f59e0b", "#22c55e", "#06b6d4", "#ef4444", "#64748b"];

export function TeamPanel({ users }: { users: User[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("MEMBER");
  const [color, setColor] = React.useState(COLORS[0]);
  const [saving, setSaving] = React.useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setRole("MEMBER");
    setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    setDialogOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setColor(u.color);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, { name: name.trim(), email: email.trim(), role, color });
        toast.success("Team member updated");
      } else {
        await createUser({ name: name.trim(), email: email.trim(), role, color });
        toast.success("Team member added");
      }
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      toast.success("Team member removed");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove team member");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">People who can be assigned to leads, shoots and deliverables.</p>
        <Button size="sm" onClick={openCreate}>
          <Plus /> Add team member
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {users.map((u) => (
          <Card key={u.id} className="flex items-center gap-3 p-3">
            <PersonAvatar name={u.name} color={u.color} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
            <Badge variant="secondary">{u.role}</Badge>
            <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(u)}>
              <Trash2 className="size-3.5" />
            </Button>
          </Card>
        ))}
      </div>

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit team member" : "Add team member"}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full ring-offset-2 ring-offset-background"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add member"}
            </Button>
          </div>
        </div>
      </EntityDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&rsquo;ll be unassigned from any leads, projects or deliverables. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:opacity-90" onClick={handleDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
