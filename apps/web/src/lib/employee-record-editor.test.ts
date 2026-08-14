import { describe, expect, it } from "vitest";

import {
  createEmployeeRecordEditorState,
  prepareEmployeeRecordSubmission,
  reconcileEmployeeRecordEditor,
  setEmployeeRecordEditorErrors,
  updateEmployeeRecordCustomField,
  updateEmployeeRecordField,
  type EmployeeRecordFormDefinition,
} from "./employee-record-editor";

const initialValues = {
  firstName: "Asha",
  middleName: "R",
  surname: "Patel",
  dateOfBirth: "1990-01-02",
  gender: "Female" as const,
  designationId: "designation-1",
  seniorityRank: "7",
  panNumber: "",
  pfNumber: "PF-1",
  npsAccountNumber: "",
  whatsAppNumber: "",
  contactNumber: "",
  customFieldValues: { badge: "BN-1", archived: "ignore me" },
};

const formDefinition: EmployeeRecordFormDefinition = {
  designations: [{ id: "designation-1", name: "Teacher", sortOrder: 1 }],
  customFields: [
    {
      id: "badge",
      label: "Badge number",
      key: "badge_number",
      isRequired: true,
      sortOrder: 1,
    },
    {
      id: "locker",
      label: "Locker",
      key: "locker",
      isRequired: false,
      sortOrder: 2,
    },
  ],
  initialValues,
};

describe("Employee record editor lifecycle", () => {
  it("hydrates a draft from server initial values without sharing nested state", () => {
    const state = createEmployeeRecordEditorState({
      identity: { mode: "edit", employeeId: "employee-1" },
      initialValues,
    });

    expect(state.draft).toEqual(initialValues);
    expect(state.draft).not.toBe(initialValues);
    expect(state.draft.customFieldValues).not.toBe(initialValues.customFieldValues);
  });

  it("immutably updates base and Custom Field values", () => {
    const state = createEmployeeRecordEditorState({
      identity: { mode: "create" },
      initialValues,
    });
    const named = updateEmployeeRecordField(state, "firstName", "Anaya");
    const customized = updateEmployeeRecordCustomField(named, "badge", "BN-2");

    expect(state.draft.firstName).toBe("Asha");
    expect(named.draft.firstName).toBe("Anaya");
    expect(named.draft.customFieldValues.badge).toBe("BN-1");
    expect(customized.draft.customFieldValues.badge).toBe("BN-2");
  });

  it("maps schema and required Custom Field errors", () => {
    const state = createEmployeeRecordEditorState({
      identity: { mode: "create" },
      initialValues: {
        ...initialValues,
        firstName: "",
        dateOfBirth: "not-a-date",
        seniorityRank: "0",
        customFieldValues: { badge: "   " },
      },
    });

    const result = prepareEmployeeRecordSubmission(state.draft, formDefinition.customFields);

    expect(result).toEqual({
      status: "invalid",
      errors: expect.objectContaining({
        firstName: "This field is required",
        dateOfBirth: "Date of birth must be a valid date",
        seniorityRank: "Seniority rank must be greater than zero",
        customFieldValues: { badge: "Badge number is required" },
      }),
    });
  });

  it("clears only the error for the edited field", () => {
    const withErrors = setEmployeeRecordEditorErrors(
      createEmployeeRecordEditorState({ identity: { mode: "create" }, initialValues }),
      {
        firstName: "This field is required",
        surname: "This field is required",
        customFieldValues: { badge: "Badge number is required", locker: "Invalid" },
      },
    );
    const baseUpdated = updateEmployeeRecordField(withErrors, "firstName", "Asha");
    const customUpdated = updateEmployeeRecordCustomField(baseUpdated, "badge", "BN-1");

    expect(customUpdated.errors).toEqual({
      surname: "This field is required",
      customFieldValues: { locker: "Invalid" },
    });
  });

  it("coerces rank, filters inactive Custom Fields, and preserves optional empty strings", () => {
    const result = prepareEmployeeRecordSubmission(initialValues, formDefinition.customFields);

    expect(result).toEqual({
      status: "ready",
      input: {
        ...initialValues,
        seniorityRank: 7,
        customFieldValues: { badge: "BN-1" },
      },
    });
    if (result.status === "ready") {
      expect(result.input.panNumber).toBe("");
      expect(result.input.npsAccountNumber).toBe("");
    }
  });

  it("maps Custom Field schema errors to the active field", () => {
    const result = prepareEmployeeRecordSubmission(
      {
        ...initialValues,
        customFieldValues: { badge: "x".repeat(1001) },
      },
      formDefinition.customFields,
    );

    expect(result).toEqual({
      status: "invalid",
      errors: {
        customFieldValues: {
          badge: expect.stringContaining("1000"),
        },
      },
    });
  });

  it("does not validate or submit stale inactive Custom Field values", () => {
    const result = prepareEmployeeRecordSubmission(
      {
        ...initialValues,
        customFieldValues: {
          badge: "BN-1",
          archived: "x".repeat(1001),
        },
      },
      formDefinition.customFields,
    );

    expect(result).toMatchObject({
      status: "ready",
      input: { customFieldValues: { badge: "BN-1" } },
    });
  });

  it("resets only when create/edit identity changes and hydrates once data arrives", () => {
    const loading = createEmployeeRecordEditorState({
      identity: { mode: "edit", employeeId: "employee-1" },
    });
    const hydrated = reconcileEmployeeRecordEditor(loading, {
      identity: { mode: "edit", employeeId: "employee-1" },
      initialValues,
    });
    const edited = updateEmployeeRecordField(hydrated, "firstName", "Edited");
    const sameIdentity = reconcileEmployeeRecordEditor(edited, {
      identity: { mode: "edit", employeeId: "employee-1" },
      initialValues: { ...initialValues, firstName: "Refetched" },
    });
    const nextIdentity = reconcileEmployeeRecordEditor(edited, {
      identity: { mode: "edit", employeeId: "employee-2" },
      initialValues: { ...initialValues, firstName: "Neha" },
    });

    expect(hydrated.draft.firstName).toBe("Asha");
    expect(sameIdentity).toBe(edited);
    expect(nextIdentity).toMatchObject({
      identity: { mode: "edit", employeeId: "employee-2" },
      isHydrated: true,
      draft: { firstName: "Neha" },
      errors: {},
    });
  });
});
