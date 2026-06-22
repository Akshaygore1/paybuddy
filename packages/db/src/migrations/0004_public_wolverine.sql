ALTER TABLE `employee_custom_field_definitions` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `employee_designations` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `seniority_rank` integer DEFAULT 999999 NOT NULL;
