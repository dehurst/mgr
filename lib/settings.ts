import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businessSettings, type BusinessSettings } from "@/db/schema";

export function getSettings(): BusinessSettings {
  const row = getDb().select().from(businessSettings).where(eq(businessSettings.id, 1)).get();
  if (!row) throw new Error("Settings row missing; database was not initialized.");
  return row;
}
