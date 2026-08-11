"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { uploadClientDocument } from "@/lib/microsoft-graph";

export async function uploadDocument(formData: FormData) {
  const clientId = formData.get("clientId") as string;
  const category = (formData.get("category") as string) || "OTHER";
  const file = formData.get("file") as File | null;

  if (!clientId || !file) throw new Error("Missing client or file");

  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploaded = await uploadClientDocument(client.companyName, file.name, buffer, file.type);

  const document = await prisma.document.create({
    data: {
      name: file.name,
      category,
      driveItemId: uploaded.driveItemId,
      webUrl: uploaded.webUrl,
      mimeType: file.type,
      size: uploaded.size,
      clientId,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
  return document;
}

export async function deleteDocument(id: string) {
  const document = await prisma.document.delete({ where: { id } });
  revalidatePath(`/clients/${document.clientId}`);
  revalidatePath("/");
}

export async function getRecentDocuments(limit = 8) {
  return prisma.document.findMany({
    orderBy: { uploadedAt: "desc" },
    take: limit,
    include: { client: true },
  });
}
