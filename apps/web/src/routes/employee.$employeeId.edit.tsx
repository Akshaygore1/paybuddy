import { Button } from "@tds-nivaran/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tds-nivaran/ui/components/card";
import { useParams } from "react-router";

import { EmployeeForm } from "@/components/employee-form";
import { PageHeader } from "@/components/page-header";
import { useEmployeeRecordEditor } from "@/hooks/use-employee-record-editor";

export default function EmployeeEditPage() {
  const { employeeId } = useParams();
  const resolvedEmployeeId = employeeId ?? "";
  const { view, status, actions } = useEmployeeRecordEditor({
    mode: "edit",
    employeeId: resolvedEmployeeId,
  });

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Edit Employee"
        description="Update payroll details and institution-defined custom fields for this employee."
        action={
          <Button variant="outline" onClick={actions.cancel}>
            Cancel
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Update employee</CardTitle>
          <CardDescription>
            Review the current employee details, then save the corrected information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            mode="edit"
            submitLabel="Save Changes"
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
          />
        </CardContent>
      </Card>
    </section>
  );
}
