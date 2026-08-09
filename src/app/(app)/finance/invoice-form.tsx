"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { invoiceSchema, type InvoiceInput } from "@/lib/validators";
import { createInvoice, updateInvoice } from "@/actions/invoices";
import { INVOICE_STATUSES, INVOICE_TYPES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";
import type { Invoice, Client } from "@prisma/client";

type InvoiceFormValues = z.input<typeof invoiceSchema>;

export function InvoiceForm({
  invoice,
  clients,
  defaultClientId,
  onSuccess,
  onCancel,
}: {
  invoice?: Invoice;
  clients: Client[];
  defaultClientId?: string;
  onSuccess?: (invoice: Invoice) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues, unknown, InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      clientId: invoice?.clientId ?? defaultClientId ?? "",
      amount: invoice?.amount ?? undefined,
      type: invoice?.type ?? "ONE_OFF",
      status: invoice?.status ?? "DRAFT",
      issueDate: toDateInputValue(invoice?.issueDate ?? new Date()),
      dueDate: toDateInputValue(invoice?.dueDate),
      paidDate: toDateInputValue(invoice?.paidDate),
      description: invoice?.description ?? "",
    },
  });

  async function onSubmit(values: InvoiceInput) {
    try {
      const result = invoice ? await updateInvoice(invoice.id, values) : await createInvoice(values);
      toast.success(invoice ? "Invoice updated" : "Invoice created");
      onSuccess?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="clientId">Client *</Label>
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!!defaultClientId}>
                <SelectTrigger id="clientId">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="amount">Amount *</Label>
          <Input id="amount" type="number" min={0} step="0.01" {...register("amount")} placeholder="2500" />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map((s) => (
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
          <Label htmlFor="issueDate">Issue Date</Label>
          <Input id="issueDate" type="date" {...register("issueDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="dueDate">Payment Due Date</Label>
          <Input id="dueDate" type="date" {...register("dueDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="paidDate">Payment Received Date</Label>
          <Input id="paidDate" type="date" {...register("paidDate")} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} {...register("description")} placeholder="e.g. August retainer, Brand video milestone 2" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
