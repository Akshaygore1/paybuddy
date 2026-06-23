PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`first_name` text NOT NULL DEFAULT '',
	`middle_name` text NOT NULL DEFAULT '',
	`surname` text NOT NULL DEFAULT '',
	`designation_id` text NOT NULL,
	`seniority_rank` integer DEFAULT 999999 NOT NULL,
	`pan_number` text,
	`pf_number` text,
	`nps_account_number` text,
	`whats_app_number` text,
	`contact_number` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`designation_id`) REFERENCES `employee_designations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_employees` (
	`id`,
	`institution_id`,
	`first_name`,
	`middle_name`,
	`surname`,
	`designation_id`,
	`seniority_rank`,
	`pan_number`,
	`pf_number`,
	`nps_account_number`,
	`whats_app_number`,
	`contact_number`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`institution_id`,
	CASE
		WHEN trim(coalesce(`full_name`, '')) = '' THEN ''
		WHEN instr(trim(`full_name`), ' ') = 0 THEN trim(`full_name`)
		ELSE substr(trim(`full_name`), 1, instr(trim(`full_name`), ' ') - 1)
	END,
	CASE
		WHEN trim(coalesce(`full_name`, '')) = '' THEN ''
		WHEN instr(trim(`full_name`), ' ') = 0 THEN ''
		WHEN instr(substr(trim(`full_name`), instr(trim(`full_name`), ' ') + 1), ' ') = 0 THEN ''
		ELSE substr(
			substr(trim(`full_name`), instr(trim(`full_name`), ' ') + 1),
			1,
			instr(substr(trim(`full_name`), instr(trim(`full_name`), ' ') + 1), ' ') - 1
		)
	END,
	CASE
		WHEN trim(coalesce(`full_name`, '')) = '' THEN ''
		WHEN instr(trim(`full_name`), ' ') = 0 THEN ''
		WHEN instr(substr(trim(`full_name`), instr(trim(`full_name`), ' ') + 1), ' ') = 0 THEN substr(trim(`full_name`), instr(trim(`full_name`), ' ') + 1)
		ELSE substr(
			substr(trim(`full_name`), instr(trim(`full_name`), ' ') + 1),
			instr(substr(trim(`full_name`), instr(trim(`full_name`), ' ') + 1), ' ') + 1
		)
	END,
	`designation_id`,
	`seniority_rank`,
	`pan_number`,
	`pf_number`,
	`nps_account_number`,
	`whats_app_number`,
	`contact_number`,
	`created_at`,
	`updated_at`
FROM `employees`;
--> statement-breakpoint
DROP TABLE `employees`;
--> statement-breakpoint
ALTER TABLE `__new_employees` RENAME TO `employees`;
--> statement-breakpoint
CREATE INDEX `employees_institution_id_idx` ON `employees` (`institution_id`);
--> statement-breakpoint
CREATE INDEX `employees_designation_id_idx` ON `employees` (`designation_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
