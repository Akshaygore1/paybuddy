import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@paybuddy/ui/components/field";
import { Input } from "@paybuddy/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@paybuddy/ui/components/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, InfoIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { queryClient, trpc } from "@/utils/trpc";

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export default function InstitutionSettingsIndexPage() {
  const [designationName, setDesignationName] = useState("");
  const [designationError, setDesignationError] = useState<string | null>(null);

  const formConfigQuery = useQuery(trpc.employeeSettings.getFormConfig.queryOptions());

  const createDesignationMutation = useMutation(
    trpc.employeeSettings.createDesignation.mutationOptions({
      onSuccess: async () => {
        toast.success("Designation added");
        setDesignationName("");
        setDesignationError(null);
        await queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const reorderDesignationsMutation = useMutation(
    trpc.employeeSettings.reorderDesignations.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const archiveDesignationMutation = useMutation(
    trpc.employeeSettings.archiveDesignation.mutationOptions({
      onSuccess: async () => {
        toast.success("Designation removed");
        await queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const formConfig = formConfigQuery.data;

  async function reorderDesignations(index: number, direction: "up" | "down") {
    if (!formConfig?.designations) {
      return;
    }

    const nextIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = moveItem(formConfig.designations, index, nextIndex);
    await reorderDesignationsMutation.mutateAsync({
      orderedIds: reordered.map((designation) => designation.id),
    });
  }

  async function handleAddDesignation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = designationName.trim();

    if (!normalizedName) {
      setDesignationError("Designation name is required");
      return;
    }

    await createDesignationMutation.mutateAsync({ name: normalizedName });
  }

  async function archiveDesignation(designationId: string) {
    await archiveDesignationMutation.mutateAsync({ id: designationId });
  }

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Employee Setup"
        description="Manage the active designation list used on employee forms."
      />

      <Card>
        <CardHeader>
          <CardTitle>Designations</CardTitle>
          <CardDescription>
            Control the designation list used on the employee form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleAddDesignation}>
            <FieldGroup>
              <Field data-invalid={Boolean(designationError) || undefined}>
                <FieldLabel htmlFor="designation-name">Designation name</FieldLabel>
                <Input
                  id="designation-name"
                  value={designationName}
                  onChange={(event) => {
                    setDesignationName(event.target.value);
                    setDesignationError(null);
                  }}
                  aria-invalid={Boolean(designationError)}
                />
                <FieldError>{designationError}</FieldError>
              </Field>
            </FieldGroup>
            <div className="flex items-end">
              <Button type="submit" disabled={createDesignationMutation.isPending}>
                <PlusIcon data-icon="inline-start" />
                {createDesignationMutation.isPending ? "Adding..." : "Create Designation"}
              </Button>
            </div>
          </form>

          <div className="space-y-3 border-t pt-5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Active designations</h2>
              <Tooltip>
                <TooltipTrigger render={<InfoIcon className="size-4 text-muted-foreground" />} />
                <TooltipContent>
                  Higher designations should be placed above lower designations for form display.
                  Employee table order is controlled by seniority rank.
                </TooltipContent>
              </Tooltip>
            </div>
            {(formConfig?.designations.length ?? 0) > 0 ? (
              formConfig?.designations.map((designation, index) => (
                <div
                  className="flex items-center justify-between gap-3 border p-3"
                  key={designation.id}
                >
                  <div>
                    <p className="font-medium">{designation.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Display order: {designation.sortOrder}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      aria-label={`Move ${designation.name} up`}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                      disabled={index === 0 || reorderDesignationsMutation.isPending}
                      onClick={() => {
                        void reorderDesignations(index, "up");
                      }}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      aria-label={`Move ${designation.name} down`}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                      disabled={
                        index === (formConfig?.designations.length ?? 1) - 1 ||
                        reorderDesignationsMutation.isPending
                      }
                      onClick={() => {
                        void reorderDesignations(index, "down");
                      }}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      aria-label={`Remove ${designation.name}`}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                      disabled={archiveDesignationMutation.isPending}
                      onClick={() => {
                        void archiveDesignation(designation.id);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No designations added yet. Create one to unlock employee creation.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
