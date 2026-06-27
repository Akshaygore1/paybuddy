PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`first_name` text NOT NULL,
	`middle_name` text NOT NULL,
	`surname` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`gender` text NOT NULL,
	`designation_id` text NOT NULL,
	`seniority_rank` integer NOT NULL,
	`pan_number` text,
	`pf_number` text,
	`nps_account_number` text,
	`whats_app_number` text,
	`contact_number` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`designation_id`) REFERENCES `employee_designations`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "employees_date_of_birth_format_check" CHECK("__new_employees"."date_of_birth" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "employees_gender_check" CHECK("__new_employees"."gender" IN ('Male', 'Female'))
);
--> statement-breakpoint
INSERT INTO `__new_employees`(
	"id",
	"institution_id",
	"first_name",
	"middle_name",
	"surname",
	"date_of_birth",
	"gender",
	"designation_id",
	"seniority_rank",
	"pan_number",
	"pf_number",
	"nps_account_number",
	"whats_app_number",
	"contact_number",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"institution_id",
	"first_name",
	"middle_name",
	"surname",
	'1970-01-01',
	'Male',
	"designation_id",
	"seniority_rank",
	"pan_number",
	"pf_number",
	"nps_account_number",
	"whats_app_number",
	"contact_number",
	"created_at",
	"updated_at"
FROM `employees`;--> statement-breakpoint
DROP TABLE `employees`;--> statement-breakpoint
ALTER TABLE `__new_employees` RENAME TO `employees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `employees_institution_id_idx` ON `employees` (`institution_id`);--> statement-breakpoint
CREATE INDEX `employees_designation_id_idx` ON `employees` (`designation_id`);
