CREATE TABLE `employee_payroll_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_profile_id` text NOT NULL,
	`effective_month` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`payroll_profile_id`) REFERENCES `employee_payroll_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "employee_payroll_versions_effective_month_check" CHECK("employee_payroll_versions"."effective_month" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]')
);
--> statement-breakpoint
CREATE INDEX `employee_payroll_versions_profile_id_idx` ON `employee_payroll_versions` (`payroll_profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_payroll_versions_profile_month_unique` ON `employee_payroll_versions` (`payroll_profile_id`,`effective_month`);--> statement-breakpoint
CREATE TABLE `payroll_custom_field_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`custom_field_definition_id` text NOT NULL,
	`effective_from_month` text NOT NULL,
	`effective_to_month` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`custom_field_definition_id`) REFERENCES `payroll_custom_field_definitions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "payroll_custom_field_periods_from_month_check" CHECK("payroll_custom_field_periods"."effective_from_month" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
	CONSTRAINT "payroll_custom_field_periods_to_month_check" CHECK("payroll_custom_field_periods"."effective_to_month" IS NULL OR "payroll_custom_field_periods"."effective_to_month" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
	CONSTRAINT "payroll_custom_field_periods_range_check" CHECK("payroll_custom_field_periods"."effective_to_month" IS NULL OR "payroll_custom_field_periods"."effective_to_month" > "payroll_custom_field_periods"."effective_from_month")
);
--> statement-breakpoint
CREATE INDEX `payroll_custom_field_periods_definition_id_idx` ON `payroll_custom_field_periods` (`custom_field_definition_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_custom_field_periods_definition_from_unique` ON `payroll_custom_field_periods` (`custom_field_definition_id`,`effective_from_month`);--> statement-breakpoint
INSERT INTO `employee_payroll_versions` (`id`, `payroll_profile_id`, `effective_month`)
SELECT 'legacy-' || `id`, `id`, printf('%04d-04', `financial_year_start`)
FROM `employee_payroll_profiles`;--> statement-breakpoint
INSERT INTO `payroll_custom_field_periods` (`id`, `custom_field_definition_id`, `effective_from_month`)
SELECT
	'legacy-' || definitions.`id`,
	definitions.`id`,
	MIN(
		strftime('%Y-%m', definitions.`created_at` / 1000, 'unixepoch'),
		COALESCE(
			(
				SELECT MIN(printf('%04d-04', profiles.`financial_year_start`))
				FROM `payroll_line_items` items
				INNER JOIN `employee_payroll_profiles` profiles ON profiles.`id` = items.`payroll_profile_id`
				WHERE items.`custom_field_definition_id` = definitions.`id`
			),
			strftime('%Y-%m', definitions.`created_at` / 1000, 'unixepoch')
		)
	)
FROM `payroll_custom_field_definitions` definitions
WHERE definitions.`is_active` = 1;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payroll_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_version_id` text NOT NULL,
	`section` text NOT NULL,
	`fixed_field_key` text,
	`custom_field_definition_id` text,
	`label` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`payroll_version_id`) REFERENCES `employee_payroll_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_field_definition_id`) REFERENCES `payroll_custom_field_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payroll_line_items_section_check" CHECK("section" IN ('earnings', 'deductions')),
	CONSTRAINT "payroll_line_items_amount_paise_check" CHECK("amount_paise" >= 0),
	CONSTRAINT "payroll_line_items_source_check" CHECK(("fixed_field_key" IS NOT NULL AND "custom_field_definition_id" IS NULL) OR ("fixed_field_key" IS NULL AND "custom_field_definition_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_payroll_line_items`("id", "payroll_version_id", "section", "fixed_field_key", "custom_field_definition_id", "label", "amount_paise", "sort_order", "created_at", "updated_at") SELECT "id", 'legacy-' || "payroll_profile_id", "section", "fixed_field_key", "custom_field_definition_id", "label", "amount_paise", "sort_order", "created_at", "updated_at" FROM `payroll_line_items`;--> statement-breakpoint
DROP TABLE `payroll_line_items`;--> statement-breakpoint
ALTER TABLE `__new_payroll_line_items` RENAME TO `payroll_line_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `payroll_line_items_version_id_idx` ON `payroll_line_items` (`payroll_version_id`);--> statement-breakpoint
CREATE INDEX `payroll_line_items_custom_field_definition_id_idx` ON `payroll_line_items` (`custom_field_definition_id`);
