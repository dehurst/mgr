"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { deleteClient, parseClientForm } from "@/lib/clients";
import { str, type ActionState } from "@/lib/form";

export async function saveClient(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseClientForm({
    name: str(fd, "name"),
    contactName: str(fd, "contactName"),
    email: str(fd, "email"),
    billingAddress: str(fd, "billingAddress"),
    defaultRateCents: str(fd, "defaultRateCents"),
    notes: str(fd, "notes"),
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors, message: "Please fix the highlighted fields." };

  const db = getDb();
  let clientId = id;
  if (id) {
    db.update(clients).set(parsed.input).where(eq(clients.id, id)).run();
  } else {
    clientId = db.insert(clients).values(parsed.input).returning({ id: clients.id }).get().id;
  }
  revalidatePath("/", "layout");
  redirect(`/clients/${clientId}`);
}

export async function setClientArchived(id: number, archived: boolean): Promise<void> {
  getDb()
    .update(clients)
    .set({ archivedAt: archived ? new Date().toISOString() : null })
    .where(eq(clients.id, id))
    .run();
  revalidatePath("/", "layout");
}

export async function removeClient(id: number): Promise<string | void> {
  const r = deleteClient(getDb(), id);
  if (!r.ok) return r.error;
  revalidatePath("/", "layout");
  redirect("/clients");
}
