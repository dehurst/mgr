"use server";

import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { businessSettings, expenseCategories, invoices } from "@/db/schema";
import { file, int, looksLikeEmail, str, type ActionState, type FieldErrors } from "@/lib/form";
import { isScheduleCLine } from "@/lib/schedule-c";
import { getSettings } from "@/lib/settings";
import { deleteUpload, IMAGE_TYPES, saveUpload } from "@/lib/uploads";

export async function updateSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const errors: FieldErrors = {};
  const businessName = str(fd, "businessName");
  const email = str(fd, "email");
  const defaultTermsDays = int(fd, "defaultTermsDays");
  const invoicePrefix = str(fd, "invoicePrefix");
  const nextInvoiceNumber = int(fd, "nextInvoiceNumber");

  if (!businessName) errors.businessName = "Required.";
  if (email && !looksLikeEmail(email)) errors.email = "Doesn't look like an email address.";
  if (defaultTermsDays === null || defaultTermsDays > 365) errors.defaultTermsDays = "Enter 0–365 days.";
  if (!/^[A-Za-z0-9_\-/.#]{0,12}$/.test(invoicePrefix))
    errors.invoicePrefix = "Up to 12 letters, digits, or - _ / . #";
  if (nextInvoiceNumber === null || nextInvoiceNumber < 1) errors.nextInvoiceNumber = "Enter a whole number ≥ 1.";

  const db = getDb();
  if (nextInvoiceNumber !== null && !errors.invoicePrefix) {
    const clash = db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.number, `${invoicePrefix}${nextInvoiceNumber}`))
      .get();
    if (clash) errors.nextInvoiceNumber = `${invoicePrefix}${nextInvoiceNumber} already exists. Pick a higher number.`;
  }

  const current = getSettings();
  let logoPath = current.logoPath;
  const logo = file(fd, "logo");
  if (logo && Object.keys(errors).length === 0) {
    const saved = await saveUpload(logo, "logo", IMAGE_TYPES);
    if (!saved.ok) errors.logo = `${saved.error} Use PNG or JPEG.`;
    else logoPath = saved.relPath;
  } else if (str(fd, "removeLogo") === "on") {
    logoPath = null;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, message: "Please fix the highlighted fields." };

  db.update(businessSettings)
    .set({
      businessName,
      address: str(fd, "address"),
      email,
      phone: str(fd, "phone"),
      logoPath,
      defaultTermsDays: defaultTermsDays!,
      invoicePrefix,
      nextInvoiceNumber: nextInvoiceNumber!,
      paymentInstructions: str(fd, "paymentInstructions"),
    })
    .where(eq(businessSettings.id, 1))
    .run();

  if (current.logoPath && current.logoPath !== logoPath) await deleteUpload(current.logoPath);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

function categoryFields(fd: FormData): { name: string; scheduleCLine: string; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = str(fd, "name");
  const scheduleCLine = str(fd, "scheduleCLine");
  if (!name) errors.name = "Name is required.";
  else if (name.length > 60) errors.name = "Keep it under 60 characters.";
  if (!isScheduleCLine(scheduleCLine)) errors.scheduleCLine = "Pick a Schedule C line.";
  return { name, scheduleCLine, errors };
}

function nameTaken(name: string, exceptId?: number): boolean {
  const db = getDb();
  const rows = db
    .select({ id: expenseCategories.id, name: expenseCategories.name })
    .from(expenseCategories)
    .where(exceptId ? ne(expenseCategories.id, exceptId) : undefined)
    .all();
  return rows.some((r) => r.name.toLowerCase() === name.toLowerCase());
}

export async function createCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { name, scheduleCLine, errors } = categoryFields(fd);
  if (!errors.name && nameTaken(name)) errors.name = "A category with that name already exists.";
  if (Object.keys(errors).length) return { ok: false, errors };
  getDb().insert(expenseCategories).values({ name, scheduleCLine }).run();
  revalidatePath("/settings/categories");
  return { ok: true, message: `Added “${name}”.` };
}

export async function updateCategory(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { name, scheduleCLine, errors } = categoryFields(fd);
  if (!errors.name && nameTaken(name, id)) errors.name = "A category with that name already exists.";
  if (Object.keys(errors).length) return { ok: false, errors };
  getDb().update(expenseCategories).set({ name, scheduleCLine }).where(eq(expenseCategories.id, id)).run();
  revalidatePath("/settings/categories");
  return { ok: true, message: "Saved." };
}

export async function setCategoryArchived(id: number, archived: boolean): Promise<void> {
  getDb()
    .update(expenseCategories)
    .set({ archivedAt: archived ? new Date().toISOString() : null })
    .where(eq(expenseCategories.id, id))
    .run();
  revalidatePath("/settings/categories");
}
