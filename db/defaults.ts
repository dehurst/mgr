import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { ne } from "drizzle-orm";
import { DEFAULT_CATEGORIES, PERSONAL_LINE } from "@/lib/schedule-c";
import * as schema from "./schema";

export const DEFAULT_INVOICE_EMAIL_SUBJECT = "Invoice {{invoice_number}} from {{business_name}}";
export const DEFAULT_INVOICE_EMAIL_BODY = `Hi {{client_contact}},

Attached is invoice {{invoice_number}} for {{amount_due}}, due {{due_date}}.

{{payment_instructions}}

Thank you,
{{business_name}}`;

export const DEFAULT_REMINDER_EMAIL_SUBJECT = "Reminder: invoice {{invoice_number}} is past due";
export const DEFAULT_REMINDER_EMAIL_BODY = `Hi {{client_contact}},

A friendly reminder that invoice {{invoice_number}} had a balance of {{amount_due}} due on {{due_date}}. A copy is attached.

{{payment_instructions}}

Thank you,
{{business_name}}`;

/**
 * Idempotent. Creates the settings row if missing, and seeds expense categories only when the
 * table is empty (so renamed/archived categories are never re-added).
 */
export function ensureDefaults(db: BetterSQLite3Database<typeof schema>): void {
  db.transaction((tx) => {
    tx.insert(schema.businessSettings)
      .values({
        id: 1,
        invoiceEmailSubject: DEFAULT_INVOICE_EMAIL_SUBJECT,
        invoiceEmailBody: DEFAULT_INVOICE_EMAIL_BODY,
        reminderEmailSubject: DEFAULT_REMINDER_EMAIL_SUBJECT,
        reminderEmailBody: DEFAULT_REMINDER_EMAIL_BODY,
      })
      .onConflictDoNothing()
      .run();

    // The personal category is added by a migration, so ignore it when deciding whether to seed.
    const anyCategory = tx
      .select({ id: schema.expenseCategories.id })
      .from(schema.expenseCategories)
      .where(ne(schema.expenseCategories.scheduleCLine, PERSONAL_LINE))
      .limit(1)
      .get();
    if (!anyCategory) {
      tx.insert(schema.expenseCategories)
        .values(DEFAULT_CATEGORIES.map((c) => ({ name: c.name, scheduleCLine: c.scheduleCLine })))
        .run();
    }
  });
}
