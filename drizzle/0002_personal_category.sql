-- Add a "Personal (not business)" category once. Its line is 'personal', which every report
-- excludes from business expenses. Skipped if a category with that name already exists.
INSERT INTO `expense_categories` (`name`, `schedule_c_line`, `created_at`, `updated_at`)
SELECT 'Personal (not business)', 'personal', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM `expense_categories` WHERE `name` = 'Personal (not business)');
