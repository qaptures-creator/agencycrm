"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Sparkles } from "lucide-react";
import { renameService, deleteService } from "@/actions/services";
import { createService } from "@/actions/leads";
import type { Service } from "@prisma/client";

type ServiceWithCount = Service & { _count: { leads: number; clients: number } };

export function ServicesPanel({ services }: { services: ServiceWithCount[] }) {
  const router = useRouter();
  const [newName, setNewName] = React.useState("");

  async function addService() {
    if (!newName.trim()) return;
    await createService(newName.trim());
    setNewName("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The services catalog used across lead and client forms. Renaming or removing here updates it everywhere.
      </p>

      {services.length === 0 ? (
        <EmptyState icon={Sparkles} title="No services yet" description="Add services like Reels, Brand Video, or Photography to reuse across leads and clients." />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <Card key={s.id} className="flex items-center gap-2 p-2.5">
              <Input
                defaultValue={s.name}
                className="h-8 flex-1"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== s.name) {
                    renameService(s.id, e.target.value.trim()).then(() => router.refresh());
                  }
                }}
              />
              <Badge variant="secondary">{s._count.leads + s._count.clients} in use</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  await deleteService(s.id);
                  toast.success("Service removed");
                  router.refresh();
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input placeholder="New service name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addService()} />
        <Button onClick={addService}>
          <Plus /> Add service
        </Button>
      </div>
    </div>
  );
}
