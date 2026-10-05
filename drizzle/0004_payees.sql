CREATE TABLE `payees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`business_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`tax_classification` text,
	`is_attorney` integer DEFAULT false NOT NULL,
	`tin_type` text,
	`tin_last4` text,
	`w9_received_on` text,
	`notes` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "payees_tin_last4" CHECK("payees"."tin_last4" is null or (length("payees"."tin_last4") = 4 and "payees"."tin_last4" not glob '*[^0-9]*'))
);
--> statement-breakpoint
ALTER TABLE `business_settings` ADD `tax_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `payee_id` integer REFERENCES payees(id);