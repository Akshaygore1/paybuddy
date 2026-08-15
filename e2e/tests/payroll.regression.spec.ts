import { expect, test } from "../src/fixtures";
import {
  authenticateInstitutionViaApi,
  createEmployeeViaApi,
  downloadPayrollArtifact,
  employeeFullName as formatEmployeeFullName,
  expectAccessible,
  expectInstitutionNavigation,
  fillPayrollAmount,
  generateIndianEmployee,
  goToPayroll,
  payrollSectionCard,
  pressEnter,
  pressSpace,
  selectOption,
  simulateDownloadFailure,
  signIn,
  signOut,
  simulateNetworkFailure,
  simulateServerError,
  simulateSlowResponse,
  simulateUnauthorized,
  simulateValidationFailure,
  savePayrollViaApi,
  savePayrollAndWait,
  tabUntilFocused,
} from "../src/helpers";
import { updateRunManifest } from "../src/manifest";

test.describe("payroll regression suite", () => {
  test.describe.configure({ timeout: 120_000 });

  test.describe("1. Fixed/Custom Earnings, Deductions & Money Formatting", () => {
    test("validates money input boundaries, decimal precision, focus/blur formatting, live total calculations, and persistence", async ({
      page,
      provisionedPayrollPrerequisites,
    }) => {
      const { institution, employee } = provisionedPayrollPrerequisites;
      const employeeFullName = formatEmployeeFullName(employee);
      const financialYear = "2026-2027";
      const month = "April 2026";

      // 1. Sign in as institution user and navigate to Payroll
      await signIn(page, institution.username, institution.password);
      await goToPayroll(page);

      // 2. Select employee, financial year, and month
      await selectOption(page, "Select employee", employeeFullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", month);

      const basicPayInput = page.getByLabel("Basic Pay amount");
      const daInput = page.getByLabel("D.A. amount");
      const hraInput = page.getByLabel("HRA amount");
      const claInput = page.getByLabel("C.L.A amount");
      const profTaxInput = page.getByLabel("Professional Tax amount");
      const incomeTaxInput = page.getByLabel("Income Tax / TDS amount");
      const gpfInput = page.getByLabel("G.P.F amount");
      const saveButton = page.getByRole("button", { name: "Save Payroll" });

      // --- A. Money Input Validation & Boundaries ---

      // Empty value is treated as zero and does not block saving.
      await basicPayInput.fill("");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveAttribute("aria-invalid", "false");
      await expect(saveButton).toBeEnabled();

      // Malformed text -> error message, aria-invalid, Save disabled
      await fillPayrollAmount(basicPayInput, "malformed-abc");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Enter a valid amount.")).toBeVisible();
      await expect(saveButton).toBeDisabled();

      // Negative value -> error message, aria-invalid, Save disabled
      await fillPayrollAmount(basicPayInput, "-5000");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Enter a valid amount.")).toBeVisible();
      await expect(saveButton).toBeDisabled();

      // More than 2 decimal places -> invalid
      await fillPayrollAmount(basicPayInput, "1234.567");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Enter a valid amount.")).toBeVisible();
      await expect(saveButton).toBeDisabled();

      // Decimal precision (2 decimal places) -> valid
      await fillPayrollAmount(basicPayInput, "1234.50");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveAttribute("aria-invalid", "false");
      await expect(page.getByText("Enter a valid amount.")).toHaveCount(0);
      await expect(saveButton).toBeEnabled();
      await expect(basicPayInput).toHaveValue("1,234.50");

      // Zero value -> formatted as 0.00 on blur
      await fillPayrollAmount(basicPayInput, "0");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveValue("0.00");

      // Large valid value -> Indian currency grouping on blur
      await fillPayrollAmount(basicPayInput, "1000000");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveValue("10,00,000.00");

      // Focus formatting: stripped grouping on focus, formatted on blur
      await basicPayInput.focus();
      await expect(basicPayInput).toHaveValue("1000000.00");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveValue("10,00,000.00");

      // --- B. Fill Realistic Indian Payroll Earnings & Deductions ---
      // Earnings: Basic (50000), DA (25000), HRA (12000), CLA (8000) -> Total = 95,000.00
      await fillPayrollAmount(basicPayInput, "50000");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveValue("50,000.00");

      await fillPayrollAmount(daInput, "25000");
      await daInput.blur();
      await expect(daInput).toHaveValue("25,000.00");

      await fillPayrollAmount(hraInput, "12000");
      await hraInput.blur();
      await expect(hraInput).toHaveValue("12,000.00");

      await fillPayrollAmount(claInput, "8000");
      await claInput.blur();
      await expect(claInput).toHaveValue("8,000.00");

      // Deductions: Prof Tax (200), Income Tax (4500), GPF (6000) -> Total = 10,700.00
      await fillPayrollAmount(profTaxInput, "200");
      await profTaxInput.blur();
      await expect(profTaxInput).toHaveValue("200.00");

      await fillPayrollAmount(incomeTaxInput, "4500");
      await incomeTaxInput.blur();
      await expect(incomeTaxInput).toHaveValue("4,500.00");

      await fillPayrollAmount(gpfInput, "6000");
      await gpfInput.blur();
      await expect(gpfInput).toHaveValue("6,000.00");

      // --- C. Assert Live Calculated Totals ---
      // Gross Earnings = 95,000.00
      await expect(page.getByText("Total Earnings").locator("..")).toContainText("₹95,000.00");
      // Total Deductions = 10,700.00
      await expect(page.getByText("Total Deductions").locator("..")).toContainText("₹10,700.00");
      // Net Pay = 95,000.00 - 10,700.00 = 84,300.00
      await expect(page.getByText("Net pay").locator("..")).toContainText("₹84,300.00");

      // --- D. Save & Verify Persistence Beyond Reload ---
      await saveButton.click();
      await expect(page.getByText("Payroll saved")).toBeVisible();

      // Reload page and re-select
      await page.reload();
      await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();

      await selectOption(page, "Select employee", employeeFullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", month);

      // Verify persisted input values
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("50,000.00");
      await expect(page.getByLabel("D.A. amount")).toHaveValue("25,000.00");
      await expect(page.getByLabel("HRA amount")).toHaveValue("12,000.00");
      await expect(page.getByLabel("C.L.A amount")).toHaveValue("8,000.00");
      await expect(page.getByLabel("Professional Tax amount")).toHaveValue("200.00");
      await expect(page.getByLabel("Income Tax / TDS amount")).toHaveValue("4,500.00");
      await expect(page.getByLabel("G.P.F amount")).toHaveValue("6,000.00");

      // Verify persisted totals
      await expect(page.getByText("Total Earnings").locator("..")).toContainText("₹95,000.00");
      await expect(page.getByText("Total Deductions").locator("..")).toContainText("₹10,700.00");
      await expect(page.getByText("Net pay").locator("..")).toContainText("₹84,300.00");

      await signOut(page);
    });
  });

  test.describe("2. Custom Payroll Fields Management", () => {
    test("validates field label boundaries, duplicate detection (fixed & custom), focus placement, fixed field protection, and scoped archival", async ({
      page,
      provisionedPayrollPrerequisites,
      runId,
    }) => {
      const { institution, employee } = provisionedPayrollPrerequisites;
      const employeeFullName = formatEmployeeFullName(employee);
      const financialYear = "2026-2027";
      const month = "May 2026";
      const customEarningLabel = `Conveyance Allowance ${runId}`;
      const customDeductionLabel = `Festival Advance ${runId}`;

      await signIn(page, institution.username, institution.password);
      await goToPayroll(page);

      await selectOption(page, "Select employee", employeeFullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", month);

      const earningsCard = payrollSectionCard(page, "Earnings").first();
      const deductionsCard = payrollSectionCard(page, "Deductions").first();

      const addEarningFieldButton = earningsCard.getByRole("button", { name: "Add field" });
      const addDeductionFieldButton = deductionsCard.getByRole("button", { name: "Add field" });

      // --- A. Field Validation Boundaries ---
      await addEarningFieldButton.click();
      await expect(page.getByLabel("Field name")).toBeVisible();

      // Empty submission
      await earningsCard.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText("Field name is required")).toBeVisible();

      // Over 120 characters
      const overLongName = "Allowance".repeat(15) + "ExtraLongPayrollFieldNameBeyondBoundary";
      await page.getByLabel("Field name").fill(overLongName);
      await earningsCard.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText("Field name must be 120 characters or fewer")).toBeVisible();

      // Cancel button closes form
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByLabel("Field name")).toHaveCount(0);

      // --- B. Duplicate Detection: Fixed Field Name (Case-Insensitive) ---
      await addEarningFieldButton.click();
      await page.getByLabel("Field name").fill("basic pay");
      await earningsCard.getByRole("button", { name: "Add", exact: true }).click();
      await expect(
        page
          .getByText("A payroll field with this label already exists in this section", {
            exact: true,
          })
          .first(),
      ).toBeVisible();

      await page.getByRole("button", { name: "Cancel" }).click();

      // --- C. Add Custom Earning & Verify Focus Shift ---
      await addEarningFieldButton.click();
      await page.getByLabel("Field name").fill(customEarningLabel);
      await earningsCard.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText("Payroll field added", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Field name")).toHaveCount(0);

      // Focus should automatically move to the newly created field amount input
      const customEarningAmountInput = page.getByLabel(`${customEarningLabel} amount`);
      await expect(customEarningAmountInput).toBeVisible();
      await expect(customEarningAmountInput).toBeFocused();
      await fillPayrollAmount(customEarningAmountInput, "3000");
      await customEarningAmountInput.blur();

      await page.getByRole("button", { name: "Save Payroll" }).click();
      await expect(page.getByText("Payroll saved", { exact: true }).first()).toBeVisible();

      // --- D. Duplicate Detection: Existing Custom Field Name ---
      await addEarningFieldButton.click();
      await page.getByLabel("Field name").fill(customEarningLabel.toLowerCase());
      await earningsCard.getByRole("button", { name: "Add", exact: true }).click();
      await expect(
        page
          .getByText("A payroll field with this label already exists in this section", {
            exact: true,
          })
          .first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();

      // --- E. Add Custom Deduction Field & Update Amounts ---
      await addDeductionFieldButton.click();
      await page.getByLabel("Field name").fill(customDeductionLabel);
      await deductionsCard.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText("Payroll field added", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Field name")).toHaveCount(0);

      const customDeductionAmountInput = page.getByLabel(`${customDeductionLabel} amount`);
      await expect(customDeductionAmountInput).toBeVisible();
      await expect(customDeductionAmountInput).toBeFocused();
      await fillPayrollAmount(customDeductionAmountInput, "1500");
      await customDeductionAmountInput.blur();

      // Enter Basic Pay and Professional Tax to calculate combined totals
      await fillPayrollAmount(page.getByLabel("Basic Pay amount"), "50000");
      await page.getByLabel("Basic Pay amount").blur();
      await fillPayrollAmount(page.getByLabel("Professional Tax amount"), "200");
      await page.getByLabel("Professional Tax amount").blur();

      // Total Earnings = 50,000 + 3,000 = 53,000.00
      await expect(page.getByText("Total Earnings").locator("..")).toContainText("₹53,000.00");
      // Total Deductions = 200 + 1,500 = 1,700.00
      await expect(page.getByText("Total Deductions").locator("..")).toContainText("₹1,700.00");
      // Net Pay = 53,000 - 1,700 = 51,300.00
      await expect(page.getByText("Net pay").locator("..")).toContainText("₹51,300.00");

      // --- F. Fixed Field Protection: No remove buttons on fixed fields ---
      await expect(page.getByRole("button", { name: "Remove Basic Pay" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Remove D.A." })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Remove Professional Tax" })).toHaveCount(0);

      // Save payroll with custom fields
      await page.getByRole("button", { name: "Save Payroll" }).click();
      await expect(page.getByText("Payroll saved")).toBeVisible();

      // --- G. Scoped Archival with Confirmation Modal ---
      const removeDeductionButton = page.getByRole("button", {
        name: `Remove ${customDeductionLabel}`,
      });
      await expect(removeDeductionButton).toBeVisible();

      // 1. Click Remove -> Cancel in modal -> Field stays
      await removeDeductionButton.click();
      await expect(page.getByRole("heading", { name: "Remove Payroll Field" })).toBeVisible();
      await expect(
        page.getByText(`Remove ‘${customDeductionLabel}’ from May 2026 onward?`),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("heading", { name: "Remove Payroll Field" })).toHaveCount(0);
      await expect(page.getByLabel(`${customDeductionLabel} amount`)).toBeVisible();

      // 2. Click Remove -> Confirm -> Field is archived
      await removeDeductionButton.click();
      await expect(page.getByRole("heading", { name: "Remove Payroll Field" })).toBeVisible();
      await page.getByRole("button", { name: "Remove Field" }).click();
      await expect(page.getByText("Payroll field archived")).toBeVisible();

      // Custom deduction is now removed from active fields
      await expect(
        page.getByRole("button", { name: `Remove ${customDeductionLabel}` }),
      ).toHaveCount(0);

      await signOut(page);
    });
  });

  test.describe("3. Unsaved Changes Confirmation", () => {
    test("prompts confirmation when navigating away with dirty state and respects cancel-and-stay versus confirm-and-discard", async ({
      page,
      provisionedPayrollPrerequisites,
    }) => {
      const { institution, employee } = provisionedPayrollPrerequisites;
      const employeeFullName = formatEmployeeFullName(employee);
      const financialYear = "2026-2027";

      await signIn(page, institution.username, institution.password);
      await goToPayroll(page);

      await selectOption(page, "Select employee", employeeFullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");

      // 1. Make an edit to create dirty state
      const basicPayInput = page.getByLabel("Basic Pay amount");
      await fillPayrollAmount(basicPayInput, "60000");
      await basicPayInput.blur();
      await expect(basicPayInput).toHaveValue("60,000.00");

      // --- A. Cancel and Stay: Dismiss confirmation dialog ---
      let dialogMessage = "";
      page.once("dialog", async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      // Attempt to change month
      await selectOption(page, "Select payroll month", "May 2026");

      expect(dialogMessage).toContain("Discard your unsaved payroll changes?");
      // Selection stayed on April 2026, unsaved value is preserved
      await expect(page.getByRole("combobox", { name: "Select payroll month" })).toContainText(
        "2026-04",
      );
      await expect(basicPayInput).toHaveValue("60,000.00");

      // --- B. Confirm and Discard: Accept confirmation dialog ---
      dialogMessage = "";
      page.once("dialog", async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Change month again
      await selectOption(page, "Select payroll month", "May 2026");

      expect(dialogMessage).toContain("Discard your unsaved payroll changes?");
      // Selection switched to May 2026
      await expect(page.getByRole("combobox", { name: "Select payroll month" })).toContainText(
        "2026-05",
      );

      await signOut(page);
    });
  });

  test.describe("4. Persistence Across Employees, Periods & Reloads", () => {
    test("verifies isolated payroll profiles across multiple employees, months, and page reloads", async ({
      page,
      env,
      provisionedPayrollPrerequisites,
      runId,
    }) => {
      const { institution, designation, employee: employee1 } = provisionedPayrollPrerequisites;
      const employee1FullName = formatEmployeeFullName(employee1);

      // Provision Employee 2 via API
      const { cookieHeader } = await authenticateInstitutionViaApi(env, {
        username: institution.username,
        password: institution.password,
      });
      const employee2Seed = generateIndianEmployee(`${runId}emp2`);
      const employee2 = await createEmployeeViaApi(env, cookieHeader, {
        ...employee2Seed,
        designationId: designation.id,
      });
      const employee2FullName = formatEmployeeFullName(employee2);
      await updateRunManifest(runId, (previous) => ({
        ...previous,
        createdEmployees: [
          ...(previous.createdEmployees ?? []),
          {
            id: employee2.id,
            displayName: employee2FullName,
            institutionName: institution.name,
          },
        ],
      }));

      const financialYear = "2026-2027";

      // 1. Sign in and navigate to Payroll
      await signIn(page, institution.username, institution.password);
      await goToPayroll(page);

      // --- Save Payroll for Employee 1 (April 2026) ---
      await selectOption(page, "Select employee", employee1FullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");

      await fillPayrollAmount(page.getByLabel("Basic Pay amount"), "55000");
      await page.getByLabel("Basic Pay amount").blur();
      await fillPayrollAmount(page.getByLabel("Professional Tax amount"), "200");
      await page.getByLabel("Professional Tax amount").blur();
      await page.getByRole("button", { name: "Save Payroll" }).click();
      await expect(page.getByText("Payroll saved")).toBeVisible();

      // --- Save Payroll for Employee 2 (April 2026) ---
      await selectOption(page, "Select employee", employee2FullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");

      await fillPayrollAmount(page.getByLabel("Basic Pay amount"), "42000");
      await page.getByLabel("Basic Pay amount").blur();
      await fillPayrollAmount(page.getByLabel("Professional Tax amount"), "200");
      await page.getByLabel("Professional Tax amount").blur();
      await page.getByRole("button", { name: "Save Payroll" }).click();
      await expect(page.getByText("Payroll saved")).toBeVisible();

      // --- Verify Isolated State Switching Between Employees ---
      // Switch back to Employee 1
      await selectOption(page, "Select employee", employee1FullName);
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("55,000.00");
      await expect(page.getByText("Total Earnings").locator("..")).toContainText("₹55,000.00");
      await expect(page.getByText("Net pay").locator("..")).toContainText("₹54,800.00");

      // Switch back to Employee 2
      await selectOption(page, "Select employee", employee2FullName);
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("42,000.00");
      await expect(page.getByText("Total Earnings").locator("..")).toContainText("₹42,000.00");
      await expect(page.getByText("Net pay").locator("..")).toContainText("₹41,800.00");

      // Switch month to May 2026
      await selectOption(page, "Select payroll month", "May 2026");
      await expect(page.getByRole("combobox", { name: "Select payroll month" })).toContainText(
        "2026-05",
      );

      // --- Reload Page & Assert Long-Term Persistence ---
      await page.reload();
      await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();

      // Check Employee 1 persisted values
      await selectOption(page, "Select employee", employee1FullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("55,000.00");
      await expect(page.getByText("Net pay").locator("..")).toContainText("₹54,800.00");

      // Check Employee 2 persisted values
      await selectOption(page, "Select employee", employee2FullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("42,000.00");
      await expect(page.getByText("Net pay").locator("..")).toContainText("₹41,800.00");

      // A separate financial year has its own payroll profile and must not inherit this year's data.
      await selectOption(page, "Select payroll financial year", "2025-2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("");
      await expect(page.getByText("Total Earnings").locator("..")).toContainText("₹0.00");

      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("42,000.00");

      await signOut(page);
    });
  });

  test.describe("5. Effective-Month History & Payslips", () => {
    test("keeps payroll isolated, applies later and backdated values, preserves historical fields, and downloads payslips", async ({
      page,
      env,
      provisionedPayrollPrerequisites,
      runId,
    }) => {
      const { institution, designation, employee: employee1 } = provisionedPayrollPrerequisites;
      const employee1FullName = formatEmployeeFullName(employee1);
      const financialYear = "2026-2027";
      const customFieldLabel = `Meal Allowance ${runId}`;

      const { cookieHeader } = await authenticateInstitutionViaApi(env, {
        username: institution.username,
        password: institution.password,
      });
      const employee2Seed = generateIndianEmployee(`${runId}-history-employee-2`);
      const employee2 = await createEmployeeViaApi(env, cookieHeader, {
        ...employee2Seed,
        designationId: designation.id,
      });
      const employee2FullName = formatEmployeeFullName(employee2);

      // Create a separate financial-year profile for employee 2 through the normal product API.
      await savePayrollViaApi(env, cookieHeader, {
        employeeId: employee2.id,
        financialYearStart: 2025,
        month: "2025-04",
        lineItems: [
          { section: "earnings", fixedFieldKey: "basicPay", amount: "30000" },
          { section: "deductions", fixedFieldKey: "professionalTax", amount: "100" },
        ],
      });

      await signIn(page, institution.username, institution.password);
      await goToPayroll(page);
      await selectOption(page, "Select employee", employee1FullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");

      const earningsCard = payrollSectionCard(page, "Earnings").first();
      await earningsCard.getByRole("button", { name: "Add field", exact: true }).click();
      await page.getByLabel("Field name").fill(customFieldLabel);
      await earningsCard.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText("Payroll field added", { exact: true })).toBeVisible();

      const customAmount = page.getByLabel(`${customFieldLabel} amount`);
      await expect(customAmount).toBeFocused();

      // April establishes the baseline. May and August create later effective versions.
      await fillPayrollAmount(page.getByLabel("Basic Pay amount"), "50000");
      await fillPayrollAmount(customAmount, "2000");
      await fillPayrollAmount(page.getByLabel("Professional Tax amount"), "200");
      await savePayrollAndWait(page);

      await selectOption(page, "Select payroll month", "June 2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("50,000.00");
      await expect(customAmount).toHaveValue("2,000.00");
      await fillPayrollAmount(page.getByLabel("Basic Pay amount"), "55000");
      await fillPayrollAmount(customAmount, "2500");
      await expect(page.getByRole("button", { name: "Save Payroll" })).toBeEnabled();
      await savePayrollAndWait(page);

      await selectOption(page, "Select payroll month", "August 2026");
      await expect(
        page.getByRole("row").filter({ hasText: "Basic Pay" }).getByRole("cell").nth(1),
      ).toHaveText("55,000.00");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("55,000.00");

      // A backdated May save removes later overrides, so June and August inherit the correction.
      await selectOption(page, "Select payroll month", "May 2026");
      await fillPayrollAmount(page.getByLabel("Basic Pay amount"), "52000");
      await fillPayrollAmount(customAmount, "2200");
      await savePayrollAndWait(page);

      await selectOption(page, "Select payroll month", "June 2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("52,000.00");
      await expect(customAmount).toHaveValue("2,200.00");
      await selectOption(page, "Select payroll month", "August 2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("52,000.00");
      await expect(customAmount).toHaveValue("2,200.00");

      // The previous-month column is empty at the financial-year boundary.
      await selectOption(page, "Select payroll month", "April 2026");
      await expect(
        page.getByRole("row").filter({ hasText: "Basic Pay" }).getByRole("cell").nth(1),
      ).toHaveText("—");

      // Archive from July: April remains historically applicable while July and later hide it.
      await selectOption(page, "Select payroll month", "July 2026");
      const removeCustomField = page.getByRole("button", { name: `Remove ${customFieldLabel}` });
      await removeCustomField.click();
      await expect(page.getByRole("heading", { name: "Remove Payroll Field" })).toBeVisible();
      await page.getByRole("button", { name: "Remove Field" }).click();
      await expect(page.getByText("Payroll field archived", { exact: true })).toBeVisible();
      await expect(page.getByLabel(`${customFieldLabel} amount`)).toHaveCount(0);

      await selectOption(page, "Select payroll month", "April 2026");
      await expect(page.getByLabel(`${customFieldLabel} amount`)).toHaveValue("2,000.00");
      await expect(page.getByText("Archived", { exact: true })).toHaveCount(0);
      await selectOption(page, "Select payroll month", "July 2026");
      await expect(page.getByLabel(`${customFieldLabel} amount`)).toHaveCount(0);

      // Employee 2's FY2025 profile must not leak into employee 1 or FY2026.
      await selectOption(page, "Select payroll financial year", "2025-2026");
      await selectOption(page, "Select employee", employee2FullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll month", "April 2025");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("30,000.00");
      await expect(page.getByText("Net pay").locator("..")).toContainText("₹29,900.00");

      await selectOption(page, "Select employee", employee1FullName);
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("");
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("50,000.00");

      // Reload and revisit a saved historical period before generating both documents.
      await page.reload();
      await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();
      await selectOption(page, "Select employee", employee1FullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", financialYear);
      await selectOption(page, "Select payroll month", "April 2026");
      await expect(page.getByLabel("Basic Pay amount")).toHaveValue("50,000.00");
      await expect(page.getByLabel(`${customFieldLabel} amount`)).toHaveValue("2,000.00");

      const monthly = await downloadPayrollArtifact(page, "Download Monthly Payslip");
      expect(monthly.download.suggestedFilename()).toMatch(/^payslip-.*-apr-2026\.pdf$/);
      expect(monthly.bytes.byteLength).toBeGreaterThan(100);

      const annual = await downloadPayrollArtifact(page, "Download Annual Payslip");
      expect(annual.download.suggestedFilename()).toMatch(/^annual-payslip-.*2026-2027\.pdf$/);
      expect(annual.bytes.byteLength).toBeGreaterThan(100);

      const restoreFailedDownload = await simulateDownloadFailure(
        page,
        "Payslip generation failed for this run",
      );
      await page.getByRole("button", { name: "Download Monthly Payslip" }).click();
      await expect(
        page.getByText("Payslip generation failed for this run", { exact: true }),
      ).toBeVisible();
      await restoreFailedDownload();

      await updateRunManifest(runId, (previous) => ({
        ...previous,
        payrollRecord: {
          employeeName: employee1FullName,
          financialYear,
          month: "April 2026",
          basicPay: "50,000.00",
          deduction: "200.00",
          gross: "₹50,000.00",
          deductions: "₹200.00",
          net: "₹49,800.00",
        },
      }));

      await signOut(page);
    });
  });

  test.describe("6. Session, Access Control & Route Guarding", () => {
    test("verifies authorized payroll access, blocks institution user from admin routes, and enforces login redirect when logged out", async ({
      page,
      provisionedPayrollPrerequisites,
    }) => {
      const { institution } = provisionedPayrollPrerequisites;

      // 1. Institution user signs in
      await signIn(page, institution.username, institution.password);
      await expectInstitutionNavigation(page);

      // Access /payroll successfully
      await page.goto("/payroll");
      await expect(page).toHaveURL(/\/payroll$/);
      await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();

      // Role guard protection: Institution user navigating to admin-only routes is redirected to /dashboard
      await page.goto("/institutions");
      await expect(page).toHaveURL(/\/dashboard$/);

      await page.goto("/institutions/create");
      await expect(page).toHaveURL(/\/dashboard$/);

      await page.goto("/admin/custom-fields");
      await expect(page).toHaveURL(/\/dashboard$/);

      // 2. Sign out -> unauthenticated access to /payroll redirects to /sign-in
      await signOut(page);

      await page.goto("/payroll");
      await expect(page).toHaveURL(/\/sign-in$/);
      await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    });
  });

  test.describe("7. Accessibility & Keyboard Operability", () => {
    test("passes automated WCAG accessibility audits and supports full keyboard-only workflows for custom fields, amounts, and save", async ({
      page,
      provisionedPayrollPrerequisites,
      runId,
    }) => {
      const { institution, employee } = provisionedPayrollPrerequisites;
      const employeeFullName = formatEmployeeFullName(employee);
      const kbCustomFieldLabel = `KB Allowance ${runId}`;

      await signIn(page, institution.username, institution.password);
      await goToPayroll(page);

      // 1. Scan initial Payroll selection view
      await expectAccessible(page);

      // 2. Select employee and scan editor workspace
      await selectOption(page, "Select employee", employeeFullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", "2026-2027");
      await selectOption(page, "Select payroll month", "April 2026");

      await expectAccessible(page);

      // 3. Open Add Field form and scan
      const earningsCard = payrollSectionCard(page, "Earnings").first();
      await earningsCard.getByRole("button", { name: "Add field" }).click();
      await expect(page.getByLabel("Field name")).toBeVisible();
      await expectAccessible(page);

      // --- 4. Full Keyboard Operability ---
      // Type field name via keyboard
      await page.getByLabel("Field name").focus();
      await page.keyboard.type(kbCustomFieldLabel);

      // Tab to Add button and press Enter
      await tabUntilFocused(page, earningsCard.getByRole("button", { name: "Add", exact: true }));
      await pressEnter(page);
      await expect(page.getByText("Payroll field added")).toBeVisible();

      // Focused on newly created input automatically
      const kbAmountInput = page.getByLabel(`${kbCustomFieldLabel} amount`);
      await expect(kbAmountInput).toBeFocused();
      await page.keyboard.type("2500");

      // Keyboard navigation to Basic Pay and enter amount
      await page.getByLabel("Basic Pay amount").focus();
      await page.keyboard.type("48000");

      // Tab to Save Payroll button and trigger with Enter / Space
      const saveButton = page.getByRole("button", { name: "Save Payroll" });
      await tabUntilFocused(page, saveButton);
      await pressSpace(page);

      // Verify save completes
      await expect(page.getByText("Payroll saved")).toBeVisible();

      await signOut(page);
    });
  });

  test.describe("8. Controlled Network Failure & Error Recovery", () => {
    test("gracefully handles server validation errors, 500 crashes, network aborts, slow mutations, and 401 unauthorized states", async ({
      page,
      provisionedPayrollPrerequisites,
      runId,
    }) => {
      const { institution, employee } = provisionedPayrollPrerequisites;
      const employeeFullName = formatEmployeeFullName(employee);

      await signIn(page, institution.username, institution.password);
      await goToPayroll(page);

      await selectOption(page, "Select employee", employeeFullName);
      await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
      await selectOption(page, "Select payroll financial year", "2026-2027");
      await selectOption(page, "Select payroll month", "April 2026");

      const basicPayInput = page.getByLabel("Basic Pay amount");
      await fillPayrollAmount(basicPayInput, "62000");
      await basicPayInput.blur();

      // --- A. Server-Side Validation Failure (400) on Save ---
      const unroute400 = await simulateValidationFailure(
        page,
        "**/trpc/payroll.save*",
        "Invalid payroll period or employee configuration",
      );

      await page.getByRole("button", { name: "Save Payroll" }).click();
      await expect(
        page.getByText("Invalid payroll period or employee configuration"),
      ).toBeVisible();
      // Form input preserved
      await expect(basicPayInput).toHaveValue("62,000.00");
      await unroute400();

      // --- B. Server Failure (500) on Save ---
      const unroute500 = await simulateServerError(
        page,
        "**/trpc/payroll.save*",
        500,
        "Database connection lost during payroll transaction",
      );

      await page.getByRole("button", { name: "Save Payroll" }).click();
      await expect(
        page.getByText("Database connection lost during payroll transaction"),
      ).toBeVisible();
      // Form input preserved
      await expect(basicPayInput).toHaveValue("62,000.00");
      await unroute500();

      // --- C. Network Failure / Abort ---
      const unrouteAbort = await simulateNetworkFailure(page, "**/trpc/payroll.save*");
      await page.getByRole("button", { name: "Save Payroll" }).click();
      await expect(page.getByLabel("Notifications alt+T")).toContainText(/failed|network/i);
      await expect(basicPayInput).toHaveValue("62,000.00");
      // Page does not crash, save button remains visible
      await expect(page.getByRole("button", { name: "Save Payroll" })).toBeVisible();
      await unrouteAbort();

      // --- D. Slow Mutation & Pending State ---
      const unrouteSlow = await simulateSlowResponse(page, "**/trpc/payroll.save*", 1200);
      await page.getByRole("button", { name: "Save Payroll" }).click();

      // Assert pending button text and disabled state
      await expect(page.getByRole("button", { name: "Saving..." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Saving..." })).toBeDisabled();

      // Await success completion
      await expect(page.getByText("Payroll saved")).toBeVisible();
      await unrouteSlow();

      // --- E. Custom Field Mutation Failure ---
      const earningsCard = payrollSectionCard(page, "Earnings").first();
      await earningsCard.getByRole("button", { name: "Add field" }).click();
      await page.getByLabel("Field name").fill(`Failing Field ${runId}`);

      const unrouteField500 = await simulateServerError(
        page,
        "**/trpc/payroll.addCustomField*",
        500,
        "Unable to allocate new custom field definition",
      );

      await earningsCard.getByRole("button", { name: "Add", exact: true }).click();
      await expect(
        page.getByText("Unable to allocate new custom field definition", { exact: true }).first(),
      ).toBeVisible();
      await unrouteField500();
      await page.getByRole("button", { name: "Cancel" }).click();

      // --- F. Unauthorized / Session Expired (401) ---
      const unroute401 = await simulateUnauthorized(
        page,
        "**/trpc/payroll.save*",
        "Authentication session expired. Please sign in again.",
      );

      await page.getByRole("button", { name: "Save Payroll" }).click();
      await expect(
        page.getByText("Authentication session expired. Please sign in again."),
      ).toBeVisible();
      await unroute401();

      await signOut(page);
    });
  });
});
