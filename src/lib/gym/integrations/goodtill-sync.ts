import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getGoodtillCategories,
  getGoodtillProducts,
  getGoodtillSaleDetails,
  getGoodtillSalesDetailsPage,
  type GoodtillSaleDetail,
} from "./goodtill-client";

/**
 * Turns real Goodtill/SumUp data into rows in Postgres. Shared by three
 * callers that all need the exact same upsert behaviour:
 *  - the sale.completed webhook (one sale at a time, near-real-time)
 *  - the historical import (paginated, run once to backfill)
 *  - the manual "Sync SumUp" reconciliation button (catalog + recent window)
 *
 * Every write is an upsert keyed on Goodtill's own id, so re-processing a
 * sale (retried webhook, re-run sync) never creates a duplicate row.
 */

const SYNC_STATE_KEY = "goodtill";

function parseNum(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Goodtill returns naive "Y-m-d H:i:s" strings. Bulk endpoints are fetched
 * with timezone=utc; the single-sale endpoint (used by the webhook) has no
 * timezone param and returns the store's local time — treated as UTC here
 * too, which can be off by an hour for GMT/BST. Acceptable for the "recent
 * activity" and day/week/month bucketing this powers. */
function parseGoodtillDateTime(s: string): Date {
  return new Date(`${s.replace(" ", "T")}Z`);
}

async function touchSyncState(data: Prisma.GymPosSyncStateUpdateInput) {
  await prisma.gymPosSyncState.upsert({
    where: { key: SYNC_STATE_KEY },
    create: { key: SYNC_STATE_KEY, ...(data as Prisma.GymPosSyncStateCreateInput) },
    update: data,
  });
}

export async function getGoodtillSyncStatus() {
  return prisma.gymPosSyncState.findUnique({ where: { key: SYNC_STATE_KEY } });
}

export async function recordGoodtillWebhookReceived(event: string) {
  await touchSyncState({ lastWebhookAt: new Date(), lastWebhookEvent: event });
}

/** Mirrors every Goodtill category and product — no filtering. */
export async function syncGoodtillCatalog(): Promise<{ categories: number; products: number }> {
  const [categories, products] = await Promise.all([getGoodtillCategories(), getGoodtillProducts()]);

  for (const cat of categories) {
    const data = {
      name: cat.name,
      description: cat.description ?? null,
      parentExternalId: cat.parent_category_id ?? null,
      active: cat.active === 1,
      raw: cat as unknown as Prisma.InputJsonValue,
    };
    await prisma.gymPosCategory.upsert({
      where: { externalId: cat.id },
      create: { externalId: cat.id, ...data },
      update: data,
    });
  }

  for (const p of products) {
    const data = {
      name: p.product_name,
      sku: p.product_sku ?? null,
      categoryExternalId: p.category_id ?? null,
      sellingPrice: parseNum(p.selling_price),
      purchasePrice: parseNum(p.purchase_price),
      active: p.active === 1,
      trackInventory: p.track_inventory === 1,
      inventory: parseNum(p.inventory),
      minStock: parseNum(p.min_stock),
      alertOn: p.alert_on === 1,
      alertBelow: parseNum(p.alert_below),
      outletExternalId: p.outlet_id ?? null,
      raw: p as unknown as Prisma.InputJsonValue,
    };
    await prisma.gymPosProduct.upsert({
      where: { externalId: p.id },
      create: { externalId: p.id, ...data },
      update: data,
    });
  }

  await touchSyncState({ lastCatalogSyncAt: new Date() });
  return { categories: categories.length, products: products.length };
}

/** Upserts one sale + its line items. Used by both the webhook and the
 * historical/reconciliation sync — same Goodtill shape either way. */
export async function upsertGoodtillSale(
  sale: GoodtillSaleDetail,
  source: "WEBHOOK" | "HISTORICAL_SYNC"
): Promise<{ saleId: string; isNew: boolean }> {
  const items = sale.sales_details?.sales_items ?? [];
  const paymentMethods = sale.sales_payments ? Object.keys(sale.sales_payments).join(", ") || null : null;
  const totalIncVat =
    parseNum(sale.sales_details?.total_after_discount) ?? parseNum(sale.sales_details?.total) ?? 0;
  const totalExVat =
    parseNum(sale.sales_details?.subtotal_after_discount) ?? parseNum(sale.sales_details?.total_ex_vat);
  const totalVat = parseNum(sale.sales_details?.vat_after_discount) ?? parseNum(sale.sales_details?.total_vat);
  const discountAmount = parseNum(sale.sales_details?.line_discount);
  const refunded = Array.isArray(sale.refunds) && sale.refunds.length > 0;
  const saleDateTime = parseGoodtillDateTime(sale.sales_date_time);

  const existing = await prisma.gymPosSale.findUnique({ where: { externalId: sale.id }, select: { id: true } });

  const saleData = {
    outletExternalId: sale.outlet_id ?? null,
    outletName: sale.outlet?.outlet_name ?? null,
    registerId: sale.register_id ?? null,
    staffId: sale.staff_id ?? null,
    customerId: sale.customer_id ?? null,
    orderNo: sale.order_no ?? null,
    receiptNo: sale.receipt_no ?? null,
    saleType: sale.sale_type ?? null,
    orderStatus: sale.order_status ?? null,
    saleDateTime,
    totalIncVat,
    totalExVat,
    totalVat,
    discountAmount,
    paymentMethods,
    refunded,
    raw: sale as unknown as Prisma.InputJsonValue,
  };

  const saleRow = await prisma.gymPosSale.upsert({
    where: { externalId: sale.id },
    create: { externalId: sale.id, source, ...saleData },
    update: saleData, // `source` intentionally left alone on update
  });

  for (const item of items) {
    const itemData = {
      productExternalId: item.product_id ?? null,
      productName: item.product_name,
      quantity: parseNum(item.quantity) ?? 0,
      unitPriceIncVat: parseNum(item.price_inc_vat_per_item),
      lineTotalIncVat: parseNum(item.line_total_after_discount),
      vatRate: parseNum(item.vat_rate),
      discountAmount: parseNum(item.discount_amount),
      isRemoved: item.is_removed === 1,
      raw: item as unknown as Prisma.InputJsonValue,
    };
    await prisma.gymPosSaleItem.upsert({
      where: { externalId: item.id },
      create: { externalId: item.id, saleId: saleRow.id, ...itemData },
      update: itemData,
    });
  }

  return { saleId: saleRow.id, isNew: !existing };
}

/** Fetches one sale by Goodtill ID and upserts it — what the webhook calls
 * after receiving a sale.completed event (the webhook payload itself only
 * carries the sale id). */
export async function syncGoodtillSaleById(saleId: string, source: "WEBHOOK" | "HISTORICAL_SYNC" = "WEBHOOK") {
  const detail = await getGoodtillSaleDetails(saleId);
  return upsertGoodtillSale(detail, source);
}

const HISTORICAL_PAGE_LIMIT = 50;
const HISTORICAL_MAX_PAGES = 500; // safety cap (~25k sales)

const DEFAULT_HISTORY_LOOKBACK_MS = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years

/** Paginated backfill/reconciliation sweep. Safe to re-run — every sale is
 * upserted by its Goodtill id, so nothing is duplicated.
 *
 * `from` defaults to a 2-year lookback rather than being left unbounded:
 * despite the docs marking it optional, an omitted `from` empirically
 * returns zero results rather than "all time" — confirmed against the
 * real API, not assumed. */
export async function importGoodtillSalesHistory(options?: {
  from?: Date;
  to?: Date;
}): Promise<{ imported: number; pages: number }> {
  const from = options?.from ?? new Date(Date.now() - DEFAULT_HISTORY_LOOKBACK_MS);
  const to = options?.to ?? new Date();
  let offset = 0;
  let imported = 0;
  let pages = 0;

  while (pages < HISTORICAL_MAX_PAGES) {
    const page = await getGoodtillSalesDetailsPage({
      from,
      to,
      limit: HISTORICAL_PAGE_LIMIT,
      offset,
      includeVoided: true,
    });
    pages++;
    for (const sale of page) {
      await upsertGoodtillSale(sale, "HISTORICAL_SYNC");
      imported++;
    }
    if (page.length < HISTORICAL_PAGE_LIMIT) break;
    offset += HISTORICAL_PAGE_LIMIT;
  }

  return { imported, pages };
}

/** Full backfill entry point — runs once (idempotent if re-run). Records
 * progress on GymPosSyncState so the UI can show it happened. */
export async function runGoodtillHistoricalImport(options?: { from?: Date; to?: Date }) {
  await touchSyncState({ historicalImportStartedAt: new Date() });
  try {
    const catalog = await syncGoodtillCatalog();
    const { imported, pages } = await importGoodtillSalesHistory(options);
    await touchSyncState({
      historicalImportCompletedAt: new Date(),
      historicalImportSalesCount: imported,
      lastSalesSyncAt: new Date(),
      lastSalesSyncStatus: "OK",
      lastSalesSyncError: null,
    });
    return { ...catalog, salesImported: imported, pages };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await touchSyncState({ lastSalesSyncAt: new Date(), lastSalesSyncStatus: "ERROR", lastSalesSyncError: message });
    throw err;
  }
}

/** What the "Sync SumUp" button runs: refresh the full catalog (products
 * change more often than the whole sale history needs re-checking) and
 * reconcile a trailing window of sales in case any webhook was missed. */
export async function reconcileGoodtillSync(options?: { lookbackDays?: number }) {
  try {
    const catalog = await syncGoodtillCatalog();
    const lookbackDays = options?.lookbackDays ?? 14;
    const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const { imported } = await importGoodtillSalesHistory({ from });
    await touchSyncState({
      lastSalesSyncAt: new Date(),
      lastSalesSyncStatus: "OK",
      lastSalesSyncError: null,
      lastSalesSyncImportedCount: imported,
    });
    return { categories: catalog.categories, products: catalog.products, salesChecked: imported };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await touchSyncState({ lastSalesSyncAt: new Date(), lastSalesSyncStatus: "ERROR", lastSalesSyncError: message });
    throw err;
  }
}
