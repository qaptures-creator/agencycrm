import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { EquipmentList } from "./equipment-list";

export default async function EquipmentPage() {
  await requireGymUser();

  const equipment = await prisma.gymEquipment.findMany({
    orderBy: [{ name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Equipment</h1>
        <p className="text-sm text-muted-foreground">Machine register, service history and fault reporting.</p>
      </div>
      <EquipmentList
        equipment={equipment.map((e) => ({
          id: e.id,
          name: e.name,
          manufacturer: e.manufacturer,
          model: e.model,
          category: e.category,
          serialNumber: e.serialNumber,
          purchaseDate: e.purchaseDate,
          condition: e.condition,
          lastServiceDate: e.lastServiceDate,
          nextServiceDate: e.nextServiceDate,
          location: e.location,
          notes: e.notes,
          photoUrl: e.photoUrl,
        }))}
      />
    </div>
  );
}
