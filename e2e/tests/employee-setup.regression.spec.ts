import { expect, test } from "../src/fixtures";
import {
  addOptionalCustomField,
  addRequiredCustomField,
  archiveCustomField,
  archiveDesignation,
  clickDesignationMove,
  createDesignation,
  expectAccessible,
  expectDesignationOrder,
  goToEmployeeCreate,
  goToInstitutionSettings,
  pressEnter,
  pressEscape,
  pressSpace,
  signIn,
  signOut,
  simulateNetworkFailure,
  simulateServerError,
  simulateSlowResponse,
  simulateUnauthorized,
  simulateValidationFailure,
  tabUntilFocused,
} from "../src/helpers";

test.describe("employee-setup regression suite", () => {
  test.describe("1. Designation Configuration & Lifecycle", () => {
    test("validates required & max length, creates multiple designations, preserves ordering across moves & reloads, and performs narrowly scoped archival", async ({
      page,
      provisionedInstitution,
      runId,
    }) => {
      // 1. Sign in as institution user
      await signIn(
        page,
        provisionedInstitution.username,
        provisionedInstitution.password,
      );
      await goToInstitutionSettings(page);

      // --- A. Validation Boundaries ---
      // Empty submission
      await page.getByRole("button", { name: "Create Designation" }).click();
      await expect(
        page.getByText("Designation name is required"),
      ).toBeVisible();
      await expect(page.getByLabel("Designation name")).toHaveAttribute(
        "aria-invalid",
        "true",
      );

      // Maximum length boundary (> 120 chars)
      const overLongName = `Headmaster_${runId}_${"A".repeat(125)}`;
      await page.getByLabel("Designation name").fill(overLongName);
      await page.getByRole("button", { name: "Create Designation" }).click();
      await expect(
        page.getByText("Designation name is too long"),
      ).toBeVisible();
      // Form preserves input value
      await expect(page.getByLabel("Designation name")).toHaveValue(
        overLongName,
      );

      // --- B. Successful Creation of Multiple Designations ---
      const desig1 = `Headmaster_${runId}`;
      const desig2 = `Assistant Teacher_${runId}`;
      const desig3 = `Lab Assistant_${runId}`;

      await page.getByLabel("Designation name").fill(desig1);
      await page.getByRole("button", { name: "Create Designation" }).click();
      await expect(
        page.getByTestId("designation-name").filter({ hasText: desig1 }),
      ).toBeVisible();
      await expect(page.getByLabel("Designation name")).toHaveValue("");

      await createDesignation(page, desig2);
      await createDesignation(page, desig3);

      // Initial creation order: desig1, desig2, desig3
      await expectDesignationOrder(page, [desig1, desig2, desig3]);

      // --- C. Reordering Items Up and Down ---
      // Move desig3 up (now: desig1, desig3, desig2)
      await clickDesignationMove(page, desig3, "up");
      await expectDesignationOrder(page, [desig1, desig3, desig2]);

      // Move desig1 down (now: desig3, desig1, desig2)
      await clickDesignationMove(page, desig1, "down");
      await expectDesignationOrder(page, [desig3, desig1, desig2]);

      // Move desig3 down (now: desig1, desig3, desig2)
      await clickDesignationMove(page, desig3, "down");
      await expectDesignationOrder(page, [desig1, desig3, desig2]);

      // --- D. Persistence after Reload & Navigation ---
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Employee Setup" }),
      ).toBeVisible();
      await expectDesignationOrder(page, [desig1, desig3, desig2]);

      // Navigate away to employee creation and back to verify persistence
      await goToEmployeeCreate(page);
      await goToInstitutionSettings(page);
      await expectDesignationOrder(page, [desig1, desig3, desig2]);

      // --- E. Narrowly Scoped Archival with Confirmation Modal ---
      // 1. Click Remove on desig3, but Cancel in modal
      const desig3Row = page.getByTestId("designation-row").filter({
        has: page
          .getByTestId("designation-name")
          .filter({ hasText: new RegExp(`^${desig3}$`) }),
      });
      await desig3Row
        .getByRole("button", { name: `Remove ${desig3}`, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Remove Designation" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(
        page.getByRole("heading", { name: "Remove Designation" }),
      ).toHaveCount(0);
      // desig3 is still present
      await expect(
        page.getByTestId("designation-name").filter({ hasText: desig3 }),
      ).toBeVisible();

      // 2. Click Remove on desig3 and Confirm removal
      await archiveDesignation(page, desig3);

      // Verify only desig3 is removed, while desig1 and desig2 remain intact
      await expect(
        page.getByTestId("designation-name").filter({ hasText: desig3 }),
      ).toHaveCount(0);
      await expect(
        page.getByTestId("designation-name").filter({ hasText: desig1 }),
      ).toBeVisible();
      await expect(
        page.getByTestId("designation-name").filter({ hasText: desig2 }),
      ).toBeVisible();
      await expectDesignationOrder(page, [desig1, desig2]);

      // Reload to ensure archival and remaining order persist
      await page.reload();
      await expect(
        page.getByTestId("designation-name").filter({ hasText: desig3 }),
      ).toHaveCount(0);
      await expectDesignationOrder(page, [desig1, desig2]);

      await signOut(page);
    });
  });

  test.describe("2. Employee Custom-Field Configuration & Form Integration", () => {
    test("validates custom field label boundaries, adds required & optional fields, verifies form visibility and persistence, and verifies scoped archival", async ({
      page,
      provisionedInstitution,
      runId,
    }) => {
      // 1. Sign in as institution user
      await signIn(
        page,
        provisionedInstitution.username,
        provisionedInstitution.password,
      );
      await goToEmployeeCreate(page);

      // --- A. Validation Boundaries ---
      // Empty label submission
      await page.getByRole("button", { name: "Add Field" }).click();
      await expect(page.getByText("Field label is required")).toBeVisible();
      await expect(page.getByLabel("Field label")).toHaveAttribute(
        "aria-invalid",
        "true",
      );

      // Maximum length boundary (> 120 chars)
      const overLongLabel = `CustomField_${runId}_${"B".repeat(125)}`;
      await page.getByLabel("Field label").fill(overLongLabel);
      await page.getByRole("button", { name: "Add Field" }).click();
      await expect(page.getByText("Field label is too long")).toBeVisible();
      await expect(page.getByLabel("Field label")).toHaveValue(overLongLabel);

      // --- B. Create Required and Optional Custom Fields ---
      const reqFieldLabel = `Aadhaar Verified_${runId}`;
      const optFieldLabel = `Bus Route_${runId}`;

      // Create Required Field (checkbox checked)
      await addRequiredCustomField(page, reqFieldLabel);
      // Create Optional Field (checkbox unchecked)
      await addOptionalCustomField(page, optFieldLabel);

      // --- C. Verify Custom Field Manager Listing & Form Inputs ---
      // Manager row verification
      const reqManagerRow = page.getByTestId("custom-field-manager-row").filter({
        has: page
          .getByTestId("custom-field-manager-name")
          .filter({ hasText: new RegExp(`^${reqFieldLabel}\\s+\\*$`) }),
      });
      const optManagerRow = page.getByTestId("custom-field-manager-row").filter({
        has: page
          .getByTestId("custom-field-manager-name")
          .filter({ hasText: new RegExp(`^${optFieldLabel}$`) }),
      });
      await expect(reqManagerRow).toBeVisible();
      await expect(optManagerRow).toBeVisible();

      // Form input verification (Required field has '*', optional field does not)
      await expect(page.getByLabel(`${reqFieldLabel} *`)).toBeVisible();
      await expect(page.getByLabel(optFieldLabel, { exact: true })).toBeVisible();

      // --- D. Form Integration Persistence across Page Reload & Navigation ---
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Create Employee" }),
      ).toBeVisible();
      await expect(reqManagerRow).toBeVisible();
      await expect(optManagerRow).toBeVisible();
      await expect(page.getByLabel(`${reqFieldLabel} *`)).toBeVisible();
      await expect(page.getByLabel(optFieldLabel, { exact: true })).toBeVisible();

      // Navigate to Employee Setup and back to Create Employee
      await goToInstitutionSettings(page);
      await goToEmployeeCreate(page);
      await expect(page.getByLabel(`${reqFieldLabel} *`)).toBeVisible();
      await expect(page.getByLabel(optFieldLabel, { exact: true })).toBeVisible();

      // --- E. Narrowly Scoped Archival with Confirmation Modal ---
      // 1. Cancel removal modal test
      await optManagerRow
        .getByRole("button", { name: `Remove ${optFieldLabel}`, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Remove Custom Field" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(
        page.getByRole("heading", { name: "Remove Custom Field" }),
      ).toHaveCount(0);
      // optFieldLabel is still visible in manager and form
      await expect(optManagerRow).toBeVisible();
      await expect(page.getByLabel(optFieldLabel, { exact: true })).toBeVisible();

      // 2. Confirm removal of optFieldLabel
      await archiveCustomField(page, optFieldLabel);

      // Verify only optFieldLabel was removed; reqFieldLabel remains in manager and form
      await expect(
        page.getByLabel(optFieldLabel, { exact: true }),
      ).toHaveCount(0);
      await expect(optManagerRow).toHaveCount(0);

      await expect(reqManagerRow).toBeVisible();
      await expect(page.getByLabel(`${reqFieldLabel} *`)).toBeVisible();

      // Reload page and confirm persisted removal
      await page.reload();
      await expect(
        page.getByLabel(optFieldLabel, { exact: true }),
      ).toHaveCount(0);
      await expect(reqManagerRow).toBeVisible();
      await expect(page.getByLabel(`${reqFieldLabel} *`)).toBeVisible();

      await signOut(page);
    });
  });

  test.describe("3. Session, Access Control & Route Guarding", () => {
    test("verifies institution user access to setup, redirection from admin routes, and signed-out route protection", async ({
      page,
      provisionedInstitution,
    }) => {
      // 1. Sign in as institution user
      await signIn(
        page,
        provisionedInstitution.username,
        provisionedInstitution.password,
      );

      // 2. Institution user can access Employee Setup
      await goToInstitutionSettings(page);
      await expect(
        page.getByRole("heading", { name: "Employee Setup" }),
      ).toBeVisible();

      // 3. Institution user is blocked from admin routes -> redirected to /dashboard
      await page.goto("/institutions");
      await expect(page).toHaveURL(/\/dashboard$/);

      await page.goto("/institutions/create");
      await expect(page).toHaveURL(/\/dashboard$/);

      await page.goto("/admin/custom-fields");
      await expect(page).toHaveURL(/\/dashboard$/);

      // 4. Sign out
      await signOut(page);
      await expect(page).toHaveURL(/\/sign-in$/);

      // 5. Unauthenticated visits to protected routes redirect to /sign-in
      await page.goto("/institution-settings");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/employee/create");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/institutions");
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  });

  test.describe("4. Accessibility & Keyboard Operability", () => {
    test("passes automated accessibility checks and operates designation & custom-field setup purely through keyboard", async ({
      page,
      provisionedInstitution,
      runId,
    }) => {
      // 1. Sign in as institution user
      await signIn(
        page,
        provisionedInstitution.username,
        provisionedInstitution.password,
      );

      // --- A. Accessibility Audits ---
      await goToInstitutionSettings(page);
      await expectAccessible(page);

      await goToEmployeeCreate(page);
      await expectAccessible(page);

      // --- B. Keyboard Operability: Designation Setup ---
      await goToInstitutionSettings(page);
      const kbDesig1 = `KB Senior Master_${runId}`;
      const kbDesig2 = `KB Junior Clerk_${runId}`;

      // Create kbDesig1 via keyboard
      await page.getByLabel("Designation name").focus();
      await page.keyboard.type(kbDesig1);
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: "Create Designation" }),
      );
      await pressEnter(page);
      await expect(
        page.getByTestId("designation-name").filter({ hasText: kbDesig1 }),
      ).toBeVisible();

      // Create kbDesig2 via keyboard
      await page.getByLabel("Designation name").focus();
      await page.keyboard.type(kbDesig2);
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: "Create Designation" }),
      );
      await pressEnter(page);
      await expect(
        page.getByTestId("designation-name").filter({ hasText: kbDesig2 }),
      ).toBeVisible();

      // Initial keyboard order
      await expectDesignationOrder(page, [kbDesig1, kbDesig2]);

      // Move kbDesig2 up via keyboard
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: `Move ${kbDesig2} up` }),
      );
      await pressEnter(page);
      await expectDesignationOrder(page, [kbDesig2, kbDesig1]);

      // Modal Cancel test via keyboard (Escape key)
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: `Remove ${kbDesig2}` }),
      );
      await pressEnter(page);
      await expect(
        page.getByRole("heading", { name: "Remove Designation" }),
      ).toBeVisible();
      await pressEscape(page);
      await expect(
        page.getByRole("heading", { name: "Remove Designation" }),
      ).toHaveCount(0);
      await expect(
        page.getByTestId("designation-name").filter({ hasText: kbDesig2 }),
      ).toBeVisible();

      // Archive kbDesig2 via keyboard confirmation (Tab to confirm button & Enter)
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: `Remove ${kbDesig2}` }),
      );
      await pressEnter(page);
      await expect(
        page.getByRole("heading", { name: "Remove Designation" }),
      ).toBeVisible();
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: "Remove Designation" }),
      );
      await pressEnter(page);

      // Verify kbDesig2 removed, kbDesig1 remains
      await expect(
        page.getByTestId("designation-name").filter({ hasText: kbDesig2 }),
      ).toHaveCount(0);
      await expect(
        page.getByTestId("designation-name").filter({ hasText: kbDesig1 }),
      ).toBeVisible();

      // --- C. Keyboard Operability: Custom Field Setup ---
      await goToEmployeeCreate(page);
      const kbFieldLabel = `KB Shift Timing_${runId}`;

      // Create required custom field using keyboard
      await page.getByLabel("Field label").focus();
      await page.keyboard.type(kbFieldLabel);

      // Tab to Required checkbox and toggle with Space
      await tabUntilFocused(
        page,
        page.getByRole("checkbox", { name: "Required" }),
      );
      await pressSpace(page);
      await expect(
        page.getByRole("checkbox", { name: "Required" }),
      ).toBeChecked();

      // Tab to Add Field button and submit with Enter
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: "Add Field" }),
      );
      await pressEnter(page);

      // Verify custom field rendered in manager and form
      await expect(
        page.getByTestId("custom-field-manager-name").filter({
          hasText: new RegExp(`^${kbFieldLabel}\\s+\\*$`),
        }),
      ).toBeVisible();
      await expect(page.getByLabel(`${kbFieldLabel} *`)).toBeVisible();

      // Modal Cancel test via keyboard for custom field
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: `Remove ${kbFieldLabel}` }),
      );
      await pressEnter(page);
      await expect(
        page.getByRole("heading", { name: "Remove Custom Field" }),
      ).toBeVisible();
      await tabUntilFocused(page, page.getByRole("button", { name: "Cancel" }));
      await pressEnter(page);
      await expect(
        page.getByRole("heading", { name: "Remove Custom Field" }),
      ).toHaveCount(0);
      await expect(page.getByLabel(`${kbFieldLabel} *`)).toBeVisible();

      // Archive custom field via keyboard confirmation
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: `Remove ${kbFieldLabel}` }),
      );
      await pressEnter(page);
      await expect(
        page.getByRole("heading", { name: "Remove Custom Field" }),
      ).toBeVisible();
      await tabUntilFocused(
        page,
        page.getByRole("button", { name: "Remove Field" }),
      );
      await pressEnter(page);

      // Verify custom field removed from form and manager
      await expect(page.getByLabel(`${kbFieldLabel} *`)).toHaveCount(0);

      await signOut(page);
    });
  });

  test.describe("5. Controlled Network Failure & Error Recovery", () => {
    test("gracefully handles server errors, validation failures, timeouts, and network drops without crashing or losing form state", async ({
      page,
      provisionedInstitution,
      runId,
    }) => {
      // 1. Sign in as institution user
      await signIn(
        page,
        provisionedInstitution.username,
        provisionedInstitution.password,
      );

      // --- A. Designation Setup Network Interceptions ---
      await goToInstitutionSettings(page);

      // 1. Server validation failure (400)
      const unroute400 = await simulateValidationFailure(
        page,
        "**/trpc/employeeSettings.createDesignation*",
        "Designation name contains unpermitted characters",
      );
      const testDesig400 = `Failed 400 Desig_${runId}`;
      await page.getByLabel("Designation name").fill(testDesig400);
      await page.getByRole("button", { name: "Create Designation" }).click();
      await expect(
        page.getByText("Designation name contains unpermitted characters"),
      ).toBeVisible();
      await expect(page.getByLabel("Designation name")).toHaveValue(testDesig400);
      await page.waitForTimeout(200);
      await unroute400();

      // 2. Server failure (500)
      const unroute500 = await simulateServerError(
        page,
        "**/trpc/employeeSettings.createDesignation*",
        500,
        "Database cluster unreachable",
      );
      const testDesig500 = `Failed 500 Desig_${runId}`;
      await page.getByLabel("Designation name").fill(testDesig500);
      await page.getByRole("button", { name: "Create Designation" }).click();
      await expect(
        page.getByText("Database cluster unreachable"),
      ).toBeVisible();
      await expect(page.getByLabel("Designation name")).toHaveValue(testDesig500);
      await page.waitForTimeout(200);
      await unroute500();

      // 3. Network failure / abort
      const unrouteAbort = await simulateNetworkFailure(
        page,
        "**/trpc/employeeSettings.createDesignation*",
      );
      const testDesigAbort = `Abort Desig_${runId}`;
      await page.getByLabel("Designation name").fill(testDesigAbort);
      await page.getByRole("button", { name: "Create Designation" }).click();
      await expect(
        page.getByRole("button", { name: "Create Designation" }),
      ).toBeVisible();
      await page.waitForTimeout(200);
      await unrouteAbort();

      // 4. Slow mutation & pending indicator
      const slowDesig = `Slow Desig_${runId}`;
      const unrouteSlow = await simulateSlowResponse(
        page,
        "**/trpc/employeeSettings.createDesignation*",
        1500,
      );
      await page.getByLabel("Designation name").fill(slowDesig);
      await page.getByRole("button", { name: "Create Designation" }).click();
      await expect(
        page.getByRole("button", { name: "Adding..." }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Adding..." }),
      ).toBeDisabled();
      await expect(
        page.getByTestId("designation-name").filter({ hasText: slowDesig }),
      ).toBeVisible();
      await unrouteSlow();

      // 5. Unauthorized (401) on archival
      const unroute401 = await simulateUnauthorized(
        page,
        "**/trpc/employeeSettings.archiveDesignation*",
        "UNAUTHORIZED",
      );
      const slowRow = page.getByTestId("designation-row").filter({
        has: page
          .getByTestId("designation-name")
          .filter({ hasText: new RegExp(`^${slowDesig}$`) }),
      });
      await slowRow
        .getByRole("button", { name: `Remove ${slowDesig}`, exact: true })
        .click();
      await page.getByRole("button", { name: "Remove Designation" }).click();
      await expect(page.getByText("UNAUTHORIZED")).toBeVisible();
      await page.waitForTimeout(200);
      await unroute401();

      // --- B. Custom Field Network Interceptions ---
      await goToEmployeeCreate(page);

      // 1. Server error (500) on addCustomField
      const unrouteCF500 = await simulateServerError(
        page,
        "**/trpc/employeeSettings.addCustomField*",
        500,
        "Failed to save custom field configuration",
      );
      const testCF500 = `Failed CF 500_${runId}`;
      await page.getByLabel("Field label").fill(testCF500);
      await page.getByRole("button", { name: "Add Field" }).click();
      await expect(
        page.getByText("Failed to save custom field configuration"),
      ).toBeVisible();
      await expect(page.getByLabel("Field label")).toHaveValue(testCF500);
      await page.waitForTimeout(200);
      await unrouteCF500();

      // 2. Slow response on addCustomField
      const slowCF = `Slow CF_${runId}`;
      const unrouteCFSlow = await simulateSlowResponse(
        page,
        "**/trpc/employeeSettings.addCustomField*",
        1500,
      );
      await page.getByLabel("Field label").fill(slowCF);
      await page.getByRole("button", { name: "Add Field" }).click();
      await expect(
        page.getByRole("button", { name: "Adding..." }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Adding..." }),
      ).toBeDisabled();
      await expect(
        page.getByTestId("custom-field-manager-name").filter({
          hasText: new RegExp(`^${slowCF}$`),
        }),
      ).toBeVisible();
      await unrouteCFSlow();

      await signOut(page);
    });
  });
});
