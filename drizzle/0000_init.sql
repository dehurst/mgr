CREATE TABLE `business_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_name` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`logo_path` text,
	`default_terms_days` integer DEFAULT 15 NOT NULL,
	`invoice_prefix` text DEFAULT 'INV-' NOT NULL,
	`next_invoice_number` integer DEFAULT 1001 NOT NULL,
	`payment_instructions` text DEFAULT '' NOT NULL,
	`invoice_email_subject` text DEFAULT '' NOT NULL,
	`invoice_email_body` text DEFAULT '' NOT NULL,
	`reminder_email_subject` text DEFAULT '' NOT NULL,
	`reminder_email_body` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("business_settings"."id" = 1),
	CONSTRAINT "settings_terms" CHECK("business_settings"."default_terms_days" >= 0),
	CONSTRAINT "settings_next_number" CHECK("business_settings"."next_invoice_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`billing_address` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`schedule_c_line` text NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_categories_name_unique` ON `expense_categories` (`name`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paid_on` text NOT NULL,
	`vendor` text NOT NULL,
	`category_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`payment_method` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`receipt_path` text,
	`client_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "expenses_positive" CHECK("expenses"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `expenses_paid_idx` ON `expenses` (`paid_on`);--> statement-breakpoint
CREATE INDEX `expenses_category_idx` ON `expenses` (`category_id`);--> statement-breakpoint
CREATE TABLE `invoice_line_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "line_items_qty" CHECK("invoice_line_items"."quantity_milli" >= 0)
);
--> statement-breakpoint
CREATE INDEX `line_items_invoice_idx` ON `invoice_line_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`client_id` integer NOT NULL,
	`issued_on` text NOT NULL,
	`due_on` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`sent_at` text,
	`voided_at` text,
	`void_reason` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "invoices_due_after_issue" CHECK("invoices"."due_on" >= "invoices"."issued_on")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE INDEX `invoices_client_idx` ON `invoices` (`client_id`);--> statement-breakpoint
CREATE INDEX `invoices_issued_idx` ON `invoices` (`issued_on`);--> statement-breakpoint
CREATE TABLE `other_income` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`received_on` text NOT NULL,
	`source` text NOT NULL,
	`client_id` integer,
	`amount_cents` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`voided_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "other_income_positive" CHECK("other_income"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `other_income_received_idx` ON `other_income` (`received_on`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`received_on` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`voided_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_positive" CHECK("payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payments_received_idx` ON `payments` (`received_on`);