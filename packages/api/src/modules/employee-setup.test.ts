import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import {
  assertCompleteReorderPayload,
  assertNoDuplicateActiveLabel,
  buildFieldKeyBase,
  buildUniqueFieldKey,
} from "./employee-setup";

describe("Employee Setup Custom Fields", () => {
  it("rejects duplicate active Custom Field labels case-insensitively", () => {
    expect(() =>
      assertNoDuplicateActiveLabel(
        [
          { label: "Badge Number", isActive: true },
          { label: "Archived Code", isActive: false },
        ],
        " badge number ",
      ),
    ).toThrow(TRPCError);
  });

  it("allows duplicate labels when the previous Custom Field is archived", () => {
    expect(() =>
      assertNoDuplicateActiveLabel([{ label: "Badge Number", isActive: false }], "Badge Number"),
    ).not.toThrow();
  });

  it("generates stable Custom Field key bases", () => {
    expect(buildFieldKeyBase("  Badge Number! ")).toBe("badge_number");
    expect(buildFieldKeyBase("   ")).toBe("field");
  });

  it("generates unique Custom Field keys", () => {
    expect(buildUniqueFieldKey("Badge Number", ["badge_number", "badge_number_2"])).toBe(
      "badge_number_3",
    );
  });
});

describe("Employee Setup reorder validation", () => {
  it("rejects incomplete Designation reorder payloads", () => {
    expect(() =>
      assertCompleteReorderPayload(["designation-1", "designation-2"], ["designation-1"], "Designation"),
    ).toThrow("Designation reorder payload is incomplete");
  });

  it("rejects foreign Designation reorder IDs", () => {
    expect(() =>
      assertCompleteReorderPayload(
        ["designation-1", "designation-2"],
        ["designation-1", "foreign"],
        "Designation",
      ),
    ).toThrow("Designation reorder payload contains invalid items");
  });
});
