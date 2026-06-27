import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  EmployeeForm,
  type EmployeeSubmitValues,
  emptyEmployeeFormValues,
} from "@/components/employee-form";
import { PageHeader } from "@/components/page-header";
import { queryClient, trpc } from "@/utils/trpc";

export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const [fieldLabel, setFieldLabel] = React.useState("");
  const [fieldRequired, setFieldRequired] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  const formOptionsQuery = useQuery(trpc.employees.getCreateForm.queryOptions());

  const createEmployeeMutation = useMutation(
    trpc.employees.create.mutationOptions({
      onSuccess: async () => {
        toast.success("Employee created");
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

  async function handleSubmit(values: EmployeeSubmitValues) {
    try {
      await createEmployeeMutation.mutateAsync(values);
    } catch {}
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

  async function handleArchiveCustomField(fieldId: string) {
    await archiveCustomFieldMutation.mutateAsync({ id: fieldId });
  }

  return (
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
          <EmployeeForm
            mode="create"
            submitLabel="Create Employee"
            submittingLabel="Saving..."
            resetKey="create"
            initialValues={emptyEmployeeFormValues}
            formOptions={formOptionsQuery.data}
            isLoading={formOptionsQuery.isPending}
            isSubmitting={createEmployeeMutation.isPending}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/employee")}
            customFieldManager={{
              fieldLabel,
              fieldRequired,
              fieldError,
              isAddingField: addCustomFieldMutation.isPending,
              isArchivingField: archiveCustomFieldMutation.isPending,
              onFieldLabelChange: (value) => {
                setFieldLabel(value);
                setFieldError(null);
              },
              onFieldRequiredChange: setFieldRequired,
              onAddField: () => {
                void handleAddCustomField();
              },
              onArchiveField: (fieldId) => {
                void handleArchiveCustomField(fieldId);
              },
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
