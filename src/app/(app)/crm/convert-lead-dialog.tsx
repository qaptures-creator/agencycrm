"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ClientForm } from "@/app/(app)/clients/client-form";
import type { ServiceOption } from "@/components/services-select";
import type { Lead } from "@prisma/client";

export function ConvertLeadDialog({
  lead,
  services,
  open,
  onOpenChange,
}: {
  lead: (Lead & { services: ServiceOption[] }) | null;
  services: ServiceOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert to client</DialogTitle>
          <DialogDescription>
            We&rsquo;ve pre-filled this from {lead.companyName}&rsquo;s lead record — review and confirm.
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          services={services}
          convertLeadId={lead.id}
          leadDefaults={{
            companyName: lead.companyName,
            mainContactName: lead.contactName,
            email: lead.email ?? undefined,
            phone: lead.phone ?? undefined,
            instagram: lead.instagram ?? undefined,
            website: lead.website ?? undefined,
            serviceIds: lead.services.map((s) => s.id),
          }}
          onSuccess={(client) => {
            onOpenChange(false);
            router.push(`/clients/${client.id}`);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
