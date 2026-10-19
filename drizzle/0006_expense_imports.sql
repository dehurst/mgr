-- Statement imports: one row per import, and each imported expense points at its import (undo).
CREATE TABLE `expense_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `import_id` integer REFERENCES expense_imports(id) ON DELETE SET NULL;