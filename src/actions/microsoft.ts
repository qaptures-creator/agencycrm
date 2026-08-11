"use server";

import { revalidatePath } from "next/cache";
import { disconnectMicrosoft, getConnection } from "@/lib/microsoft-auth";

export async function getMicrosoftConnectionStatus() {
  const connection = await getConnection();
  return connection ? { connected: true as const, email: connection.email } : { connected: false as const };
}

export async function disconnectMicrosoftAction() {
  await disconnectMicrosoft();
  revalidatePath("/settings");
  revalidatePath("/");
}
