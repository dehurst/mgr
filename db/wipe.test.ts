import { eq, ne } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { openDb } from "@/db";
import { businessSettings, expenseCategories } from "@/db/schema";
import { PERSONAL_LINE } from "@/lib/schedule-c";
import { hasData, seedDemo } from "./seed";
import { wipeData } from "./wipe";

describe("wipeData", () => {
  it("removes every record and restores fresh-install settings and categories", async () => {
    const db = await openDb(":memory:");
    const fresh = (await db.select().from(expenseCategories).all()).length;
    await seedDemo(db, "2026-10-05");
    const someCategory = (await db.select().from(expenseCategories).where(ne(expenseCategories.scheduleCLine, PERSONAL_LINE)).get())!;
    await db.update(expenseCategories).set({ name: "Renamed" }).where(eq(expenseCategories.id, someCategory.id)).run();
    expect(await hasData(db)).toBe(true);

    await wipeData(db);
    expect(await hasData(db)).toBe(false);
    const cats = await db.select().from(expenseCategories).all();
    expect(cats).toHaveLength(fresh);
    expect(cats.some((c) => c.scheduleCLine === PERSONAL_LINE)).toBe(true);
    expect(cats.some((c) => c.name === "Renamed")).toBe(false);
    expect((await db.select().from(businessSettings).get())?.businessName).toBe("");
    // Seeding works again afterward.
    await seedDemo(db, "2026-10-05");
    expect(await hasData(db)).toBe(true);
  });
});
