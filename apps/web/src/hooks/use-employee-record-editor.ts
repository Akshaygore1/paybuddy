import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  createEmployeeRecordEditorState,
  prepareEmployeeRecordSubmission,
  reconcileEmployeeRecordEditor,
  setEmployeeRecordEditorErrors,
  updateEmployeeRecordCustomField,
  updateEmployeeRecordField,
  type EmployeeRecordBaseField,
  type EmployeeRecordDraft,
  type EmployeeRecordEditorIdentity,
} from "../lib/employee-record-editor";
import { queryClient, trpc } from "../utils/trpc";

type EmployeeRecordEditorInput =
  | { mode: "create" }
  | { mode: "edit"; employeeId: string };

export function useEmployeeRecordEditor(input: EmployeeRecordEditorInput) {
  const navigate = useNavigate();
  const identity: EmployeeRecordEditorIdentity = input;
  const [editorState, setEditorState] = React.useState(() =>
    createEmployeeRecordEditorState({ identity }),
  );
  const [fieldLabel, setFieldLabel] = React.useState("");
  const [fieldRequired, setFieldRequired] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  const createFormQuery = useQuery({
    ...trpc.employees.getCreateForm.queryOptions(),
    enabled: input.mode === "create",
  });
  const editFormQuery = useQuery({
    ...trpc.employees.getEditForm.queryOptions({
      employeeId: input.mode === "edit" ? input.employeeId : "__pending__",
    }),
    enabled: input.mode === "edit" && input.employeeId.length > 0,
  });
  const formQuery = input.mode === "create" ? createFormQuery : editFormQuery;
  const reconciliationInput = {
    identity,
    initialValues: formQuery.data?.initialValues,
  };
  const reconciledState = reconcileEmployeeRecordEditor(editorState, reconciliationInput);

  if (reconciledState !== editorState) {
    setEditorState(reconciledState);
  }

  async function invalidateEmployeeDirectory() {
    await queryClient.invalidateQueries({ queryKey: trpc.employees.getDirectory.queryKey() });
  }

  async function invalidateEmployeeSetup() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.employees.getCreateForm.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.employees.getEditForm.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.employeeSettings.getFormConfig.queryKey() }),
    ]);
  }

  const createMutation = useMutation(
    trpc.employees.create.mutationOptions({
      onSuccess: async () => {
        toast.success("Employee created");
        await invalidateEmployeeDirectory();
        navigate("/employee");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const updateMutation = useMutation(
    trpc.employees.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Employee updated");
        await Promise.all([
          invalidateEmployeeDirectory(),
          input.mode === "edit"
            ? queryClient.invalidateQueries({
                queryKey: trpc.employees.getEditForm.queryKey({
                  employeeId: input.employeeId,
                }),
              })
            : Promise.resolve(),
        ]);
        navigate("/employee");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const addCustomFieldMutation = useMutation(
    trpc.employeeSettings.addCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Custom field added");
        setFieldLabel("");
        setFieldRequired(false);
        setFieldError(null);
        await invalidateEmployeeSetup();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const archiveCustomFieldMutation = useMutation(
    trpc.employeeSettings.archiveCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Custom field removed");
        await invalidateEmployeeSetup();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  function updateField<Key extends EmployeeRecordBaseField>(
    field: Key,
    value: EmployeeRecordDraft[Key],
  ) {
    setEditorState((current) =>
      updateEmployeeRecordField(
        reconcileEmployeeRecordEditor(current, reconciliationInput),
        field,
        value,
      ),
    );
  }

  function updateCustomField(fieldId: string, value: string) {
    setEditorState((current) =>
      updateEmployeeRecordCustomField(
        reconcileEmployeeRecordEditor(current, reconciliationInput),
        fieldId,
        value,
      ),
    );
  }

  async function submit() {
    const result = prepareEmployeeRecordSubmission(
      reconciledState.draft,
      formQuery.data?.customFields ?? [],
    );
    if (result.status === "invalid") {
      setEditorState((current) => setEmployeeRecordEditorErrors(current, result.errors));
      return;
    }

    try {
      if (input.mode === "create") {
        await createMutation.mutateAsync(result.input);
      } else {
        await updateMutation.mutateAsync({ employeeId: input.employeeId, ...result.input });
      }
    } catch {
      // Mutation callbacks provide user-facing errors.
    }
  }

  async function addCustomField() {
    if (input.mode !== "create") return;
    const label = fieldLabel.trim();
    if (!label) {
      setFieldError("Field label is required");
      return;
    }
    try {
      await addCustomFieldMutation.mutateAsync({ label, isRequired: fieldRequired });
    } catch {
      // Mutation callbacks provide user-facing errors.
    }
  }

  async function archiveCustomField(fieldId: string) {
    if (input.mode !== "create") return;
    try {
      await archiveCustomFieldMutation.mutateAsync({ id: fieldId });
    } catch {
      // Mutation callbacks provide user-facing errors.
    }
  }

  return {
    view: {
      mode: input.mode,
      draft: reconciledState.draft,
      errors: reconciledState.errors,
      formDefinition: formQuery.data,
      customFieldManager:
        input.mode === "create"
          ? {
              fieldLabel,
              fieldRequired,
              fieldError,
            }
          : null,
    },
    status: {
      form: {
        isPending: formQuery.isPending,
        error: formQuery.error,
      },
      submit: {
        isPending: createMutation.isPending || updateMutation.isPending,
      },
      addField: { isPending: addCustomFieldMutation.isPending },
      archiveField: { isPending: archiveCustomFieldMutation.isPending },
    },
    actions: {
      updateField,
      updateCustomField,
      submit,
      cancel: () => navigate("/employee"),
      customFields:
        input.mode === "create"
          ? {
              setLabel(value: string) {
                setFieldLabel(value);
                setFieldError(null);
              },
              setRequired: setFieldRequired,
              add: addCustomField,
              archive: archiveCustomField,
            }
          : null,
    },
  };
}
