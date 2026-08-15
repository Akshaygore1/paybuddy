import { expect, test } from "../src/fixtures";
import {
  expectInstitutionNavigation,
  fillPayrollAmount,
  goToPayroll,
  selectOption,
  signIn,
  signOut,
} from "../src/helpers";
import { updateRunManifest } from "../src/manifest";

test.describe("payroll smoke", () => {
  test("provisions institution, designation, and employee via API, saves payroll in browser, and verifies persistence across reload", async ({
    page,
    env,
    runId,
    provisionedPayrollPrerequisites,
  }) => {
    const { institution, designation, employee } = provisionedPayrollPrerequisites;
    const employeeFullName = [employee.firstName, employee.middleName, employee.surname]
      .filter(Boolean)
      .join(" ");
    const financialYear = "2026-2027";
    const month = "April 2026";
    const basicPayAmount = "45000";
    const deductionAmount = "200";

    // 1. Log run context for inspection (never log passwords)
    console.log(
      `[E2E Smoke: Payroll] Run ID: ${runId} | Institution: "${institution.name}" | Username: "${institution.username}" | Employee: "${employee.displayName}" | Target: ${env.baseURL}`,
    );
    test
      .info()
      .annotations.push(
        { type: "run-id", description: runId },
        { type: "institution-name", description: institution.name },
        { type: "institution-username", description: institution.username },
        { type: "designation-name", description: designation.name },
        { type: "employee-name", description: employee.displayName },
        { type: "financial-year", description: financialYear },
        { type: "month", description: month },
      );

    // 2. Sign in as the generated institution user
    await signIn(page, institution.username, institution.password);

    // 3. Verify role-appropriate navigation for institution user
    await expectInstitutionNavigation(page);

    // 4. Navigate to Payroll page
    await goToPayroll(page);

    // 5. Select employee, financial year, and payroll month
    await selectOption(page, "Select employee", employeeFullName);
    await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
    await selectOption(page, "Select payroll financial year", financialYear);
    await selectOption(page, "Select payroll month", month);

    // 6. Enter realistic Basic Pay amount and deduction amount
    await fillPayrollAmount(page.getByLabel("Basic Pay amount"), basicPayAmount);
    await fillPayrollAmount(page.getByLabel("Professional Tax amount"), deductionAmount);

    // 7. Verify calculated totals
    await expect(page.getByText("Total Earnings").locator("..")).toContainText("₹45,000.00");
    await expect(page.getByText("Total Deductions").locator("..")).toContainText("₹200.00");
    await expect(page.getByText("Net pay").locator("..")).toContainText("₹44,800.00");

    // 8. Save payroll and verify success notification
    await page.getByRole("button", { name: "Save Payroll" }).click();
    await expect(page.getByText("Payroll saved")).toBeVisible();

    // 9. Reload page to demonstrate persistence beyond toast
    await page.reload();
    await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();

    // Re-select the employee and month to load persisted payroll
    await selectOption(page, "Select employee", employeeFullName);
    await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
    await selectOption(page, "Select payroll financial year", financialYear);
    await selectOption(page, "Select payroll month", month);

    // Verify saved values and totals persist
    await expect(page.getByLabel("Basic Pay amount")).toHaveValue("45,000.00");
    await expect(page.getByLabel("Professional Tax amount")).toHaveValue("200.00");
    await expect(page.getByText("Total Earnings").locator("..")).toContainText("₹45,000.00");
    await expect(page.getByText("Total Deductions").locator("..")).toContainText("₹200.00");
    await expect(page.getByText("Net pay").locator("..")).toContainText("₹44,800.00");

    // 10. Record payroll details in the run manifest
    await updateRunManifest(runId, (prev) => ({
      ...prev,
      payrollRecord: {
        employeeName: employee.displayName,
        financialYear,
        month,
        basicPay: "45,000.00",
        deduction: "200.00",
        gross: "₹45,000.00",
        deductions: "₹200.00",
        net: "₹44,800.00",
      },
    }));

    // 11. Institution user signs out
    await signOut(page);
  });
});
