"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { otherIncome } from "@/db/schema";
import { today } from "@/lib/dates";
import { str, type ActionState } from "@/lib/form";
import { parseOtherIncomeForm } from "@/lib/other-income";

export async function saveOtherIncome(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseOtherIncomeForm(
    {
      receivedOn: str(fd, "receivedOn"),
      source: str(fd, "source"),
      clientId: str(fd, "clientId"),
      amount: str(fd, "amount"),
      notes: str(fd, "notes"),
    },
    today(),
  );
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const db = getDb();
  if (id) {
    db.update(otherIncome).set(parsed.input).where(eq(otherIncome.id, id)).run();
    revalidatePath("/", "layout");
    redirect("/income");
  }
  db.insert(otherIncome).values(parsed.input).run();
  revalidatePath("/", "layout");
  return { ok: true, message: `Added ${parsed.input.source}.` };
}

export async function deleteOtherIncome(id: number): Promise<string | void> {
  getDb().delete(otherIncome).where(eq(otherIncome.id, id)).run();
  revalidatePath("/", "layout");
  redirect("/income");
}
