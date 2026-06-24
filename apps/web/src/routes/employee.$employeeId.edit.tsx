import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import {
  buildEmployeeFormValues,
  EmployeeForm,
  type EmployeeSubmitValues,
  emptyEmployeeFormValues,
} from "@/components/employee-form";
import { PageHeader } from "@/components/page-header";
import { queryClient, trpc } from "@/utils/trpc";

export default function EmployeeEditPage() {
  const navigate = useNavigate();
  const { employeeId } = useParams();

  const resolvedEmployeeId = employeeId ?? "";

  const formOptionsQuery = useQuery(trpc.employees.getCreateFormOptions.queryOptions());
  const employeeQuery = useQuery(
    trpc.employees.getById.queryOptions(
      { employeeId: resolvedEmployeeId },
      { enabled: resolvedEmployeeId.length > 0 },
    ),
  );

  const updateEmployeeMutation = useMutation(
    trpc.employees.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Employee updated");
        await queryClient.invalidateQueries();
        navigate("/employee");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  async function handleSubmit(values: EmployeeSubmitValues) {
    await updateEmployeeMutation.mutateAsync({
      employeeId: resolvedEmployeeId,
      ...values,
    });
  }

  const initialValues = employeeQuery.data
    ? buildEmployeeFormValues(employeeQuery.data)
    : emptyEmployeeFormValues;

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Edit Employee"
        description="Update payroll details and institution-defined custom fields for this employee."
        action={
          <Button variant="outline" onClick={() => navigate("/employee")}>
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
            initialValues={initialValues}
            formOptions={formOptionsQuery.data}
            isLoading={formOptionsQuery.isPending || employeeQuery.isPending}
            isSubmitting={updateEmployeeMutation.isPending}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/employee")}
          />
        </CardContent>
      </Card>
    </section>
  );
}
