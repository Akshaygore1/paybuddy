import { Button } from "@tds-nivaran/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tds-nivaran/ui/components/card";

import { EmployeeForm } from "@/components/employee-form";
import { PageHeader } from "@/components/page-header";
import { useEmployeeRecordEditor } from "@/hooks/use-employee-record-editor";

export default function EmployeeCreatePage() {
  const { view, status, actions } = useEmployeeRecordEditor({ mode: "create" });
  const customFieldManager =
    view.customFieldManager && actions.customFields
      ? {
          ...view.customFieldManager,
          isAddingField: status.addField.isPending,
          isArchivingField: status.archiveField.isPending,
          onFieldLabelChange: actions.customFields.setLabel,
          onFieldRequiredChange: actions.customFields.setRequired,
          onAddField: () => void actions.customFields?.add(),
          onArchiveField: (fieldId: string) => void actions.customFields?.archive(fieldId),
        }
      : undefined;

  const designationManager = {
    ...view.designationManager,
    isCreatingDesignation: status.createDesignation.isPending,
    onDesignationNameChange: actions.designations.setName,
    onAddDesignation: actions.designations.create,
  };

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Create Employee"
        description="Default payroll fields appear first. Add institution-specific fields here when the employee form needs them."
        action={
          <Button variant="outline" onClick={actions.cancel}>
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
            values={view.draft}
            errors={view.errors}
            formOptions={view.formDefinition}
            isLoading={status.form.isPending}
            isSubmitting={status.submit.isPending}
            onFieldChange={actions.updateField}
            onCustomFieldChange={actions.updateCustomField}
            onSubmit={actions.submit}
            onCancel={actions.cancel}
            customFieldManager={customFieldManager}
            designationManager={designationManager}
          />
        </CardContent>
      </Card>
    </section>
  );
}
