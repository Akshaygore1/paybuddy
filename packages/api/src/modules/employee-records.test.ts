import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { validateSubmittedCustomFields } from "./employee-records";

describe("Employee record Custom Field validation", () => {
  const fieldDefinitions = [
    { id: "field-required", label: "Badge number", isRequired: true },
    { id: "field-optional", label: "Locker", isRequired: false },
  ];

  it("rejects blank submitted values for required Custom Fields", () => {
    expect(() =>
      validateSubmittedCustomFields(fieldDefinitions, {
        "field-required": "   ",
      }),
    ).toThrow(TRPCError);
  });

  it("rejects unknown Custom Field IDs", () => {
    expect(() =>
      validateSubmittedCustomFields(fieldDefinitions, {
        "field-required": "BN-1",
        "foreign-field": "nope",
      }),
    ).toThrow("Employee form contains invalid custom fields");
  });

  it("accepts optional blanks when required Custom Fields are present", () => {
    expect(() =>
      validateSubmittedCustomFields(fieldDefinitions, {
        "field-required": "BN-1",
        "field-optional": "",
      }),
    ).not.toThrow();
  });
});
