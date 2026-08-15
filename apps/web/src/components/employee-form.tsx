import { employeeGenderValues } from "@tds-nivaran/api/schemas/employees";
import { Button } from "@tds-nivaran/ui/components/button";
import { Checkbox } from "@tds-nivaran/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@tds-nivaran/ui/components/field";
import { Input } from "@tds-nivaran/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tds-nivaran/ui/components/select";
import { PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { useConfirmModal } from "@/components/confirm-modal";

import type {
  EmployeeRecordBaseField,
  EmployeeRecordDraft,
  EmployeeRecordFieldErrors,
  EmployeeRecordFormDefinition,
} from "@/lib/employee-record-editor";

type EmployeeCustomFieldManagerProps = {
  fieldLabel: string;
  fieldRequired: boolean;
  fieldError: string | null;
  isAddingField: boolean;
  isArchivingField: boolean;
  onFieldLabelChange: (value: string) => void;
  onFieldRequiredChange: (value: boolean) => void;
  onAddField: () => void;
  onArchiveField: (fieldId: string) => void;
};

type EmployeeFormProps = {
  mode: "create" | "edit";
  submitLabel: string;
  submittingLabel: string;
  cancelLabel?: string;
  values: EmployeeRecordDraft;
  errors: EmployeeRecordFieldErrors;
  formOptions: EmployeeRecordFormDefinition | undefined;
  isLoading?: boolean;
  isSubmitting: boolean;
  onFieldChange: <Key extends EmployeeRecordBaseField>(
    field: Key,
    value: EmployeeRecordDraft[Key],
  ) => void;
  onCustomFieldChange: (fieldId: string, value: string) => void;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
  customFieldManager?: EmployeeCustomFieldManagerProps;
};

export function EmployeeForm({
  mode,
  submitLabel,
  submittingLabel,
  cancelLabel = "Back",
  values,
  errors,
  formOptions,
  isLoading = false,
  isSubmitting,
  onFieldChange,
  onCustomFieldChange,
  onSubmit,
  onCancel,
  customFieldManager,
}: EmployeeFormProps) {
  const confirmModal = useConfirmModal();
  const designationItems =
    formOptions?.designations.map((designation) => ({
      label: designation.name,
      value: designation.id,
    })) ?? [];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit();
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field data-invalid={Boolean(errors.surname) || undefined}>
          <FieldLabel htmlFor={`employee-surname-${mode}`}>Surname</FieldLabel>
          <Input
            id={`employee-surname-${mode}`}
            value={values.surname}
            onChange={(event) => onFieldChange("surname", event.target.value)}
            aria-invalid={Boolean(errors.surname)}
            disabled={isLoading || isSubmitting}
          />
          <FieldError>{errors.surname}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.firstName) || undefined}>
          <FieldLabel htmlFor={`employee-first-name-${mode}`}>First name</FieldLabel>
          <Input
            id={`employee-first-name-${mode}`}
            value={values.firstName}
            onChange={(event) => onFieldChange("firstName", event.target.value)}
            aria-invalid={Boolean(errors.firstName)}
            disabled={isLoading || isSubmitting}
          />
          <FieldError>{errors.firstName}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.middleName) || undefined}>
          <FieldLabel htmlFor={`employee-middle-name-${mode}`}>Middle name</FieldLabel>
          <Input
            id={`employee-middle-name-${mode}`}
            value={values.middleName}
            onChange={(event) => onFieldChange("middleName", event.target.value)}
            aria-invalid={Boolean(errors.middleName)}
            disabled={isLoading || isSubmitting}
          />
          <FieldError>{errors.middleName}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.dateOfBirth) || undefined}>
          <FieldLabel htmlFor={`employee-date-of-birth-${mode}`}>Date of Birth</FieldLabel>
          <Input
            id={`employee-date-of-birth-${mode}`}
            type="date"
            value={values.dateOfBirth}
            onChange={(event) => onFieldChange("dateOfBirth", event.target.value)}
            aria-invalid={Boolean(errors.dateOfBirth)}
            disabled={isLoading || isSubmitting}
          />
          <FieldError>{errors.dateOfBirth}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.gender) || undefined}>
          <FieldLabel>Gender</FieldLabel>
          <Select
            items={employeeGenderValues.map((gender) => ({
              label: gender,
              value: gender,
            }))}
            value={values.gender}
            onValueChange={(value) =>
              onFieldChange("gender", (value ?? "") as EmployeeRecordDraft["gender"])
            }
          >
            <SelectTrigger
              aria-invalid={Boolean(errors.gender)}
              aria-label="Gender"
              disabled={isLoading || isSubmitting}
            >
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {employeeGenderValues.map((gender) => (
                  <SelectItem key={gender} value={gender}>
                    {gender}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError>{errors.gender}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.designationId) || undefined}>
          <FieldLabel>Designation</FieldLabel>
          <Select
            items={designationItems}
            value={values.designationId}
            onValueChange={(value) => onFieldChange("designationId", value ?? "")}
          >
            <SelectTrigger
              aria-invalid={Boolean(errors.designationId)}
              aria-label="Designation"
              disabled={isLoading || isSubmitting}
            >
              <SelectValue placeholder="Select designation" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(formOptions?.designations ?? []).map((designation) => (
                  <SelectItem key={designation.id} value={designation.id}>
                    {designation.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {(formOptions?.designations.length ?? 0) === 0 ? (
            <FieldDescription>
              Create a designation in Employee Setup before adding employees.
            </FieldDescription>
          ) : null}
          <FieldError>{errors.designationId}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.seniorityRank) || undefined}>
          <FieldLabel htmlFor={`employee-seniority-rank-${mode}`}>Seniority Rank</FieldLabel>
          <Input
            id={`employee-seniority-rank-${mode}`}
            inputMode="numeric"
            min={1}
            step={1}
            type="number"
            value={values.seniorityRank}
            onChange={(event) => onFieldChange("seniorityRank", event.target.value)}
            aria-invalid={Boolean(errors.seniorityRank)}
            disabled={isLoading || isSubmitting}
          />
          <FieldDescription>
            1 is highest. Employees are listed from lowest rank number to highest.
          </FieldDescription>
          <FieldError>{errors.seniorityRank}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-pan-number-${mode}`}>PAN number</FieldLabel>
          <Input
            id={`employee-pan-number-${mode}`}
            value={values.panNumber}
            onChange={(event) => onFieldChange("panNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-pf-number-${mode}`}>PF number</FieldLabel>
          <Input
            id={`employee-pf-number-${mode}`}
            value={values.pfNumber}
            onChange={(event) => onFieldChange("pfNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-nps-account-number-${mode}`}>NPS account number</FieldLabel>
          <Input
            id={`employee-nps-account-number-${mode}`}
            value={values.npsAccountNumber}
            onChange={(event) => onFieldChange("npsAccountNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-whatsapp-number-${mode}`}>WhatsApp number</FieldLabel>
          <Input
            id={`employee-whatsapp-number-${mode}`}
            value={values.whatsAppNumber}
            onChange={(event) => onFieldChange("whatsAppNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-contact-number-${mode}`}>Contact number</FieldLabel>
          <Input
            id={`employee-contact-number-${mode}`}
            value={values.contactNumber}
            onChange={(event) => onFieldChange("contactNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
      </FieldGroup>

      {(formOptions?.customFields.length ?? 0) > 0 ? (
        <div className="flex flex-col gap-4 border-t pt-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Custom fields</h2>
            <p className="text-sm text-muted-foreground">
              Fields added by your institution appear here for every employee.
            </p>
          </div>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            {(formOptions?.customFields ?? []).map((field) => {
              const fieldError = errors.customFieldValues?.[field.id];
              return (
                <Field key={field.id} data-invalid={Boolean(fieldError) || undefined}>
                  <FieldLabel htmlFor={`employee-custom-${mode}-${field.id}`}>
                    {field.label}
                    {field.isRequired ? " *" : ""}
                  </FieldLabel>
                  <Input
                    id={`employee-custom-${mode}-${field.id}`}
                    value={values.customFieldValues[field.id] ?? ""}
                    onChange={(event) => onCustomFieldChange(field.id, event.target.value)}
                    aria-invalid={Boolean(fieldError)}
                    disabled={isLoading || isSubmitting}
                  />
                  <FieldError>{fieldError}</FieldError>
                </Field>
              );
            })}
          </FieldGroup>
        </div>
      ) : null}

      {customFieldManager ? (
        <div className="flex flex-col gap-4 border-t pt-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Manage custom fields</h2>
            <p className="text-sm text-muted-foreground">
              Add reusable employee fields or remove fields from future employee forms.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Field data-invalid={Boolean(customFieldManager.fieldError) || undefined}>
              <FieldLabel htmlFor="custom-field-label">Field label</FieldLabel>
              <Input
                id="custom-field-label"
                value={customFieldManager.fieldLabel}
                onChange={(event) => customFieldManager.onFieldLabelChange(event.target.value)}
                aria-invalid={Boolean(customFieldManager.fieldError)}
                disabled={customFieldManager.isAddingField || customFieldManager.isArchivingField}
              />
              <FieldError>{customFieldManager.fieldError}</FieldError>
            </Field>
            <div className="flex items-end gap-3">
              <Field className="h-8 justify-center" orientation="horizontal">
                <Checkbox
                  aria-label="Required"
                  checked={customFieldManager.fieldRequired}
                  onCheckedChange={(checked) =>
                    customFieldManager.onFieldRequiredChange(Boolean(checked))
                  }
                  disabled={customFieldManager.isAddingField || customFieldManager.isArchivingField}
                />
                <FieldLabel>Required</FieldLabel>
              </Field>
              <Button
                type="button"
                disabled={customFieldManager.isAddingField || customFieldManager.isArchivingField}
                onClick={customFieldManager.onAddField}
              >
                <PlusIcon data-icon="inline-start" />
                {customFieldManager.isAddingField ? "Adding..." : "Add Field"}
              </Button>
            </div>
          </div>

          {(formOptions?.customFields.length ?? 0) > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {(formOptions?.customFields ?? []).map((field) => (
                <div
                  className="flex min-h-12 items-center justify-between gap-3 border p-3"
                  data-testid="custom-field-manager-row"
                  key={field.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium" data-testid="custom-field-manager-name">
                      {field.label}
                      {field.isRequired ? " *" : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">Order: {field.sortOrder}</p>
                  </div>
                  <Button
                    aria-label={`Remove ${field.label}`}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                    disabled={customFieldManager.isAddingField || customFieldManager.isArchivingField}
                    onClick={async () => {
                      const confirmed = await confirmModal({
                        title: "Remove Custom Field",
                        description: `Remove ‘${field.label}’ from future employee forms?`,
                        confirmText: "Remove Field",
                        variant: "destructive",
                      });
                      if (confirmed) {
                        customFieldManager.onArchiveField(field.id);
                      }
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No custom fields added yet.</p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || isSubmitting || (formOptions?.designations.length ?? 0) === 0}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
