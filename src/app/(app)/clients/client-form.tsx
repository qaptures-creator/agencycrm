"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { clientSchema, type ClientInput } from "@/lib/validators";
import { createClient, updateClient, convertLeadToClient } from "@/actions/clients";
import { CLIENT_PAYMENT_STATUSES, CLIENT_STATUSES, SWATCH_COLORS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServicesSelect, type ServiceOption } from "@/components/services-select";
import { toDateInputValue } from "@/lib/utils";
import type { Client } from "@prisma/client";

type ClientFormValues = z.input<typeof clientSchema>;
type ClientWithServices = Client & { services: ServiceOption[] };

export function ClientForm({
  client,
  services,
  convertLeadId,
  leadDefaults,
  onSuccess,
  onCancel,
}: {
  client?: ClientWithServices;
  services: ServiceOption[];
  convertLeadId?: string;
  leadDefaults?: Partial<{
    companyName: string;
    mainContactName: string;
    email: string;
    phone: string;
    instagram: string;
    website: string;
    serviceIds: string[];
  }>;
  onSuccess?: (client: Client) => void;
  onCancel?: () => void;
}) {
  const [serviceOptions, setServiceOptions] = React.useState(services);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues, unknown, ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      companyName: client?.companyName ?? leadDefaults?.companyName ?? "",
      mainContactName: client?.mainContactName ?? leadDefaults?.mainContactName ?? "",
      email: client?.email ?? leadDefaults?.email ?? "",
      phone: client?.phone ?? leadDefaults?.phone ?? "",
      instagram: client?.instagram ?? leadDefaults?.instagram ?? "",
      website: client?.website ?? leadDefaults?.website ?? "",
      monthlyRetainer: client?.monthlyRetainer ?? undefined,
      oneOffValue: client?.oneOffValue ?? undefined,
      contractStart: toDateInputValue(client?.contractStart),
      contractEnd: toDateInputValue(client?.contractEnd),
      paymentStatus: client?.paymentStatus ?? "CURRENT",
      status: client?.status ?? "ACTIVE",
      color: client?.color ?? SWATCH_COLORS[0],
      notes: client?.notes ?? "",
      serviceIds: client?.services?.map((s) => s.id) ?? leadDefaults?.serviceIds ?? [],
    },
  });

  async function onSubmit(values: ClientInput) {
    try {
      const result = client
        ? await updateClient(client.id, values)
        : convertLeadId
          ? await convertLeadToClient(convertLeadId, values)
          : await createClient(values);
      toast.success(convertLeadId ? "Lead converted to client 🎉" : client ? "Client updated" : "Client created");
      onSuccess?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input id="companyName" {...register("companyName")} />
          {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="mainContactName">Main Contact *</Label>
          <Input id="mainContactName" {...register("mainContactName")} />
          {errors.mainContactName && <p className="text-xs text-destructive">{errors.mainContactName.message}</p>}
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="instagram">Instagram / Social</Label>
          <Input id="instagram" {...register("instagram")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="website">Website</Label>
          <Input id="website" {...register("website")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="monthlyRetainer">Monthly Retainer</Label>
          <Input id="monthlyRetainer" type="number" min={0} {...register("monthlyRetainer")} placeholder="e.g. 3000" />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="oneOffValue">One-off Project Value</Label>
          <Input id="oneOffValue" type="number" min={0} {...register("oneOffValue")} placeholder="e.g. 1500" />
          <p className="text-xs text-muted-foreground">Leave Monthly Retainer blank to list this client under One-off Projects.</p>
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="status">Client Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="paymentStatus">Payment Status</Label>
          <Controller
            control={control}
            name="paymentStatus"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="paymentStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="contractStart">Contract Start</Label>
          <Input id="contractStart" type="date" {...register("contractStart")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="contractEnd">Contract Renewal / End</Label>
          <Input id="contractEnd" type="date" {...register("contractEnd")} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Colour</Label>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <div className="flex gap-2">
                {SWATCH_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => field.onChange(c)}
                    className="size-7 rounded-full ring-offset-2 ring-offset-background"
                    style={{ backgroundColor: c, boxShadow: field.value === c ? `0 0 0 2px ${c}` : undefined }}
                    aria-label={`Colour ${c}`}
                  />
                ))}
              </div>
            )}
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Services Provided</Label>
          <Controller
            control={control}
            name="serviceIds"
            render={({ field }) => (
              <ServicesSelect
                services={serviceOptions}
                selectedIds={field.value ?? []}
                onChange={field.onChange}
                onServiceCreated={(s) => setServiceOptions((prev) => [...prev, s])}
              />
            )}
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="notes">Client Notes</Label>
          <Textarea id="notes" rows={4} {...register("notes")} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : convertLeadId ? "Convert to client" : client ? "Save changes" : "Create client"}
        </Button>
      </div>
    </form>
  );
}
