-- Hand-written: drizzle-kit generated a table rebuild here that would fail on existing data.
-- ADD COLUMN keeps every row, defaulting to 100% business.
ALTER TABLE `expense_categories` ADD `business_pct` integer DEFAULT 100 NOT NULL CHECK (`business_pct` between 1 and 100);--> statement-breakpoint
ALTER TABLE `expenses` ADD `business_pct` integer DEFAULT 100 NOT NULL CHECK (`business_pct` between 1 and 100);
