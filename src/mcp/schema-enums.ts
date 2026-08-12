// zod enums derived from the same string vocab the CRM UI uses (src/lib/constants.ts),
// so MCP tools reject anything the app itself wouldn't recognize.

import { z } from "zod";
import {
  CLIENT_STATUSES,
  CLIENT_PAYMENT_STATUSES,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  PROJECT_STATUSES,
  DELIVERABLE_CONTENT_TYPES,
  APPROVAL_STATUSES,
  ACTIVITY_TYPES,
} from "@/lib/constants";

function toEnum(values: readonly { value: string }[]) {
  return z.enum(values.map((v) => v.value) as [string, ...string[]]);
}

export const clientStatusEnum = toEnum(CLIENT_STATUSES);
export const clientPaymentStatusEnum = toEnum(CLIENT_PAYMENT_STATUSES);
export const invoiceStatusEnum = toEnum(INVOICE_STATUSES);
export const invoiceTypeEnum = toEnum(INVOICE_TYPES);
export const projectStatusEnum = toEnum(PROJECT_STATUSES);
export const deliverableContentTypeEnum = toEnum(DELIVERABLE_CONTENT_TYPES);
export const approvalStatusEnum = toEnum(APPROVAL_STATUSES);
export const activityTypeEnum = toEnum(ACTIVITY_TYPES);
