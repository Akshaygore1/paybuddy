import {
  createEmployeeSchema,
  employeeGenderValues,
} from "@paybuddy/api/schemas/employees";
import { Button } from "@paybuddy/ui/components/button";
import { Checkbox } from "@paybuddy/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@paybuddy/ui/components/field";
import { Input } from "@paybuddy/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@paybuddy/ui/components/select";
import { PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

export type EmployeeFormValues = {
  firstName: string;
  middleName: string;
  surname: string;
  dateOfBirth: string;
  gender: (typeof employeeGenderValues)[number] | "";
  designationId: string;
  seniorityRank: string;
  panNumber: string;
  pfNumber: string;
  npsAccountNumber: string;
  whatsAppNumber: string;
  contactNumber: string;
  customFieldValues: Record<string, string>;
};

export type EmployeeFormErrors = Partial<
  Record<
    | "firstName"
    | "middleName"
    | "surname"
    | "dateOfBirth"
    | "gender"
    | "designationId"
    | "seniorityRank"
    | "panNumber"
    | "pfNumber"
    | "npsAccountNumber"
    | "whatsAppNumber"
    | "contactNumber",
    string
  >
> & {
  customFieldValues?: Record<string, string>;
};

export type EmployeeFormOptions = {
  designations: Array<{
    id: string;
    name: string;
    sortOrder: number;
  }>;
  customFields: Array<{
    id: string;
    label: string;
    key: string;
    isRequired: boolean;
    sortOrder: number;
  }>;
};

export type EmployeeSubmitValues = Omit<EmployeeFormValues, "seniorityRank" | "gender"> & {
  gender: (typeof employeeGenderValues)[number];
  seniorityRank: number;
};

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
  resetKey: string;
  initialValues: EmployeeFormValues;
  formOptions: EmployeeFormOptions | undefined;
  isLoading?: boolean;
  isSubmitting: boolean;
  onSubmit: (values: EmployeeSubmitValues) => Promise<void>;
  onCancel: () => void;
  customFieldManager?: EmployeeCustomFieldManagerProps;
};

export const emptyEmployeeFormValues: EmployeeFormValues = {
  firstName: "",
  middleName: "",
  surname: "",
  dateOfBirth: "",
  gender: "",
  designationId: "",
  seniorityRank: "",
  panNumber: "",
  pfNumber: "",
  npsAccountNumber: "",
  whatsAppNumber: "",
  contactNumber: "",
  customFieldValues: {},
};

function cloneValues(values: EmployeeFormValues): EmployeeFormValues {
  return {
    ...values,
    customFieldValues: { ...values.customFieldValues },
  };
}

export function buildEmployeeFormValues(input: {
  firstName: string;
  middleName: string;
  surname: string;
  dateOfBirth: string;
  gender: (typeof employeeGenderValues)[number];
  designationId: string;
  seniorityRank: number | string;
  panNumber: string | null;
  pfNumber: string | null;
  npsAccountNumber: string | null;
  whatsAppNumber: string | null;
  contactNumber: string | null;
  customFields?: Array<{
    fieldDefinitionId: string;
    value: string;
  }>;
}): EmployeeFormValues {
  return {
    firstName: input.firstName ?? "",
    middleName: input.middleName ?? "",
    surname: input.surname ?? "",
    dateOfBirth: input.dateOfBirth ?? "",
    gender: input.gender ?? "",
    designationId: input.designationId ?? "",
    seniorityRank: String(input.seniorityRank ?? ""),
    panNumber: input.panNumber ?? "",
    pfNumber: input.pfNumber ?? "",
    npsAccountNumber: input.npsAccountNumber ?? "",
    whatsAppNumber: input.whatsAppNumber ?? "",
    contactNumber: input.contactNumber ?? "",
    customFieldValues: Object.fromEntries(
      (input.customFields ?? []).map((field) => [field.fieldDefinitionId, field.value]),
    ),
  };
}

export function EmployeeForm({
  mode,
  submitLabel,
  submittingLabel,
  cancelLabel = "Back",
  resetKey,
  initialValues,
  formOptions,
  isLoading = false,
  isSubmitting,
  onSubmit,
  onCancel,
  customFieldManager,
}: EmployeeFormProps) {
  const [values, setValues] = React.useState<EmployeeFormValues>(() => cloneValues(initialValues));
  const [errors, setErrors] = React.useState<EmployeeFormErrors>({});

  React.useEffect(() => {
    setValues(cloneValues(initialValues));
    setErrors({});
  }, [initialValues, resetKey]);

  const designationItems =
    formOptions?.designations.map((designation) => ({
      label: designation.name,
      value: designation.id,
    })) ?? [];

  function updateValue<Key extends keyof Omit<EmployeeFormValues, "customFieldValues">>(
    key: Key,
    value: EmployeeFormValues[Key],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  function updateCustomFieldValue(fieldId: string, value: string) {
    setValues((current) => ({
      ...current,
      customFieldValues: {
        ...current.customFieldValues,
        [fieldId]: value,
      },
    }));
    setErrors((current) => ({
      ...current,
      customFieldValues: Object.fromEntries(
        Object.entries(current.customFieldValues ?? {}).filter(
          ([currentFieldId]) => currentFieldId !== fieldId,
        ),
      ),
    }));
  }

  function validateForm() {
    const parsed = createEmployeeSchema.safeParse(values);
    const nextErrors: EmployeeFormErrors = {};

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0] as keyof EmployeeFormErrors;

        if (fieldName === "customFieldValues") {
          continue;
        }

        nextErrors[fieldName] = issue.message;
      }
    }

    const customFieldErrors: Record<string, string> = {};

    for (const field of formOptions?.customFields ?? []) {
      if (field.isRequired && !(values.customFieldValues[field.id] ?? "").trim()) {
        customFieldErrors[field.id] = `${field.label} is required`;
      }
    }

    if (Object.keys(customFieldErrors).length > 0) {
      nextErrors.customFieldValues = customFieldErrors;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const activeCustomFieldIds = new Set((formOptions?.customFields ?? []).map((field) => field.id));

    await onSubmit({
      ...values,
      gender: values.gender as (typeof employeeGenderValues)[number],
      seniorityRank: Number(values.seniorityRank),
      customFieldValues: Object.fromEntries(
        Object.entries(values.customFieldValues).filter(([fieldId]) =>
          activeCustomFieldIds.has(fieldId),
        ),
      ),
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field data-invalid={Boolean(errors.surname) || undefined}>
          <FieldLabel htmlFor={`employee-surname-${mode}`}>Surname</FieldLabel>
          <Input
            id={`employee-surname-${mode}`}
            value={values.surname}
            onChange={(event) => updateValue("surname", event.target.value)}
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
            onChange={(event) => updateValue("firstName", event.target.value)}
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
            onChange={(event) => updateValue("middleName", event.target.value)}
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
            onChange={(event) => updateValue("dateOfBirth", event.target.value)}
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
            onValueChange={(value) => updateValue("gender", (value ?? "") as EmployeeFormValues["gender"])}
          >
            <SelectTrigger aria-invalid={Boolean(errors.gender)} disabled={isLoading || isSubmitting}>
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
            onValueChange={(value) => updateValue("designationId", value ?? "")}
          >
            <SelectTrigger aria-invalid={Boolean(errors.designationId)} disabled={isLoading || isSubmitting}>
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
            onChange={(event) => updateValue("seniorityRank", event.target.value)}
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
            onChange={(event) => updateValue("panNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-pf-number-${mode}`}>PF number</FieldLabel>
          <Input
            id={`employee-pf-number-${mode}`}
            value={values.pfNumber}
            onChange={(event) => updateValue("pfNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-nps-account-number-${mode}`}>NPS account number</FieldLabel>
          <Input
            id={`employee-nps-account-number-${mode}`}
            value={values.npsAccountNumber}
            onChange={(event) => updateValue("npsAccountNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-whatsapp-number-${mode}`}>WhatsApp number</FieldLabel>
          <Input
            id={`employee-whatsapp-number-${mode}`}
            value={values.whatsAppNumber}
            onChange={(event) => updateValue("whatsAppNumber", event.target.value)}
            disabled={isLoading || isSubmitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`employee-contact-number-${mode}`}>Contact number</FieldLabel>
          <Input
            id={`employee-contact-number-${mode}`}
            value={values.contactNumber}
            onChange={(event) => updateValue("contactNumber", event.target.value)}
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
                    onChange={(event) => updateCustomFieldValue(field.id, event.target.value)}
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
                  key={field.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
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
                    onClick={() => customFieldManager.onArchiveField(field.id)}
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
