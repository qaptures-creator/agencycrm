"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { shakeBarProductSchema, type ShakeBarProductInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";

async function notifyIfLowStock(product: { id: string; name: string; stock: number; lowStockLevel: number }) {
  if (product.stock <= product.lowStockLevel) {
    await notifyManagement({
      type: "LOW_STOCK",
      title: `Low stock — ${product.name}`,
      body: `${product.stock} left (threshold ${product.lowStockLevel})`,
      link: "/gym/shake-bar",
    });
  }
}

export async function createShakeBarProductAction(input: ShakeBarProductInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = shakeBarProductSchema.parse(input);

  const product = await prisma.gymShakeBarProduct.create({
    data: {
      name: data.name,
      category: data.category,
      stock: data.stock ?? 0,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      lowStockLevel: data.lowStockLevel ?? 5,
      supplier: data.supplier,
    },
  });

  await logAudit({ userId: user.id, action: "SHAKE_BAR_PRODUCT_CREATED", entityType: "GymShakeBarProduct", entityId: product.id });
  revalidatePath("/gym/shake-bar");
  await notifyIfLowStock(product);
  return product;
}

export async function updateShakeBarProductAction(id: string, input: ShakeBarProductInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = shakeBarProductSchema.parse(input);

  const product = await prisma.gymShakeBarProduct.update({
    where: { id },
    data: {
      name: data.name,
      category: data.category,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      lowStockLevel: data.lowStockLevel ?? 5,
      supplier: data.supplier,
    },
  });

  await logAudit({ userId: user.id, action: "SHAKE_BAR_PRODUCT_UPDATED", entityType: "GymShakeBarProduct", entityId: id });
  revalidatePath("/gym/shake-bar");
  return product;
}

/** Restock quick action — increases stock and stamps lastRestockedAt. */
export async function restockProductAction(productId: string, quantity: number, note?: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be a positive number");

  const product = await prisma.gymShakeBarProduct.findUniqueOrThrow({ where: { id: productId } });

  const [updated] = await prisma.$transaction([
    prisma.gymShakeBarProduct.update({
      where: { id: productId },
      data: { stock: product.stock + quantity, lastRestockedAt: new Date() },
    }),
    prisma.gymInventoryTransaction.create({
      data: { productId, type: "RESTOCK", quantity, note: note?.trim() || undefined, createdById: user.id },
    }),
  ]);

  await logAudit({ userId: user.id, action: "SHAKE_BAR_RESTOCKED", entityType: "GymShakeBarProduct", entityId: productId, metadata: { quantity } });
  revalidatePath("/gym/shake-bar");
  return updated;
}

/** Record Sale / Adjustment quick action. For SALE, `quantity` is units sold
 * (stock decreases, floored at 0). For ADJUSTMENT, `quantity` is an arbitrary
 * signed delta applied directly to stock (also floored at 0). */
export async function recordStockActivityAction(
  productId: string,
  type: "SALE" | "ADJUSTMENT",
  quantity: number,
  note?: string
) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (!Number.isFinite(quantity) || quantity === 0) throw new Error("Enter a non-zero quantity");
  if (type === "SALE" && quantity < 0) throw new Error("Sale quantity must be positive");

  const product = await prisma.gymShakeBarProduct.findUniqueOrThrow({ where: { id: productId } });

  const rawDelta = type === "SALE" ? -Math.abs(quantity) : quantity;
  const newStock = Math.max(0, product.stock + rawDelta);
  const appliedDelta = newStock - product.stock;

  const [updated] = await prisma.$transaction([
    prisma.gymShakeBarProduct.update({ where: { id: productId }, data: { stock: newStock } }),
    prisma.gymInventoryTransaction.create({
      data: { productId, type, quantity: appliedDelta, note: note?.trim() || undefined, createdById: user.id },
    }),
  ]);

  await logAudit({
    userId: user.id,
    action: type === "SALE" ? "SHAKE_BAR_SALE_RECORDED" : "SHAKE_BAR_ADJUSTMENT_RECORDED",
    entityType: "GymShakeBarProduct",
    entityId: productId,
    metadata: { quantity: appliedDelta },
  });
  revalidatePath("/gym/shake-bar");
  await notifyIfLowStock(updated);
  return updated;
}
