import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Badge } from "@tds-nivaran/ui/components/badge";
import { Button } from "@tds-nivaran/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tds-nivaran/ui/components/card";
import { Field, FieldLabel } from "@tds-nivaran/ui/components/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tds-nivaran/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tds-nivaran/ui/components/table";

import { useConfirmModal } from "@/components/confirm-modal";
import { PageHeader } from "@/components/page-header";
import { getPayrollFinancialYearMonths } from "@tds-nivaran/api/payroll-financial-year";
import { getSelectedFinancialYearStart } from "@/lib/financial-year";
import { queryClient, trpc } from "@/utils/trpc";

export default function AdminManageCustomFieldsPage() {
  const [selectedInstitutionId, setSelectedInstitutionId] = React.useState<string>("");

  const institutionsQuery = useQuery(trpc.institutions.list.queryOptions());
  const institutions = institutionsQuery.data ?? [];

  const customFieldsQuery = useQuery({
    ...trpc.payroll.getAdminCustomFields.queryOptions({
      institutionId: selectedInstitutionId,
    }),
    enabled: Boolean(selectedInstitutionId),
  });

  const archiveMutation = useMutation(
    trpc.payroll.adminArchiveCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Payroll custom field removed");
        await queryClient.invalidateQueries({
          queryKey: trpc.payroll.getAdminCustomFields.queryKey({
            institutionId: selectedInstitutionId,
          }),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const fields = customFieldsQuery.data?.fields ?? [];
  const periods = customFieldsQuery.data?.periods ?? [];

  // Determine current active status & period info
  const financialYearStart = getSelectedFinancialYearStart();
  const currentMonth = getPayrollFinancialYearMonths(financialYearStart)[0]?.value ?? `${financialYearStart}-04`;

  const confirmModal = useConfirmModal();

  async function handleDelete(fieldId: string, label: string) {
    if (!selectedInstitutionId) return;

    const confirmed = await confirmModal({
      title: "Delete Custom Field",
      description: `Are you sure you want to delete / archive the custom field '${label}'?`,
      confirmText: "Delete Field",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    try {
      await archiveMutation.mutateAsync({
        institutionId: selectedInstitutionId,
        id: fieldId,
        financialYearStart,
        month: currentMonth,
      });
    } catch {
      // Toast notification handles errors
    }
  }

  const earningsFields = fields.filter((f) => f.section === "earnings");
  const deductionsFields = fields.filter((f) => f.section === "deductions");

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Manage Custom Fields"
        description="Select a school/institution to view and manage its payroll custom fields."
      />

      <Card>
        <CardHeader>
          <CardTitle>Select School / Institution</CardTitle>
          <CardDescription>
            Choose an institution to inspect and remove its payroll custom fields.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Field>
              <FieldLabel htmlFor="institution-select">Institution</FieldLabel>
              <Select
                value={selectedInstitutionId}
                onValueChange={(val) => setSelectedInstitutionId(val ?? "")}
              >
                <SelectTrigger id="institution-select" aria-label="Select institution">
                  <SelectValue placeholder="Select Institution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {institutions.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name} ({inst.tanNumber})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {selectedInstitutionId ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Custom Fields</CardTitle>
              <CardDescription>
                Review and delete custom earnings or deductions for the selected institution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {customFieldsQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading custom fields...</p>
              ) : fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No payroll custom fields have been created for this institution.
                </p>
              ) : (
                <div className="space-y-6">
                  {earningsFields.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Earnings Custom Fields</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field Label</TableHead>
                            <TableHead>Field Key</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-24 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {earningsFields.map((field) => {
                            const fieldPeriods = periods.filter(
                              (p) => p.customFieldDefinitionId === field.id,
                            );
                            const isActive = fieldPeriods.some(
                              (p) => !p.effectiveToMonth || p.effectiveToMonth > currentMonth,
                            );

                            return (
                              <TableRow key={field.id}>
                                <TableCell className="font-medium">{field.label}</TableCell>
                                <TableCell className="text-muted-foreground font-mono text-xs">
                                  {field.key}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={isActive ? "secondary" : "outline"}>
                                    {isActive ? "Active" : "Archived"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {isActive ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Delete ${field.label}`}
                                      disabled={archiveMutation.isPending}
                                      onClick={() => void handleDelete(field.id, field.label)}
                                    >
                                      <Trash2Icon className="h-4 w-4 text-destructive" />
                                    </Button>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}

                  {deductionsFields.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Deductions Custom Fields</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field Label</TableHead>
                            <TableHead>Field Key</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-24 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deductionsFields.map((field) => {
                            const fieldPeriods = periods.filter(
                              (p) => p.customFieldDefinitionId === field.id,
                            );
                            const isActive = fieldPeriods.some(
                              (p) => !p.effectiveToMonth || p.effectiveToMonth > currentMonth,
                            );

                            return (
                              <TableRow key={field.id}>
                                <TableCell className="font-medium">{field.label}</TableCell>
                                <TableCell className="text-muted-foreground font-mono text-xs">
                                  {field.key}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={isActive ? "secondary" : "outline"}>
                                    {isActive ? "Active" : "Archived"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {isActive ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Delete ${field.label}`}
                                      disabled={archiveMutation.isPending}
                                      onClick={() => void handleDelete(field.id, field.label)}
                                    >
                                      <Trash2Icon className="h-4 w-4 text-destructive" />
                                    </Button>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
