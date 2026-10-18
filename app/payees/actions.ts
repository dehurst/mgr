"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { payees } from "@/db/schema";
import { str, type ActionState } from "@/lib/form";
import { deletePayee, parsePayeeForm } from "@/lib/payees";

export async function savePayee(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parsePayeeForm({
    name: str(fd, "name"),
    businessName: str(fd, "businessName"),
    email: str(fd, "email"),
    address: str(fd, "address"),
    taxClassification: str(fd, "taxClassification"),
    isAttorney: str(fd, "isAttorney"),
    tinType: str(fd, "tinType"),
    tinLast4: str(fd, "tinLast4"),
    w9ReceivedOn: str(fd, "w9ReceivedOn"),
    notes: str(fd, "notes"),
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors, message: "Please fix the highlighted fields." };

  const db = await getDb();
  let payeeId = id;
  if (id) {
    await db.update(payees).set(parsed.input).where(eq(payees.id, id)).run();
  } else {
    payeeId = (await db.insert(payees).values(parsed.input).returning({ id: payees.id }).get()).id;
  }
  revalidatePath("/", "layout");
  redirect(`/payees/${payeeId}`);
}

export async function setPayeeArchived(id: number, archived: boolean): Promise<void> {
  await (await getDb())
    .update(payees)
    .set({ archivedAt: archived ? new Date().toISOString() : null })
    .where(eq(payees.id, id))
    .run();
  revalidatePath("/", "layout");
}

export async function removePayee(id: number): Promise<string | void> {
  const r = await deletePayee(await getDb(), id);
  if (!r.ok) return r.error;
  revalidatePath("/", "layout");
  redirect("/payees");
}
