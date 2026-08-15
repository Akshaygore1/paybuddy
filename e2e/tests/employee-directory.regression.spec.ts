import { expect, test } from "../src/fixtures";
import {
  downloadEmployeeDirectoryCsv,
  employeeRow,
  enableCustomFieldColumn,
  expectAccessible,
  expectRowValues,
  goToEmployeeDirectory,
  searchEmployeeDirectory,
  setColumnVisibility,
  signIn,
  signOut,
} from "../src/helpers";

test.describe("employee-directory regression suite", () => {
  test.describe("1. Catalog Provisioning, Ordering & Pagination", () => {
    test("provisions 15-employee catalog across designations, verifies strict directory ordering and page boundary pagination controls", async ({
      page,
      provisionedEmployeeDirectory,
    }) => {
      const { institution, catalog } = provisionedEmployeeDirectory;

      // 1. Sign in as institution user and navigate to Employee Directory
      await signIn(page, institution.username, institution.password);
      await goToEmployeeDirectory(page);

      // Verify directory heading and total record count description
      await expect(page.getByRole("heading", { name: "Employee" })).toBeVisible();
      await expect(page.getByText("15 employee records")).toBeVisible();

      // Verify Page 1 pagination indicator text
      await expect(page.getByText("Showing 1-10 of 15")).toBeVisible();

      // Verify Page 1 boundary button states: Previous is disabled, Next is enabled
      const prevButton = page.getByRole("button", { name: "Go to previous page" });
      const nextButton = page.getByRole("button", { name: "Go to next page" });
      await expect(prevButton).toBeDisabled();
      await expect(nextButton).toBeEnabled();

      // Verify Page 1 table contains exactly the first 10 ordered employees
      const page1Employees = catalog.slice(0, 10);
      const page2Employees = catalog.slice(10, 15);

      for (const emp of page1Employees) {
        const row = employeeRow(page, emp.displayName);
        await expect(row).toBeVisible();
        await expectRowValues(row, [emp.seniorityRank, emp.contactNumber]);
      }

      // Ensure Page 2 employees are NOT visible on Page 1
      for (const emp of page2Employees) {
        await expect(employeeRow(page, emp.displayName)).toHaveCount(0);
      }

      // Verify exact row sequence on Page 1
      const page1TableRows = page.locator('table[aria-label="Employee directory"] tbody tr');
      await expect(page1TableRows).toHaveCount(10);
      for (let i = 0; i < 10; i++) {
        const expectedEmp = page1Employees[i]!;
        await expect(page1TableRows.nth(i)).toContainText(expectedEmp.displayName);
        await expect(page1TableRows.nth(i)).toContainText(String(expectedEmp.seniorityRank));
      }

      // 2. Navigate to Page 2 via Next Button
      await nextButton.click();

      // Verify Page 2 pagination indicator text
      await expect(page.getByText("Showing 11-15 of 15")).toBeVisible();

      // Verify Page 2 boundary button states: Previous is enabled, Next is disabled (last page)
      await expect(prevButton).toBeEnabled();
      await expect(nextButton).toBeDisabled();

      // Verify Page 2 table contains exactly the remaining 5 employees
      await expect(page.locator('table[aria-label="Employee directory"] tbody tr')).toHaveCount(5);
      for (const emp of page2Employees) {
        const row = employeeRow(page, emp.displayName);
        await expect(row).toBeVisible();
        await expectRowValues(row, [emp.seniorityRank, emp.contactNumber]);
      }

      // Ensure Page 1 employees are NOT visible on Page 2
      for (const emp of page1Employees) {
        await expect(employeeRow(page, emp.displayName)).toHaveCount(0);
      }

      // Verify exact row sequence on Page 2
      const page2TableRows = page.locator('table[aria-label="Employee directory"] tbody tr');
      for (let i = 0; i < 5; i++) {
        const expectedEmp = page2Employees[i]!;
        await expect(page2TableRows.nth(i)).toContainText(expectedEmp.displayName);
        await expect(page2TableRows.nth(i)).toContainText(String(expectedEmp.seniorityRank));
      }

      // 3. Navigate back to Page 1 via Previous Button
      await prevButton.click();
      await expect(page.getByText("Showing 1-10 of 15")).toBeVisible();
      await expect(prevButton).toBeDisabled();
      await expect(nextButton).toBeEnabled();
      await expect(employeeRow(page, page1Employees[0]!.displayName)).toBeVisible();

      await signOut(page);
    });
  });

  test.describe("2. Search & Filter Interactions", () => {
    test("filters visible standard and custom fields, enforces hidden-column search isolation, resets pagination on query, and handles empty results", async ({
      page,
      provisionedEmployeeDirectory,
    }) => {
      const { institution, catalog, customField } = provisionedEmployeeDirectory;
      const targetEmp = catalog[0]!;
      const secondPageEmp = catalog[12]!; // on page 2 (index 12)

      // 1. Sign in as institution user and open Employee Directory
      await signIn(page, institution.username, institution.password);
      await goToEmployeeDirectory(page);
      await expect(page.getByText("15 employee records")).toBeVisible();

      // --- A. Search by visible standard field (Surname / First Name) ---
      await searchEmployeeDirectory(page, targetEmp.surname);
      await expect(page.getByText("matching employee records of 15")).toBeVisible();
      const matchRow = employeeRow(page, targetEmp.displayName);
      await expect(matchRow).toBeVisible();
      await expect(matchRow).toContainText(targetEmp.surname);

      // --- B. Search isolation for hidden custom field ---
      // Custom field column is initially hidden; searching for custom field value should yield NO results
      await searchEmployeeDirectory(page, targetEmp.customFieldValue);
      await expect(page.getByText("No employees match your search.")).toBeVisible();
      await expect(page.locator('table[aria-label="Employee directory"] tbody tr')).toHaveCount(1);
      await expect(employeeRow(page, targetEmp.displayName)).toHaveCount(0);

      // Clear search to restore full directory
      await searchEmployeeDirectory(page, "");
      await expect(page.getByText("15 employee records")).toBeVisible();
      await expect(employeeRow(page, targetEmp.displayName)).toBeVisible();

      // --- C. Search by custom field once column is made visible ---
      await enableCustomFieldColumn(page, customField.label);
      await searchEmployeeDirectory(page, targetEmp.customFieldValue);
      await expect(employeeRow(page, targetEmp.displayName)).toBeVisible();
      await expect(page.getByText("1 matching employee records of 15")).toBeVisible();
      await expect(page.getByText("Showing 1-1 of 1 matches (15 total)")).toBeVisible();

      // Clear search
      await searchEmployeeDirectory(page, "");
      await expect(page.getByText("Showing 1-10 of 15")).toBeVisible();

      // --- D. Pagination Reset on Search ---
      // Navigate to Page 2
      const nextButton = page.getByRole("button", { name: "Go to next page" });
      await nextButton.click();
      await expect(page.getByText("Showing 11-15 of 15")).toBeVisible();
      await expect(employeeRow(page, secondPageEmp.displayName)).toBeVisible();

      // Search for an employee that was on Page 2
      await searchEmployeeDirectory(page, secondPageEmp.surname);

      // Search must reset pageIndex to 0 (Page 1) and show the matching employee
      await expect(page.getByText(/Showing 1-\d+ of \d+ matches/)).toBeVisible();
      await expect(employeeRow(page, secondPageEmp.displayName)).toBeVisible();

      // --- E. Non-matching query empty state ---
      await searchEmployeeDirectory(page, "NONEXISTENT_QUERY_XYZ_999");
      await expect(page.getByText("No employees match your search.")).toBeVisible();
      await expect(page.getByText("0 matching employee records of 15")).toBeVisible();
      // Pagination controls are not shown when 0 results match
      await expect(page.getByRole("button", { name: "Go to next page" })).toHaveCount(0);

      // Clearing search restores full 15 records on Page 1
      await searchEmployeeDirectory(page, "");
      await expect(page.getByText("15 employee records")).toBeVisible();
      await expect(page.getByText("Showing 1-10 of 15")).toBeVisible();
      await expect(page.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Go to next page" })).toBeEnabled();

      await signOut(page);
    });
  });

  test.describe("3. Column Visibility Toggle", () => {
    test("dynamically adds and removes optional standard columns and custom fields with instant cell rendering", async ({
      page,
      provisionedEmployeeDirectory,
    }) => {
      const { institution, catalog, customField } = provisionedEmployeeDirectory;
      const sampleEmp = catalog[0]!;

      // 1. Sign in as institution user and open Employee Directory
      await signIn(page, institution.username, institution.password);
      await goToEmployeeDirectory(page);

      // Default visible columns: Employee, Rank, Designation, Contact, Created
      await expect(page.getByRole("columnheader", { name: "Employee", exact: true })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Rank", exact: true })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Designation", exact: true })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Contact", exact: true })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Created", exact: true })).toBeVisible();

      // Default hidden columns
      await expect(page.getByRole("columnheader", { name: "PAN", exact: true })).toHaveCount(0);
      await expect(page.getByRole("columnheader", { name: "PF", exact: true })).toHaveCount(0);
      await expect(page.getByRole("columnheader", { name: "NPS", exact: true })).toHaveCount(0);
      await expect(page.getByRole("columnheader", { name: "WhatsApp", exact: true })).toHaveCount(0);
      await expect(page.getByRole("columnheader", { name: "Date of Birth", exact: true })).toHaveCount(0);
      await expect(page.getByRole("columnheader", { name: "Gender", exact: true })).toHaveCount(0);
      await expect(page.getByRole("columnheader", { name: customField.label, exact: true })).toHaveCount(0);

      const targetRow = employeeRow(page, sampleEmp.displayName);
      await expect(targetRow).toBeVisible();

      // --- A. Enable PAN Column ---
      await setColumnVisibility(page, "PAN", true);
      await expect(page.getByRole("columnheader", { name: "PAN", exact: true })).toBeVisible();
      await expect(targetRow).toContainText(sampleEmp.panNumber);

      // --- B. Enable PF Column ---
      await setColumnVisibility(page, "PF", true);
      await expect(page.getByRole("columnheader", { name: "PF", exact: true })).toBeVisible();
      await expect(targetRow).toContainText(sampleEmp.pfNumber);

      // --- C. Enable NPS Column ---
      await setColumnVisibility(page, "NPS", true);
      await expect(page.getByRole("columnheader", { name: "NPS", exact: true })).toBeVisible();
      await expect(targetRow).toContainText(sampleEmp.npsAccountNumber);

      // --- D. Enable WhatsApp Column ---
      await setColumnVisibility(page, "WhatsApp", true);
      await expect(page.getByRole("columnheader", { name: "WhatsApp", exact: true })).toBeVisible();
      await expect(targetRow).toContainText(sampleEmp.whatsAppNumber);

      // --- E. Enable Gender & Date of Birth Columns ---
      await setColumnVisibility(page, "Gender", true);
      await expect(page.getByRole("columnheader", { name: "Gender", exact: true })).toBeVisible();
      await expect(targetRow).toContainText(sampleEmp.gender);

      await setColumnVisibility(page, "Date of Birth", true);
      await expect(page.getByRole("columnheader", { name: "Date of Birth", exact: true })).toBeVisible();

      // --- F. Enable Custom Field Column ---
      await setColumnVisibility(page, customField.label, true);
      await expect(page.getByRole("columnheader", { name: customField.label, exact: true })).toBeVisible();
      await expect(targetRow).toContainText(sampleEmp.customFieldValue);

      // --- G. Disable Columns and verify removal from DOM ---
      await setColumnVisibility(page, "PAN", false);
      await expect(page.getByRole("columnheader", { name: "PAN", exact: true })).toHaveCount(0);
      await expect(targetRow).not.toContainText(sampleEmp.panNumber);

      await setColumnVisibility(page, "PF", false);
      await expect(page.getByRole("columnheader", { name: "PF", exact: true })).toHaveCount(0);

      await setColumnVisibility(page, customField.label, false);
      await expect(page.getByRole("columnheader", { name: customField.label, exact: true })).toHaveCount(0);
      await expect(targetRow).not.toContainText(sampleEmp.customFieldValue);

      await signOut(page);
    });
  });

  test.describe("4. CSV Export Content & Verification", () => {
    test("exports ordered CSV with accurate visible headers, full institution rows, proper escaping, and hidden column exclusion", async ({
      page,
      provisionedEmployeeDirectory,
    }) => {
      const { institution, catalog, customField } = provisionedEmployeeDirectory;

      // 1. Sign in as institution user and open Employee Directory
      await signIn(page, institution.username, institution.password);
      await goToEmployeeDirectory(page);

      // --- A. Default Columns Export ---
      const defaultExport = await downloadEmployeeDirectoryCsv(page);
      expect(defaultExport.download.suggestedFilename()).toBe("employee-directory.csv");

      const defaultRows = defaultExport.rows;
      // Header row + 15 employee records = 16 rows
      expect(defaultRows.length).toBe(16);

      const defaultHeader = defaultRows[0]!;
      expect(defaultHeader).toEqual(["Employee", "Rank", "Designation", "Contact", "Created"]);

      // Verify all 15 employees are present in default export and preserve directory ordering
      for (let i = 0; i < 15; i++) {
        const expectedEmp = catalog[i]!;
        const csvRow = defaultRows[i + 1]!;
        expect(csvRow[0]).toBe(expectedEmp.displayName);
        expect(csvRow[1]).toBe(String(expectedEmp.seniorityRank));
        expect(csvRow[3]).toBe(expectedEmp.contactNumber);
      }

      // --- B. Configured Columns Export with Custom Field, PAN, and Hidden Columns ---
      // Enable PAN, NPS, and Custom Field
      await setColumnVisibility(page, "PAN", true);
      await setColumnVisibility(page, "NPS", true);
      await setColumnVisibility(page, customField.label, true);

      // Disable Created and Rank
      await setColumnVisibility(page, "Created", false);
      await setColumnVisibility(page, "Rank", false);

      const customExport = await downloadEmployeeDirectoryCsv(page);
      const customRows = customExport.rows;
      expect(customRows.length).toBe(16);

      const customHeader = customRows[0]!;
      expect(customHeader).toContain("Employee");
      expect(customHeader).toContain("Designation");
      expect(customHeader).toContain("Contact");
      expect(customHeader).toContain("PAN");
      expect(customHeader).toContain("NPS");
      expect(customHeader).toContain(customField.label);

      // Ensure disabled columns are NOT in exported CSV header
      expect(customHeader).not.toContain("Rank");
      expect(customHeader).not.toContain("Created");
      expect(customHeader).not.toContain("PF");
      expect(customHeader).not.toContain("WhatsApp");

      // Verify row values match the configured visible columns
      for (let i = 0; i < 15; i++) {
        const expectedEmp = catalog[i]!;
        const csvRow = customRows[i + 1]!;

        const panIdx = customHeader.indexOf("PAN");
        const npsIdx = customHeader.indexOf("NPS");
        const customIdx = customHeader.indexOf(customField.label);

        expect(csvRow[0]).toBe(expectedEmp.displayName);
        expect(csvRow[panIdx]).toBe(expectedEmp.panNumber);
        expect(csvRow[npsIdx]).toBe(expectedEmp.npsAccountNumber);
        expect(csvRow[customIdx]).toBe(expectedEmp.customFieldValue);
      }

      await signOut(page);
    });
  });

  test.describe("5. Accessibility & Responsive Viewport", () => {
    test("passes axe accessibility audits across directory states and remains fully usable on mobile viewport", async ({
      page,
      provisionedEmployeeDirectory,
    }) => {
      const { institution, customField } = provisionedEmployeeDirectory;

      // 1. Sign in as institution user and open Employee Directory
      await signIn(page, institution.username, institution.password);
      await goToEmployeeDirectory(page);

      // --- A. Accessibility Audit: Default Directory View ---
      await expectAccessible(page);

      // --- B. Accessibility Audit: With Configured Columns ---
      await setColumnVisibility(page, "PAN", true);
      await setColumnVisibility(page, customField.label, true);
      await expectAccessible(page);

      // --- C. Accessibility Audit: Active Search & Filter State ---
      await searchEmployeeDirectory(page, "Sharma");
      await expectAccessible(page);

      // Clear search
      await searchEmployeeDirectory(page, "");

      // --- D. Accessibility Audit: Page 2 Pagination State ---
      const nextButton = page.getByRole("button", { name: "Go to next page" });
      await nextButton.click();
      await expect(page.getByText("Showing 11-15 of 15")).toBeVisible();
      await expectAccessible(page);

      // --- E. Responsive Viewport Check (Mobile Smoke Viewport: 393 x 851) ---
      await page.setViewportSize({ width: 393, height: 851 });

      // Verify header, search input, and action buttons are responsive and visible
      await expect(page.getByRole("heading", { name: "Employee" })).toBeVisible();
      await expect(page.getByLabel("Search employees")).toBeVisible();
      await expect(page.getByRole("button", { name: "Choose Columns" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Download CSV" })).toBeVisible();

      // Verify table scroll container and pagination controls on mobile
      const prevMobileButton = page.getByRole("button", { name: "Go to previous page" });
      const nextMobileButton = page.getByRole("button", { name: "Go to next page" });

      await expect(prevMobileButton).toBeVisible();
      await expect(prevMobileButton).toBeEnabled();
      await expect(nextMobileButton).toBeDisabled();

      // Navigate back to Page 1 on mobile
      await prevMobileButton.click({ force: true });
      await expect(page.getByText("Showing 1-10 of 15")).toBeVisible();
      await expect(prevMobileButton).toBeDisabled();
      await expect(nextMobileButton).toBeEnabled();

      // Search on mobile viewport
      await page.getByLabel("Search employees").fill("Kulkarni");
      await expect(page.getByText(/matching employee records of/)).toBeVisible();

      await signOut(page);
    });
  });
});
