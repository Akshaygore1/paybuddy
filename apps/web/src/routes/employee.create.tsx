import { createEmployeeSchema } from "@paybuddy/api/schemas/employees";
import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { UserRouteGuard } from "@/components/user-route-guard";
import { queryClient, trpc } from "@/utils/trpc";

type EmployeeFormValues = {
  firstName: string;
  middleName: string;
  surname: string;
  designationId: string;
  seniorityRank: string;
  panNumber: string;
  pfNumber: string;
  npsAccountNumber: string;
  whatsAppNumber: string;
  contactNumber: string;
  customFieldValues: Record<string, string>;
};

type EmployeeFormErrors = Partial<
  Record<
    | "firstName"
    | "middleName"
    | "surname"
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

const initialValues: EmployeeFormValues = {
  firstName: "",
  middleName: "",
  surname: "",
  designationId: "",
  seniorityRank: "",
  panNumber: "",
  pfNumber: "",
  npsAccountNumber: "",
  whatsAppNumber: "",
  contactNumber: "",
  customFieldValues: {},
};

export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const formOptionsQuery = useQuery(trpc.employees.getCreateFormOptions.queryOptions());

  const createEmployeeMutation = useMutation(
    trpc.employees.create.mutationOptions({
      onSuccess: async () => {
        toast.success("Employee created");
        setValues(initialValues);
        setErrors({});
        await queryClient.invalidateQueries();
        navigate("/employee");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const addCustomFieldMutation = useMutation(
    trpc.employeeSettings.addCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Custom field added");
        setFieldLabel("");
        setFieldRequired(false);
        setFieldError(null);
        await queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const archiveCustomFieldMutation = useMutation(
    trpc.employeeSettings.archiveCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Custom field removed");
        await queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const formOptions = formOptionsQuery.data;
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

  async function handleCreateEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const activeCustomFieldIds = new Set(
      (formOptions?.customFields ?? []).map((field) => field.id),
    );

    await createEmployeeMutation.mutateAsync({
      ...values,
      seniorityRank: Number(values.seniorityRank),
      customFieldValues: Object.fromEntries(
        Object.entries(values.customFieldValues).filter(([fieldId]) =>
          activeCustomFieldIds.has(fieldId),
        ),
      ),
    });
  }

  async function handleAddCustomField() {
    const normalizedLabel = fieldLabel.trim();

    if (!normalizedLabel) {
      setFieldError("Field label is required");
      return;
    }

    await addCustomFieldMutation.mutateAsync({
      label: normalizedLabel,
      isRequired: fieldRequired,
    });
  }

  async function archiveCustomField(fieldId: string) {
    await archiveCustomFieldMutation.mutateAsync({ id: fieldId });
  }

  return (
    <UserRouteGuard>
      <section className="space-y-6 p-6">
        <PageHeader
          title="Create Employee"
          description="Default payroll fields appear first. Add institution-specific fields here when the employee form needs them."
          action={
            <Button variant="outline" onClick={() => navigate("/employee")}>
              Cancel
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Add employee</CardTitle>
            <CardDescription>
              Complete the base payroll fields and any institution-defined custom fields before
              saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={handleCreateEmployee}>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={Boolean(errors.surname) || undefined}>
                  <FieldLabel htmlFor="employee-surname">Surname</FieldLabel>
                  <Input
                    id="employee-surname"
                    value={values.surname}
                    onChange={(event) => updateValue("surname", event.target.value)}
                    aria-invalid={Boolean(errors.surname)}
                  />
                  <FieldError>{errors.surname}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.firstName) || undefined}>
                  <FieldLabel htmlFor="employee-first-name">First name</FieldLabel>
                  <Input
                    id="employee-first-name"
                    value={values.firstName}
                    onChange={(event) => updateValue("firstName", event.target.value)}
                    aria-invalid={Boolean(errors.firstName)}
                  />
                  <FieldError>{errors.firstName}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.middleName) || undefined}>
                  <FieldLabel htmlFor="employee-middle-name">Middle name</FieldLabel>
                  <Input
                    id="employee-middle-name"
                    value={values.middleName}
                    onChange={(event) => updateValue("middleName", event.target.value)}
                    aria-invalid={Boolean(errors.middleName)}
                  />
                  <FieldError>{errors.middleName}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.designationId) || undefined}>
                  <FieldLabel>Designation</FieldLabel>
                  <Select
                    items={designationItems}
                    value={values.designationId}
                    onValueChange={(value) => updateValue("designationId", value ?? "")}
                  >
                    <SelectTrigger aria-invalid={Boolean(errors.designationId)}>
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
                  <FieldLabel htmlFor="employee-seniority-rank">Seniority Rank</FieldLabel>
                  <Input
                    id="employee-seniority-rank"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    type="number"
                    value={values.seniorityRank}
                    onChange={(event) => updateValue("seniorityRank", event.target.value)}
                    aria-invalid={Boolean(errors.seniorityRank)}
                  />
                  <FieldDescription>
                    1 is highest. Employees are listed from lowest rank number to highest.
                  </FieldDescription>
                  <FieldError>{errors.seniorityRank}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="employee-pan-number">PAN number</FieldLabel>
                  <Input
                    id="employee-pan-number"
                    value={values.panNumber}
                    onChange={(event) => updateValue("panNumber", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="employee-pf-number">PF number</FieldLabel>
                  <Input
                    id="employee-pf-number"
                    value={values.pfNumber}
                    onChange={(event) => updateValue("pfNumber", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="employee-nps-account-number">NPS account number</FieldLabel>
                  <Input
                    id="employee-nps-account-number"
                    value={values.npsAccountNumber}
                    onChange={(event) => updateValue("npsAccountNumber", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="employee-whatsapp-number">WhatsApp number</FieldLabel>
                  <Input
                    id="employee-whatsapp-number"
                    value={values.whatsAppNumber}
                    onChange={(event) => updateValue("whatsAppNumber", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="employee-contact-number">Contact number</FieldLabel>
                  <Input
                    id="employee-contact-number"
                    value={values.contactNumber}
                    onChange={(event) => updateValue("contactNumber", event.target.value)}
                  />
                </Field>
              </FieldGroup>

              {(formOptions?.customFields.length ?? 0) > 0 ? (
                <div className="flex flex-col gap-4 border-t pt-5">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-medium">Custom fields</h2>
                    <p className="text-sm text-muted-foreground">
                      Fields added by your institution appear here for every new employee.
                    </p>
                  </div>
                  <FieldGroup className="grid gap-4 md:grid-cols-2">
                    {(formOptions?.customFields ?? []).map((field) => {
                      const fieldError = errors.customFieldValues?.[field.id];
                      return (
                        <Field key={field.id} data-invalid={Boolean(fieldError) || undefined}>
                          <FieldLabel htmlFor={`employee-custom-${field.id}`}>
                            {field.label}
                            {field.isRequired ? " *" : ""}
                          </FieldLabel>
                          <Input
                            id={`employee-custom-${field.id}`}
                            value={values.customFieldValues[field.id] ?? ""}
                            onChange={(event) =>
                              updateCustomFieldValue(field.id, event.target.value)
                            }
                            aria-invalid={Boolean(fieldError)}
                          />
                          <FieldError>{fieldError}</FieldError>
                        </Field>
                      );
                    })}
                  </FieldGroup>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 border-t pt-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-medium">Manage custom fields</h2>
                  <p className="text-sm text-muted-foreground">
                    Add reusable employee fields or remove fields from future employee forms.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <Field data-invalid={Boolean(fieldError) || undefined}>
                    <FieldLabel htmlFor="custom-field-label">Field label</FieldLabel>
                    <Input
                      id="custom-field-label"
                      value={fieldLabel}
                      onChange={(event) => {
                        setFieldLabel(event.target.value);
                        setFieldError(null);
                      }}
                      aria-invalid={Boolean(fieldError)}
                    />
                    <FieldError>{fieldError}</FieldError>
                  </Field>
                  <div className="flex items-end gap-3">
                    <Field className="h-8 justify-center" orientation="horizontal">
                      <Checkbox
                        checked={fieldRequired}
                        onCheckedChange={(checked) => setFieldRequired(Boolean(checked))}
                      />
                      <FieldLabel>Required</FieldLabel>
                    </Field>
                    <Button
                      type="button"
                      disabled={addCustomFieldMutation.isPending}
                      onClick={() => {
                        void handleAddCustomField();
                      }}
                    >
                      <PlusIcon data-icon="inline-start" />
                      {addCustomFieldMutation.isPending ? "Adding..." : "Add Field"}
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
                          disabled={archiveCustomFieldMutation.isPending}
                          onClick={() => {
                            void archiveCustomField(field.id);
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

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/employee")}>
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createEmployeeMutation.isPending ||
                    (formOptions?.designations.length ?? 0) === 0
                  }
                >
                  {createEmployeeMutation.isPending ? "Saving..." : "Create Employee"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </UserRouteGuard>
  );
}
