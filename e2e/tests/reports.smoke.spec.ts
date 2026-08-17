import { expect, test } from "../src/fixtures";
import { expectInstitutionNavigation, goToReports, signIn, signOut } from "../src/helpers";
import { updateRunManifest } from "../src/manifest";

test.describe("reports smoke", () => {
  test("provisions institution, designation, employee, and payroll via API, signs in as institution user, and verifies FY report", async ({
    page,
    env,
    runId,
    provisionedReportsPrerequisites,
  }) => {
    const { institution, designation, employee, payroll } = provisionedReportsPrerequisites;
    const employeeFullName = [employee.firstName, employee.middleName, employee.surname]
      .filter(Boolean)
      .join(" ");

    // 1. Log run context for inspection (never log passwords)
    console.log(
      `[E2E Smoke: Reports] Run ID: ${runId} | Institution: "${institution.name}" | Username: "${institution.username}" | Employee: "${employeeFullName}" | Target: ${env.baseURL}`,
    );
    test
      .info()
      .annotations.push(
        { type: "run-id", description: runId },
        { type: "institution-name", description: institution.name },
        { type: "institution-username", description: institution.username },
        { type: "designation-name", description: designation.name },
        { type: "employee-name", description: employeeFullName },
        { type: "financial-year", description: String(payroll.financialYearStart) },
      );

    // 2. Sign in as the generated institution user
    await signIn(page, institution.username, institution.password);

    // 3. Verify role-appropriate navigation for institution user
    await expectInstitutionNavigation(page);

    // 4. Navigate to Reports page
    await goToReports(page);

    // 5. Assert administrator-only institution selector is not present
    await expect(page.getByRole("combobox", { name: "Select institute" })).toHaveCount(0);
    await expect(page.getByLabel("Select institute")).toHaveCount(0);
    await expect(page.locator("#reports-institute")).toHaveCount(0);

    // 6. Assert report header displays institute and financial year
    await expect(
      page.getByText(
        `${institution.name} · FY ${payroll.financialYearStart}-${payroll.financialYearStart + 1}`,
      ),
    ).toBeVisible();

    // 7. Assert table displays the provisioned employee row with calculated totals
    const employeeRow = page.locator('table[aria-label="Reports table"] tbody tr').filter({
      hasText: employeeFullName,
    });
    await expect(employeeRow).toBeVisible();
    await expect(employeeRow).toContainText(payroll.gross);
    await expect(employeeRow).toContainText(payroll.deductions);
    await expect(employeeRow).toContainText(payroll.net);

    // 8. Update run manifest with report fixture details
    await updateRunManifest(runId, (prev) => ({
      ...prev,
      reportFixture: {
        employeeName: employeeFullName,
        financialYear: payroll.financialYearStart,
        grossSalary: payroll.gross,
        deduction: payroll.deductions,
        netSalary: payroll.net,
      },
    }));

    // 9. Institution user signs out
    await signOut(page);
  });
});
