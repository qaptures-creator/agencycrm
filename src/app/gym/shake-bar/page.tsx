import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { ShakeBarList } from "./shake-bar-list";

export default async function ShakeBarPage() {
  await requireGymUser();

  const products = await prisma.gymShakeBarProduct.findMany({
    orderBy: [{ name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Shake Bar</h1>
        <p className="text-sm text-muted-foreground">Stock levels, pricing and restocking for shake bar products.</p>
      </div>
      <ShakeBarList
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          stock: p.stock,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          lowStockLevel: p.lowStockLevel,
          supplier: p.supplier,
          lastRestockedAt: p.lastRestockedAt,
        }))}
      />
    </div>
  );
}
