-- Expenses may be negative (refunds): the CHECK changes from > 0 to <> 0. SQLite can only change a
-- CHECK by rebuilding the table; nothing references expenses, and every column is copied.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paid_on` text NOT NULL,
	`vendor` text NOT NULL,
	`category_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`payment_method` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`business_pct` integer DEFAULT 100 NOT NULL,
	`receipt_path` text,
	`client_id` integer,
	`payee_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payee_id`) REFERENCES `payees`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "expenses_nonzero" CHECK("__new_expenses"."amount_cents" <> 0),
	CONSTRAINT "expenses_business_pct" CHECK("__new_expenses"."business_pct" between 1 and 100)
);
--> statement-breakpoint
INSERT INTO `__new_expenses`("id", "paid_on", "vendor", "category_id", "amount_cents", "payment_method", "description", "business_pct", "receipt_path", "client_id", "payee_id", "created_at", "updated_at") SELECT "id", "paid_on", "vendor", "category_id", "amount_cents", "payment_method", "description", "business_pct", "receipt_path", "client_id", "payee_id", "created_at", "updated_at" FROM `expenses`;--> statement-breakpoint
DROP TABLE `expenses`;--> statement-breakpoint
ALTER TABLE `__new_expenses` RENAME TO `expenses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `expenses_paid_idx` ON `expenses` (`paid_on`);--> statement-breakpoint
CREATE INDEX `expenses_category_idx` ON `expenses` (`category_id`);