"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { projectSchema, type ProjectInput } from "@/lib/validators";

function toData(data: ReturnType<typeof projectSchema.parse>) {
  return {
    name: data.name,
    clientId: data.clientId,
    shootDate: data.shootDate,
    shootTime: data.shootTime,
    shootLocation: data.shootLocation,
    projectType: data.projectType,
    videographerId: data.videographerId || null,
    photographerId: data.photographerId || null,
    editorId: data.editorId || null,
    status: data.status,
    deadline: data.deadline,
    internalNotes: data.internalNotes,
    clientNotes: data.clientNotes,
  };
}

export async function createProject(input: ProjectInput) {
  const data = projectSchema.parse(input);
  const project = await prisma.project.create({ data: toData(data) });
  revalidatePath("/projects");
  revalidatePath("/calendar");
  revalidatePath(`/clients/${data.clientId}`);
  revalidatePath("/");
  return project;
}

export async function updateProject(id: string, input: ProjectInput) {
  const data = projectSchema.parse(input);
  const project = await prisma.project.update({ where: { id }, data: toData(data) });
  revalidatePath("/projects");
  revalidatePath("/calendar");
  revalidatePath(`/clients/${data.clientId}`);
  revalidatePath("/");
  return project;
}

export async function updateProjectStatus(id: string, status: string) {
  const project = await prisma.project.update({ where: { id }, data: { status } });
  revalidatePath("/projects");
  revalidatePath(`/clients/${project.clientId}`);
  revalidatePath("/");
  return project;
}

export async function deleteProject(id: string) {
  const project = await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  revalidatePath("/calendar");
  revalidatePath(`/clients/${project.clientId}`);
  revalidatePath("/");
}
