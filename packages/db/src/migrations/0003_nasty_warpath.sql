CREATE TABLE `employee_custom_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`label` text NOT NULL,
	`key` text NOT NULL,
	`is_required` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `employee_custom_field_definitions_institution_id_idx` ON `employee_custom_field_definitions` (`institution_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_custom_field_definitions_institution_key_unique` ON `employee_custom_field_definitions` (`institution_id`,`key`);--> statement-breakpoint
CREATE TABLE `employee_custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`field_definition_id` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_definition_id`) REFERENCES `employee_custom_field_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `employee_custom_field_values_employee_id_idx` ON `employee_custom_field_values` (`employee_id`);--> statement-breakpoint
CREATE INDEX `employee_custom_field_values_field_definition_id_idx` ON `employee_custom_field_values` (`field_definition_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_custom_field_values_employee_field_unique` ON `employee_custom_field_values` (`employee_id`,`field_definition_id`);--> statement-breakpoint
CREATE TABLE `employee_designations` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `employee_designations_institution_id_idx` ON `employee_designations` (`institution_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`full_name` text NOT NULL,
	`designation_id` text NOT NULL,
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
CREATE INDEX `employees_institution_id_idx` ON `employees` (`institution_id`);--> statement-breakpoint
CREATE INDEX `employees_designation_id_idx` ON `employees` (`designation_id`);