import type { Db } from "./index";
import { ensureDefaults } from "./defaults";
import * as schema from "./schema";
import { PERSONAL_CATEGORY_NAME, PERSONAL_LINE } from "@/lib/schedule-c";

/**
 * Delete every record and put back a fresh install's settings and categories (including the
 * personal category, which a migration normally adds). Uploaded files are not touched.
 */
export function wipeData(db: Db): void {
  db.transaction((tx) => {
    // Children before parents, for the foreign keys.
    for (const t of [
      schema.payments,
      schema.invoiceLineItems,
      schema.invoices,
      schema.otherIncome,
      schema.expenses,
      schema.payees,
      schema.clients,
      schema.expenseCategories,
      schema.businessSettings,
    ]) {
      tx.delete(t).run();
    }
    tx.insert(schema.expenseCategories).values({ name: PERSONAL_CATEGORY_NAME, scheduleCLine: PERSONAL_LINE }).run();
  });
  ensureDefaults(db);
}
