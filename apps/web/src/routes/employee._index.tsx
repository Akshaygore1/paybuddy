import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { PageHeader } from "@/components/page-header";
import { trpc } from "@/utils/trpc";

function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function EmployeeIndexPage() {
  const navigate = useNavigate();

  const employeesQuery = useQuery(trpc.employees.list.queryOptions());

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Employee"
        description="Review the current employee directory for your institution."
        action={<Button onClick={() => navigate("/employee/create")}>Add Employee</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Employee directory</CardTitle>
          <CardDescription>
            {employeesQuery.data?.length
              ? `${employeesQuery.data.length} employee records`
              : "No employees created yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employeesQuery.data?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">Employee</th>
                    <th className="py-2 pr-4 font-medium">Rank</th>
                    <th className="py-2 pr-4 font-medium">Designation</th>
                    <th className="py-2 pr-4 font-medium">Contact</th>
                    <th className="py-2 pr-4 font-medium">Custom fields</th>
                    <th className="py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {employeesQuery.data.map((employee) => (
                    <tr className="border-b align-top" key={employee.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">
                          {employee.surname}, {employee.firstName} {employee.middleName}
                        </p>
                        <p className="text-muted-foreground">
                          PAN: {employee.panNumber || "Not provided"}
                        </p>
                        <p className="text-muted-foreground">
                          PF: {employee.pfNumber || "Not provided"}
                        </p>
                        <p className="text-muted-foreground">
                          NPS: {employee.npsAccountNumber || "Not provided"}
                        </p>
                      </td>
                      <td className="py-3 pr-4">{employee.seniorityRank}</td>
                      <td className="py-3 pr-4">
                        {employee.designationName}
                        {employee.designationIsActive ? "" : " (archived)"}
                      </td>
                      <td className="py-3 pr-4">
                        <p>{employee.contactNumber || "Not provided"}</p>
                        <p className="text-muted-foreground">
                          WhatsApp: {employee.whatsAppNumber || "Not provided"}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        {employee.customFields.length ? (
                          <div className="space-y-1">
                            {employee.customFields.map((field) => (
                              <p key={field.fieldDefinitionId}>
                                <span className="font-medium">{field.label}:</span> {field.value}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No custom values</span>
                        )}
                      </td>
                      <td className="py-3">{formatDate(employee.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Start by creating a designation in Employee Setup, then add your first
              employee here.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
