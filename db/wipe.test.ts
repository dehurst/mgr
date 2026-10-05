import { eq, ne } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { openDb } from "@/db";
import { businessSettings, expenseCategories } from "@/db/schema";
import { PERSONAL_LINE } from "@/lib/schedule-c";
import { hasData, seedDemo } from "./seed";
import { wipeData } from "./wipe";

describe("wipeData", () => {
  it("removes every record and restores fresh-install settings and categories", () => {
    const db = openDb(":memory:");
    const fresh = db.select().from(expenseCategories).all().length;
    seedDemo(db, "2026-10-05");
    const someCategory = db.select().from(expenseCategories).where(ne(expenseCategories.scheduleCLine, PERSONAL_LINE)).get()!;
    db.update(expenseCategories).set({ name: "Renamed" }).where(eq(expenseCategories.id, someCategory.id)).run();
    expect(hasData(db)).toBe(true);

    wipeData(db);
    expect(hasData(db)).toBe(false);
    const cats = db.select().from(expenseCategories).all();
    expect(cats).toHaveLength(fresh);
    expect(cats.some((c) => c.scheduleCLine === PERSONAL_LINE)).toBe(true);
    expect(cats.some((c) => c.name === "Renamed")).toBe(false);
    expect(db.select().from(businessSettings).get()?.businessName).toBe("");
    // Seeding works again afterward.
    seedDemo(db, "2026-10-05");
    expect(hasData(db)).toBe(true);
  });
});
