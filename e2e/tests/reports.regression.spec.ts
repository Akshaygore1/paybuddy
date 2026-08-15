import { readFile } from "node:fs/promises";

import { expect, test } from "../src/fixtures";
import {
  expectAccessible,
  expectAdminNavigation,
  expectInstitutionNavigation,
  employeeFullName,
  generateIndianInstitution,
  goToReports,
  provisionReportsPrerequisitesViaApi,
  provisionPayrollPrerequisitesViaApi,
  savePayrollViaApi,
  selectGlobalFinancialYear,
  selectOption,
  signIn,
  signOut,
  simulateNetworkFailure,
  simulateServerError,
  simulateSlowResponse,
} from "../src/helpers";
import { updateRunManifest } from "../src/manifest";

const REPORT_URL = "**/trpc/reports.getReport*";

async function saveReportPayroll(
  env: Parameters<typeof savePayrollViaApi>[0],
  cookieHeader: string,
  employeeId: string,
  financialYearStart: number,
  basicPay: string,
  deduction = "500",
) {
  await savePayrollViaApi(env, cookieHeader, {
    employeeId,
    financialYearStart,
    month: `${financialYearStart}-04`,
    lineItems: [
      { section: "earnings", fixedFieldKey: "basicPay", amount: basicPay },
      { section: "deductions", fixedFieldKey: "professionalTax", amount: deduction },
    ],
  });
}

test.describe("reports regression suite", () => {
  test.describe.configure({ timeout: 120_000 });

  test.describe("1. Institution-user report selection, rows, search & pagination", () => {
    test("shows only saved payroll for the signed-in institution across financial years and pages", async ({
      page,
      env,
      provisionedEmployeeDirectory,
      runId,
    }) => {
      const { institution, cookieHeader, employees } = provisionedEmployeeDirectory;

      for (const employee of employees) {
        await saveReportPayroll(env, cookieHeader, employee.id, 2026, "45000");
      }
      await updateRunManifest(runId, (previous) => ({
        ...previous,
        reportFixture: {
          employeeName: employeeFullName(employees[0]!),
          financialYear: 2026,
          grossSalary: "₹5,40,000.00",
          deduction: "₹6,000.00",
          netSalary: "₹5,34,000.00",
        },
      }));

      await signIn(page, institution.username, institution.password);
      await expectInstitutionNavigation(page);
      await goToReports(page);
      await expectAccessible(page);

      // Institution users see their report but never the administrator's institution selector.
      await expect(page.getByRole("combobox", { name: "Select institute" })).toHaveCount(0);
      const financialYearSelect = page.getByRole("combobox", {
        name: "Select financial year",
        exact: true,
      });
      await financialYearSelect.focus();
      await expect(financialYearSelect).toBeFocused();
      await financialYearSelect.press("Enter");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("Escape");
      await selectGlobalFinancialYear(page, "2026-2027");
      await expect(page.getByRole("table", { name: "Reports table" })).toBeVisible();
      await expectAccessible(page);

      const firstEmployee = employees[0]!;
      const firstEmployeeReportName = employeeFullName(firstEmployee);
      const firstEmployeeRow = page
        .locator('table[aria-label="Reports table"] tbody tr')
        .filter({ hasText: firstEmployeeReportName });
      await expect(firstEmployeeRow).toBeVisible();
      await expect(firstEmployeeRow).toContainText("₹5,40,000.00");
      await expect(firstEmployeeRow).toContainText("₹6,000.00");
      await expect(firstEmployeeRow).toContainText("₹5,34,000.00");
      await expect(page.getByText("Showing 1-10 of 15", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Go to next page" })).toBeEnabled();

      await page.getByRole("button", { name: "Go to next page" }).click();
      await expect(page.getByText("Showing 11-15 of 15", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Go to next page" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Go to previous page" })).toBeEnabled();

      const reportsSearch = page.getByLabel("Search reports");
      await reportsSearch.fill(firstEmployee.surname);
      await expect(
        page.getByText("Showing 1-1 of 1 matches (15 total)", { exact: true }),
      ).toBeVisible();
      await expect(firstEmployeeRow).toBeVisible();
      await expect(page.getByRole("button", { name: "Go to previous page" })).toBeDisabled();

      await reportsSearch.fill("5,40,000");
      await expect(
        page.getByText("Showing 1-10 of 15 matches (15 total)", { exact: true }),
      ).toBeVisible();
      await reportsSearch.fill(`no-report-${firstEmployee.id}`);
      await expect(
        page.getByText("No report rows match your search.", { exact: true }),
      ).toBeVisible();

      await reportsSearch.fill("");
      await expect(page.getByText("Showing 1-10 of 15", { exact: true })).toBeVisible();

      const csvDownloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download CSV", exact: true }).click();
      const csvDownload = await csvDownloadPromise;
      expect(csvDownload.suggestedFilename()).toBe("fy-payroll-report.csv");
      const csvPath = await csvDownload.path();
      expect(csvPath).toBeTruthy();
      const csv = await readFile(csvPath!, "utf8");
      expect(csv.split("\r\n")[0]).toBe(
        "Name,Gross Salary,Deduction,Net Salary,TDS Deducted Till Now,Total Tax,Pending TDS",
      );
      expect(csv).toContain(firstEmployeeReportName);

      await signOut(page);
      await page.goto("/reports");
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  });

  test.describe("2. Administrator institution selection & empty states", () => {
    test("selects between isolated institution reports and protects cross-role routes", async ({
      page,
      env,
      provisionedReportsPrerequisites,
      runId,
    }) => {
      const firstInstitutionReport = provisionedReportsPrerequisites;
      const secondInstitutionReport = await provisionReportsPrerequisitesViaApi(
        env,
        generateIndianInstitution(`${runId}-second-report-institution`),
        { basicPay: "65000", deduction: "700" },
      );
      await updateRunManifest(runId, (previous) => ({
        ...previous,
        createdInstitutions: [
          ...(previous.createdInstitutions ?? []),
          {
            id: secondInstitutionReport.institution.id,
            name: secondInstitutionReport.institution.name,
            username: secondInstitutionReport.institution.username,
          },
        ],
        createdEmployees: [
          ...(previous.createdEmployees ?? []),
          {
            id: secondInstitutionReport.employee.id,
            displayName: employeeFullName(secondInstitutionReport.employee),
            institutionName: secondInstitutionReport.institution.name,
          },
        ],
      }));

      await signIn(page, env.adminIdentifier, env.adminPassword);
      await expectAdminNavigation(page);
      await goToReports(page);
      await expectAccessible(page);
      await expect(page.getByRole("combobox", { name: "Select institute" })).toBeVisible();

      await selectOption(page, "Select institute", firstInstitutionReport.institution.name);
      await expect(
        page.getByRole("heading", {
          name: `Reports - ${firstInstitutionReport.institution.name}`,
        }),
      ).toBeVisible();
      await expect(
        page
          .locator('table[aria-label="Reports table"] tbody tr')
          .filter({ hasText: employeeFullName(firstInstitutionReport.employee) }),
      ).toBeVisible();
      await expect(
        page
          .locator('table[aria-label="Reports table"] tbody tr')
          .filter({ hasText: employeeFullName(secondInstitutionReport.employee) }),
      ).toHaveCount(0);

      await selectOption(page, "Select institute", secondInstitutionReport.institution.name);
      await expect(
        page.getByRole("heading", {
          name: `Reports - ${secondInstitutionReport.institution.name}`,
        }),
      ).toBeVisible();
      await expect(
        page
          .locator('table[aria-label="Reports table"] tbody tr')
          .filter({ hasText: employeeFullName(secondInstitutionReport.employee) }),
      ).toBeVisible();
      await expect(
        page
          .locator('table[aria-label="Reports table"] tbody tr')
          .filter({ hasText: employeeFullName(firstInstitutionReport.employee) }),
      ).toHaveCount(0);

      await page.goto("/employee");
      await expect(page).toHaveURL(/\/dashboard$/);
      await signOut(page);
      await page.goto("/reports");
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    test("gives accurate guidance for an institution with no payroll in the selected year", async ({
      page,
      env,
      provisionedInstitution,
      runId,
    }) => {
      const noPayrollInstitution = await provisionPayrollPrerequisitesViaApi(
        env,
        generateIndianInstitution(`${runId}-no-payroll-report-institution`),
      );
      await updateRunManifest(runId, (previous) => ({
        ...previous,
        createdInstitutions: [
          ...(previous.createdInstitutions ?? []),
          {
            id: noPayrollInstitution.institution.id,
            name: noPayrollInstitution.institution.name,
            username: noPayrollInstitution.institution.username,
          },
        ],
        createdEmployees: [
          ...(previous.createdEmployees ?? []),
          {
            id: noPayrollInstitution.employee.id,
            displayName: employeeFullName(noPayrollInstitution.employee),
            institutionName: noPayrollInstitution.institution.name,
          },
        ],
      }));
      await signIn(page, env.adminIdentifier, env.adminPassword);
      await goToReports(page);
      await selectGlobalFinancialYear(page, "2026-2027");
      await selectOption(page, "Select institute", provisionedInstitution.name);
      await expect(
        page.getByText(
          "No employees or saved payroll data are available for this institute and financial year.",
          { exact: true },
        ),
      ).toBeVisible();

      await selectOption(page, "Select institute", noPayrollInstitution.institution.name);
      await expect(
        page.getByText(
          "No employees or saved payroll data are available for this institute and financial year.",
          { exact: true },
        ),
      ).toBeVisible();

      await signOut(page);
    });
  });

  test.describe("3. Loading, failure & accessibility behavior", () => {
    test("shows deterministic feedback for server, unauthorized, slow, and failed report requests", async ({
      page,
      provisionedReportsPrerequisites,
    }) => {
      const { institution, employee } = provisionedReportsPrerequisites;
      await signIn(page, institution.username, institution.password);

      await goToReports(page);
      await expect(
        page
          .locator('table[aria-label="Reports table"] tbody tr')
          .filter({ hasText: employeeFullName(employee) }),
      ).toBeVisible();

      const serverFailure = await simulateServerError(
        page,
        REPORT_URL,
        500,
        "Report service temporarily unavailable",
      );
      await page.reload();
      await expect(page.getByTestId("report-error")).toContainText(
        "Report service temporarily unavailable",
      );
      await serverFailure();

      await page.reload();
      await expect(
        page
          .locator('table[aria-label="Reports table"] tbody tr')
          .filter({ hasText: employeeFullName(employee) }),
      ).toBeVisible();

      const slowResponse = await simulateSlowResponse(page, REPORT_URL, 900);
      const reloadPromise = page.reload();
      await expect(page.getByRole("table", { name: "Reports table" })).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await reloadPromise;
      await expect(page.getByRole("table", { name: "Reports table" })).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await slowResponse();

      const unauthorized = await simulateServerError(
        page,
        REPORT_URL,
        401,
        "Report session expired; sign in again",
      );
      await page.reload();
      await expect(page.getByTestId("report-error")).toContainText(
        "Report session expired; sign in again",
      );
      await unauthorized();

      const failedRequest = await simulateNetworkFailure(page, REPORT_URL);
      await page.reload();
      await expect(page.getByTestId("report-error")).toBeVisible();
      await failedRequest();

      await page.reload();
      await expect(
        page
          .locator('table[aria-label="Reports table"] tbody tr')
          .filter({ hasText: employeeFullName(employee) }),
      ).toBeVisible();
      await expectAccessible(page);
      await signOut(page);
    });
  });
});
