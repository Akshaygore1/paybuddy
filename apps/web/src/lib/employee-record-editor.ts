import {
  createEmployeeSchema,
  employeeGenderValues,
  type CreateEmployeeInput,
} from "@tds-nivaran/api/schemas/employees";

export type EmployeeRecordDraft = {
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

export type EmployeeRecordBaseField = Exclude<keyof EmployeeRecordDraft, "customFieldValues">;

export type EmployeeRecordFieldErrors = Partial<Record<EmployeeRecordBaseField, string>> & {
  customFieldValues?: Record<string, string>;
};

export type EmployeeRecordFormDefinition = {
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
  initialValues: EmployeeRecordDraft;
};

export type EmployeeRecordEditorIdentity =
  | { mode: "create" }
  | { mode: "edit"; employeeId: string };

export type EmployeeRecordEditorState = {
  identity: EmployeeRecordEditorIdentity;
  draft: EmployeeRecordDraft;
  errors: EmployeeRecordFieldErrors;
  isHydrated: boolean;
};

export function createEmptyEmployeeRecordDraft(): EmployeeRecordDraft {
  return {
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
}

function cloneEmployeeRecordDraft(draft: EmployeeRecordDraft): EmployeeRecordDraft {
  return {
    ...draft,
    customFieldValues: { ...draft.customFieldValues },
  };
}

export function createEmployeeRecordEditorState(input: {
  identity: EmployeeRecordEditorIdentity;
  initialValues?: EmployeeRecordDraft;
}): EmployeeRecordEditorState {
  return {
    identity: input.identity,
    draft: input.initialValues
      ? cloneEmployeeRecordDraft(input.initialValues)
      : createEmptyEmployeeRecordDraft(),
    errors: {},
    isHydrated: Boolean(input.initialValues),
  };
}

export function reconcileEmployeeRecordEditor(
  state: EmployeeRecordEditorState,
  input: { identity: EmployeeRecordEditorIdentity; initialValues?: EmployeeRecordDraft },
) {
  const identityChanged =
    input.identity.mode !== state.identity.mode ||
    (input.identity.mode === "edit" &&
      (state.identity.mode !== "edit" || input.identity.employeeId !== state.identity.employeeId));

  if (identityChanged) {
    return createEmployeeRecordEditorState(input);
  }

  if (!state.isHydrated && input.initialValues) {
    return createEmployeeRecordEditorState(input);
  }

  return state;
}

export function setEmployeeRecordEditorErrors(
  state: EmployeeRecordEditorState,
  errors: EmployeeRecordFieldErrors,
): EmployeeRecordEditorState {
  return { ...state, errors };
}

export function updateEmployeeRecordField<Key extends EmployeeRecordBaseField>(
  state: EmployeeRecordEditorState,
  field: Key,
  value: EmployeeRecordDraft[Key],
): EmployeeRecordEditorState {
  const errors = { ...state.errors };
  delete errors[field];
  return {
    ...state,
    draft: { ...state.draft, [field]: value },
    errors,
  };
}

export function updateEmployeeRecordCustomField(
  state: EmployeeRecordEditorState,
  fieldId: string,
  value: string,
): EmployeeRecordEditorState {
  const customFieldValues = { ...state.draft.customFieldValues, [fieldId]: value };
  const customFieldErrors = { ...state.errors.customFieldValues };
  delete customFieldErrors[fieldId];
  const errors = { ...state.errors };

  if (Object.keys(customFieldErrors).length > 0) {
    errors.customFieldValues = customFieldErrors;
  } else {
    delete errors.customFieldValues;
  }

  return {
    ...state,
    draft: { ...state.draft, customFieldValues },
    errors,
  };
}

export function prepareEmployeeRecordSubmission(
  draft: EmployeeRecordDraft,
  customFields: EmployeeRecordFormDefinition["customFields"],
):
  | { status: "ready"; input: CreateEmployeeInput }
  | { status: "invalid"; errors: EmployeeRecordFieldErrors } {
  const activeCustomFieldIds = new Set(customFields.map((field) => field.id));
  const activeCustomFieldValues = Object.fromEntries(
    Object.entries(draft.customFieldValues).filter(([fieldId]) =>
      activeCustomFieldIds.has(fieldId),
    ),
  );
  const parsed = createEmployeeSchema.safeParse({
    ...draft,
    customFieldValues: activeCustomFieldValues,
  });
  const errors: EmployeeRecordFieldErrors = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      const customFieldId = issue.path[1];

      if (field === "customFieldValues" && typeof customFieldId === "string") {
        errors.customFieldValues ??= {};
        errors.customFieldValues[customFieldId] ??= issue.message;
      } else if (typeof field === "string" && !errors[field as EmployeeRecordBaseField]) {
        errors[field as EmployeeRecordBaseField] = issue.message;
      }
    }
  }

  const customFieldErrors: Record<string, string> = {};
  for (const field of customFields) {
    if (field.isRequired && !(draft.customFieldValues[field.id] ?? "").trim()) {
      customFieldErrors[field.id] =
        errors.customFieldValues?.[field.id] ?? `${field.label} is required`;
    }
  }
  if (Object.keys(customFieldErrors).length > 0) {
    errors.customFieldValues = { ...errors.customFieldValues, ...customFieldErrors };
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return { status: "invalid", errors };
  }

  return {
    status: "ready",
    input: parsed.data,
  };
}
