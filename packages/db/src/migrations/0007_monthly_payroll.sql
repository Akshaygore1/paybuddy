CREATE TABLE `employee_payroll_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`financial_year_start` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "employee_payroll_profiles_financial_year_start_check" CHECK("employee_payroll_profiles"."financial_year_start" BETWEEN 2023 AND 2028)
);
--> statement-breakpoint
CREATE INDEX `employee_payroll_profiles_institution_id_idx` ON `employee_payroll_profiles` (`institution_id`);--> statement-breakpoint
CREATE INDEX `employee_payroll_profiles_employee_id_idx` ON `employee_payroll_profiles` (`employee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_payroll_profiles_employee_fy_unique` ON `employee_payroll_profiles` (`employee_id`,`financial_year_start`);--> statement-breakpoint
CREATE TABLE `payroll_custom_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`section` text NOT NULL,
	`label` text NOT NULL,
	`key` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "payroll_custom_field_definitions_section_check" CHECK("payroll_custom_field_definitions"."section" IN ('earnings', 'deductions'))
);
--> statement-breakpoint
CREATE INDEX `payroll_custom_field_definitions_institution_id_idx` ON `payroll_custom_field_definitions` (`institution_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_custom_field_definitions_institution_key_unique` ON `payroll_custom_field_definitions` (`institution_id`,`key`);--> statement-breakpoint
CREATE TABLE `payroll_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_profile_id` text NOT NULL,
	`section` text NOT NULL,
	`fixed_field_key` text,
	`custom_field_definition_id` text,
	`label` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`payroll_profile_id`) REFERENCES `employee_payroll_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_field_definition_id`) REFERENCES `payroll_custom_field_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payroll_line_items_section_check" CHECK("payroll_line_items"."section" IN ('earnings', 'deductions')),
	CONSTRAINT "payroll_line_items_amount_paise_check" CHECK("payroll_line_items"."amount_paise" >= 0),
	CONSTRAINT "payroll_line_items_source_check" CHECK(("payroll_line_items"."fixed_field_key" IS NOT NULL AND "payroll_line_items"."custom_field_definition_id" IS NULL) OR ("payroll_line_items"."fixed_field_key" IS NULL AND "payroll_line_items"."custom_field_definition_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `payroll_line_items_profile_id_idx` ON `payroll_line_items` (`payroll_profile_id`);--> statement-breakpoint
CREATE INDEX `payroll_line_items_custom_field_definition_id_idx` ON `payroll_line_items` (`custom_field_definition_id`);