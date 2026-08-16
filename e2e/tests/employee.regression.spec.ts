import { expect, test } from "../src/fixtures";
import {
  addOptionalCustomField,
  createDesignation,
  deleteEmployee,
  downloadEmployeeDirectoryCsv,
  editEmployee,
  employeeRow,
  enableCustomFieldColumn,
  expectAccessible,
  expectEmployeeRow,
  expectRowValues,
  fillEmployeeForm,
  generateIndianEmployee,
  goToEmployeeCreate,
  goToEmployeeDirectory,
  pressEnter,
  pressEscape,
  pressSpace,
  pressTab,
  searchEmployeeDirectory,
  setColumnVisibility,
  signIn,
  signOut,
  simulateNetworkFailure,
  simulateServerError,
  simulateSlowResponse,
  simulateUnauthorized,
  simulateValidationFailure,
  submitEmployeeCreate,
  submitEmployeeEdit,
  tabUntilFocused,
} from "../src/helpers";

test.describe("employee regression suite", () => {
  test.describe("1. Form Validation & Boundaries", () => {
    test("validates required fields on empty submission with error messages and aria-invalid attributes", async ({
      page,
      provisionedEmployeePrerequisites,
      runId,
    }) => {
      const { institution, customField } = provisionedEmployeePrerequisites;

      // 1. Sign in as institution user and navigate to Create Employee page
      await signIn(page, institution.username, institution.password);
      await goToEmployeeCreate(page);
      await expect(page.getByRole("combobox", { name: "Designation" })).toBeVisible();

      // Add an optional custom field so both required and optional are present on form
      const optFieldLabel = `Bus Route_${runId}`;
      await addOptionalCustomField(page, optFieldLabel);

      // --- A. Multi-error Empty Submission ---
      await submitEmployeeCreate(page);

      // Verify standard required field validation errors
      await expect(page.getByText("Surname is too long")).toHaveCount(0);
      await expect(page.getByText("This field is required").first()).toBeVisible();
      await expect(page.getByText("Please select a valid gender")).toBeVisible();
      await expect(page.getByText("Seniority rank must be greater than zero")).toBeVisible();
      await expect(page.getByText(`${customField.label} is required`)).toBeVisible();

      // Verify aria-invalid="true" attributes across all required controls
      await expect(page.getByLabel("Surname")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("First name")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("Middle name")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("Date of Birth")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("combobox", { name: "Gender" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page.getByRole("combobox", { name: "Designation" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page.getByLabel("Seniority Rank")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel(`${customField.label} *`)).toHaveAttribute(
        "aria-invalid",
        "true",
      );

      // Optional custom field should NOT be marked invalid
      await expect(page.getByLabel(optFieldLabel, { exact: true })).not.toHaveAttribute(
        "aria-invalid",
        "true",
      );

      // --- B. Boundary Validations ---
      // 1. Seniority Rank Boundaries
      // Seniority rank: 0 (must be > 0)
      await page.getByLabel("Seniority Rank").fill("0");
      await submitEmployeeCreate(page);
      await expect(page.getByText("Seniority rank must be greater than zero")).toBeVisible();
      await expect(page.getByLabel("Seniority Rank")).toHaveValue("0");

      // Seniority rank: -5
      await page.getByLabel("Seniority Rank").fill("-5");
      await submitEmployeeCreate(page);
      await expect(page.getByText("Seniority rank must be greater than zero")).toBeVisible();
      await expect(page.getByLabel("Seniority Rank")).toHaveValue("-5");

      // Seniority rank: 1.5 (decimal)
      await page.getByLabel("Seniority Rank").fill("1.5");
      await submitEmployeeCreate(page);
      await expect(page.getByText("Seniority rank must be a whole number")).toBeVisible();
      await expect(page.getByLabel("Seniority Rank")).toHaveValue("1.5");

      // 2. Date of Birth Boundary
      await page.getByLabel("Date of Birth").fill("1990-01-01");
      await page.getByLabel("Date of Birth").fill("");
      await submitEmployeeCreate(page);
      await expect(page.getByLabel("Date of Birth")).toHaveAttribute("aria-invalid", "true");

      // 3. Text Fields Max Length Boundary (> 160 chars)
      const overLongName = "A".repeat(165);

      await page.getByLabel("First name").fill(overLongName);
      await submitEmployeeCreate(page);
      await expect(page.getByText("First name is too long")).toBeVisible();
      await expect(page.getByLabel("First name")).toHaveValue(overLongName);

      await page.getByLabel("Middle name").fill(overLongName);
      await submitEmployeeCreate(page);
      await expect(page.getByText("Middle name is too long")).toBeVisible();
      await expect(page.getByLabel("Middle name")).toHaveValue(overLongName);

      await page.getByLabel("Surname").fill(overLongName);
      await submitEmployeeCreate(page);
      await expect(page.getByText("Surname is too long")).toBeVisible();
      await expect(page.getByLabel("Surname")).toHaveValue(overLongName);

      await signOut(page);
    });
  });

  test.describe("2. Employee Creation, Edit & Persistence", () => {
    test("creates employee with all standard & custom fields, verifies directory projection & CSV export, and persists full edits across reload", async ({
      page,
      provisionedEmployeePrerequisites,
      runId,
    }) => {
      const { institution, designation, customField } = provisionedEmployeePrerequisites;
      const employeeData = generateIndianEmployee(runId);

      // 1. Sign in as institution user
      await signIn(page, institution.username, institution.password);
      await goToEmployeeCreate(page);
      await expect(page.getByRole("combobox", { name: "Designation" })).toBeVisible();

      // Add an optional custom field to cover all field combinations
      const optFieldLabel = `Shift Group_${runId}`;
      const optFieldValue = `Morning-A_${runId}`;
      await addOptionalCustomField(page, optFieldLabel);

      // Also create a second designation so we can test changing designation during edit
      const desig2Name = `Assistant Professor_${runId}`;
      await createDesignation(page, desig2Name);

      await expect(page.getByRole("combobox", { name: "Designation" })).toBeVisible();

      const pfNumber = `MH/BAN/${runId.slice(-5)}/001`;
      const npsNumber = `PRAN-1100${runId.slice(-4)}`;
      const whatsAppNumber = `91${employeeData.contactNumber.slice(2)}`;

      // 2. Fill all standard fields + required custom field + optional custom field
      await fillEmployeeForm(page, {
        surname: employeeData.surname,
        firstName: employeeData.firstName,
        middleName: employeeData.middleName,
        dateOfBirth: employeeData.dateOfBirth,
        gender: employeeData.gender,
        designationName: designation.name,
        seniorityRank: employeeData.seniorityRank,
        panNumber: employeeData.panNumber,
        pfNumber,
        npsAccountNumber: npsNumber,
        whatsAppNumber,
        contactNumber: employeeData.contactNumber,
        customFieldLabel: customField.label,
        customFieldValue: employeeData.customFieldValue,
      });
      await page.getByLabel(optFieldLabel, { exact: true }).fill(optFieldValue);

      // 3. Submit creation form
      await submitEmployeeCreate(page);

      // 4. Verify directory page and row persistence
      await expect(page).toHaveURL(/\/employee$/);
      await expectEmployeeRow(page, employeeData.displayName);

      const row = employeeRow(page, employeeData.displayName);
      await expectRowValues(row, [
        employeeData.seniorityRank,
        designation.name,
        employeeData.contactNumber,
      ]);

      // Enable custom field column and optional custom field column
      await enableCustomFieldColumn(page, customField.label);
      await expectRowValues(row, [employeeData.customFieldValue]);

      await enableCustomFieldColumn(page, optFieldLabel);
      await expectRowValues(row, [optFieldValue]);

      // Enable PAN, PF, NPS, WhatsApp, Date of Birth columns
      await setColumnVisibility(page, "PAN", true);
      await expectRowValues(row, [employeeData.panNumber]);

      await setColumnVisibility(page, "PF", true);
      await expectRowValues(row, [pfNumber]);

      await setColumnVisibility(page, "NPS", true);
      await expectRowValues(row, [npsNumber]);

      await setColumnVisibility(page, "WhatsApp", true);
      await expectRowValues(row, [whatsAppNumber]);

      // Verify search filtering
      await searchEmployeeDirectory(page, employeeData.surname);
      await expect(row).toBeVisible();
      await searchEmployeeDirectory(page, "NonExistentName9999");
      await expect(page.getByText("No employees match your search.")).toBeVisible();
      await searchEmployeeDirectory(page, "");
      await expect(row).toBeVisible();

      // 5. Verify CSV Download contains newly created employee
      const { rows: csvRows } = await downloadEmployeeDirectoryCsv(page);
      expect(csvRows.length).toBeGreaterThan(1);
      const csvHeader = csvRows[0] || [];
      expect(csvHeader).toContain("Employee");
      expect(csvHeader).toContain("Rank");
      expect(csvHeader).toContain("Designation");
      const employeeCsvRow = csvRows.find((r) => r.some((c) => c.includes(employeeData.surname)));
      expect(employeeCsvRow).toBeDefined();

      // 6. Open Edit Form
      await editEmployee(page, employeeData.displayName);
      await expect(page).toHaveURL(/\/employee\/.*\/edit$/);
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);

      // Verify all populated values in edit form
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);
      await expect(page.getByLabel("First name")).toHaveValue(employeeData.firstName);
      await expect(page.getByLabel("Middle name")).toHaveValue(employeeData.middleName);
      await expect(page.getByLabel("Date of Birth")).toHaveValue(employeeData.dateOfBirth);
      await expect(page.getByRole("combobox", { name: "Gender" })).toContainText(
        employeeData.gender,
      );
      await expect(page.getByRole("combobox", { name: "Designation" })).toContainText(
        designation.name,
      );
      await expect(page.getByLabel("Seniority Rank")).toHaveValue(
        String(employeeData.seniorityRank),
      );
      await expect(page.getByLabel("PAN number")).toHaveValue(employeeData.panNumber);
      await expect(page.getByLabel("PF number")).toHaveValue(pfNumber);
      await expect(page.getByLabel("NPS account number")).toHaveValue(npsNumber);
      await expect(page.getByLabel("WhatsApp number")).toHaveValue(whatsAppNumber);
      await expect(page.getByLabel("Contact number")).toHaveValue(employeeData.contactNumber);
      await expect(page.getByLabel(`${customField.label} *`)).toHaveValue(
        employeeData.customFieldValue,
      );
      await expect(page.getByLabel(optFieldLabel, { exact: true })).toHaveValue(optFieldValue);

      // 7. Perform Full Edit: Update Designation, Seniority, Contact, PF, PAN, and Custom values
      const updatedSeniority = 7;
      const updatedContact = `99${employeeData.contactNumber.slice(2)}`;
      const updatedPf = `MH/PUN/${runId.slice(-5)}/099`;
      const updatedPan = `FGHIJ${employeeData.panNumber.slice(5)}`;
      const updatedCustomReq = `TCH-EDITED-${runId.slice(-4)}`;
      const updatedCustomOpt = `Evening-B_${runId}`;

      await fillEmployeeForm(page, {
        designationName: desig2Name,
        seniorityRank: updatedSeniority,
        contactNumber: updatedContact,
        pfNumber: updatedPf,
        panNumber: updatedPan,
        customFieldLabel: customField.label,
        customFieldValue: updatedCustomReq,
      });
      await page.getByLabel(optFieldLabel, { exact: true }).fill(updatedCustomOpt);

      // 8. Submit Edit Form
      await submitEmployeeEdit(page);
      await expect(page).toHaveURL(/\/employee$/);

      // Verify default visible columns in Directory
      const updatedRow = employeeRow(page, employeeData.displayName);
      await expect(updatedRow).toBeVisible();
      await expectRowValues(updatedRow, [updatedSeniority, desig2Name, updatedContact]);

      // Enable custom field columns and verify updated custom values
      await enableCustomFieldColumn(page, customField.label);
      await expectRowValues(updatedRow, [updatedCustomReq]);

      await enableCustomFieldColumn(page, optFieldLabel);
      await expectRowValues(updatedRow, [updatedCustomOpt]);

      // 9. Reopen Edit Form and verify all updated values persist across reload
      await editEmployee(page, employeeData.displayName);
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);
      await expect(page.getByRole("combobox", { name: "Designation" })).toContainText(desig2Name);
      await expect(page.getByLabel("Seniority Rank")).toHaveValue(String(updatedSeniority));
      await expect(page.getByLabel("Contact number")).toHaveValue(updatedContact);
      await expect(page.getByLabel("PF number")).toHaveValue(updatedPf);
      await expect(page.getByLabel("PAN number")).toHaveValue(updatedPan);
      await expect(page.getByLabel(`${customField.label} *`)).toHaveValue(updatedCustomReq);
      await expect(page.getByLabel(optFieldLabel, { exact: true })).toHaveValue(updatedCustomOpt);

      // Page reload verification
      await page.reload();
      await expect(page.getByRole("heading", { name: "Edit Employee" })).toBeVisible();
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);
      await expect(page.getByRole("combobox", { name: "Designation" })).toContainText(desig2Name);
      await expect(page.getByLabel("Seniority Rank")).toHaveValue(String(updatedSeniority));
      await expect(page.getByLabel("Contact number")).toHaveValue(updatedContact);
      await expect(page.getByLabel("PF number")).toHaveValue(updatedPf);
      await expect(page.getByLabel("PAN number")).toHaveValue(updatedPan);
      await expect(page.getByLabel(`${customField.label} *`)).toHaveValue(updatedCustomReq);
      await expect(page.getByLabel(optFieldLabel, { exact: true })).toHaveValue(updatedCustomOpt);

      await signOut(page);
    });
  });

  test.describe("3. Scoped Deletion", () => {
    test("deletes target employee with confirmation modal while preserving unrelated employee records", async ({
      page,
      provisionedEmployeePrerequisites,
      runId,
    }) => {
      const { institution, designation, customField } = provisionedEmployeePrerequisites;

      // 1. Sign in as institution user
      await signIn(page, institution.username, institution.password);

      // 2. Create Employee A
      const empA = generateIndianEmployee(`A_${runId}`);
      await goToEmployeeCreate(page);
      await expect(page.getByRole("combobox", { name: "Designation" })).toBeVisible();
      await fillEmployeeForm(page, {
        surname: empA.surname,
        firstName: empA.firstName,
        middleName: empA.middleName,
        dateOfBirth: empA.dateOfBirth,
        gender: empA.gender,
        designationName: designation.name,
        seniorityRank: 1,
        contactNumber: empA.contactNumber,
        panNumber: empA.panNumber,
        customFieldLabel: customField.label,
        customFieldValue: `A-${empA.customFieldValue}`,
      });
      await submitEmployeeCreate(page);
      await expectEmployeeRow(page, empA.displayName);

      // 3. Create Employee B
      const empB = generateIndianEmployee(`B_${runId}`);
      // Ensure different surname to distinguish
      empB.surname = empB.surname === empA.surname ? "Chatterjee" : empB.surname;
      empB.displayName = `${empB.surname}, ${empB.firstName} ${empB.middleName}`.trim();

      await goToEmployeeCreate(page);
      await expect(page.getByRole("combobox", { name: "Designation" })).toBeVisible();
      await fillEmployeeForm(page, {
        surname: empB.surname,
        firstName: empB.firstName,
        middleName: empB.middleName,
        dateOfBirth: empB.dateOfBirth,
        gender: empB.gender,
        designationName: designation.name,
        seniorityRank: 2,
        contactNumber: empB.contactNumber,
        panNumber: empB.panNumber,
        customFieldLabel: customField.label,
        customFieldValue: `B-${empB.customFieldValue}`,
      });
      await submitEmployeeCreate(page);

      // Both employees exist in directory
      await expectEmployeeRow(page, empA.displayName);
      await expectEmployeeRow(page, empB.displayName);

      // 4. Cancel deletion on Employee A via modal
      const rowA = employeeRow(page, empA.displayName);
      await rowA.getByRole("button", { name: "Employee actions" }).click();
      await page
        .locator('[data-slot="dropdown-menu-content"]')
        .getByText("Delete", { exact: true })
        .click();
      await expect(page.getByRole("heading", { name: "Delete Employee" })).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("heading", { name: "Delete Employee" })).toHaveCount(0);

      // Employee A is still present
      await expectEmployeeRow(page, empA.displayName);

      // 5. Confirm deletion of Employee A
      await deleteEmployee(page, empA.displayName);

      // 6. Verify Employee A is removed, while Employee B remains intact
      await expect(employeeRow(page, empA.displayName)).toHaveCount(0);
      await expectEmployeeRow(page, empB.displayName);

      // 7. Verify deletion persists after page reload
      await page.reload();
      await expect(employeeRow(page, empA.displayName)).toHaveCount(0);
      await expectEmployeeRow(page, empB.displayName);

      await signOut(page);
    });
  });

  test.describe("4. Session, Role Protection & Route Guarding", () => {
    test("verifies institution user access to employee routes, redirection from admin routes, and signed-out route protection", async ({
      page,
      provisionedEmployeePrerequisites,
    }) => {
      const { institution } = provisionedEmployeePrerequisites;

      // 1. Sign in as institution user
      await signIn(page, institution.username, institution.password);

      // 2. Institution user can access Employee directory and Employee create
      await goToEmployeeDirectory(page);
      await expect(page.getByRole("heading", { name: "Employee" })).toBeVisible();

      await goToEmployeeCreate(page);
      await expect(page.getByRole("heading", { name: "Create Employee" })).toBeVisible();

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

      // 5. Unauthenticated visits to protected employee routes redirect to /sign-in
      await page.goto("/employee");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/employee/create");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/employee/any-employee-id/edit");
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  });

  test.describe("5. Accessibility & Keyboard Operability", () => {
    test("passes automated accessibility audits and operates employee creation, edit, and deletion entirely via keyboard", async ({
      page,
      provisionedEmployeePrerequisites,
      runId,
    }) => {
      const { institution, designation, customField } = provisionedEmployeePrerequisites;

      // 1. Sign in as institution user
      await signIn(page, institution.username, institution.password);

      // --- A. Accessibility Audits ---
      await goToEmployeeDirectory(page);
      await expectAccessible(page);

      await goToEmployeeCreate(page);
      await expect(page.getByRole("combobox", { name: "Designation" })).toBeVisible();
      await expect(page.getByLabel("Surname")).toBeVisible();
      await expectAccessible(page);

      // --- B. Keyboard Creation Flow ---
      const kbEmployee = generateIndianEmployee(`KB_${runId}`);

      // Focus first input (Surname)
      await page.getByLabel("Surname").focus();
      await page.keyboard.type(kbEmployee.surname);

      // Tab to First name
      await pressTab(page);
      await page.keyboard.type(kbEmployee.firstName);

      // Tab to Middle name
      await pressTab(page);
      await page.keyboard.type(kbEmployee.middleName);

      // Tab to Date of Birth and fill value
      await tabUntilFocused(page, page.getByLabel("Date of Birth"));
      await page.getByLabel("Date of Birth").fill(kbEmployee.dateOfBirth);

      // Tab to Gender trigger, open with Space, select with ArrowDown and Enter
      await tabUntilFocused(page, page.getByRole("combobox", { name: "Gender" }));
      await pressSpace(page);
      await page
        .locator('[data-slot="select-content"]')
        .getByRole("option", { name: kbEmployee.gender, exact: true })
        .click();

      // Tab to Designation trigger, open with Space, select option
      await tabUntilFocused(page, page.getByRole("combobox", { name: "Designation" }));
      await pressSpace(page);
      await page
        .locator('[data-slot="select-content"]')
        .getByRole("option", { name: designation.name, exact: true })
        .click();

      // Tab to Seniority rank
      await tabUntilFocused(page, page.getByLabel("Seniority Rank"));
      await page.keyboard.type("3");

      // Tab to PAN number
      await tabUntilFocused(page, page.getByLabel("PAN number"));
      await page.keyboard.type(kbEmployee.panNumber);

      // Tab to Contact number
      await tabUntilFocused(page, page.getByLabel("Contact number"));
      await page.keyboard.type(kbEmployee.contactNumber);

      // Tab to Required custom field
      await tabUntilFocused(page, page.getByLabel(`${customField.label} *`));
      await page.keyboard.type(kbEmployee.customFieldValue);

      // Tab to Create Employee button and submit with Enter
      await tabUntilFocused(page, page.getByRole("button", { name: "Create Employee" }));
      await pressEnter(page);

      // Redirect to directory and verify created employee
      await expect(page).toHaveURL(/\/employee$/);
      await expectEmployeeRow(page, kbEmployee.displayName);

      // --- C. Accessibility on Edit Page ---
      await editEmployee(page, kbEmployee.displayName);
      await expect(page.getByLabel("Surname")).toHaveValue(kbEmployee.surname);
      await expectAccessible(page);

      // --- D. Keyboard Edit Flow ---
      // Tab to Seniority Rank, change value via keyboard
      await page.getByLabel("Seniority Rank").focus();
      await page.keyboard.press("Meta+A");
      await page.keyboard.press("Backspace");
      await page.keyboard.type("6");

      // Tab to Save Changes button and submit with Enter
      await tabUntilFocused(page, page.getByRole("button", { name: "Save Changes" }));
      await pressEnter(page);

      await expect(page).toHaveURL(/\/employee$/);
      const row = employeeRow(page, kbEmployee.displayName);
      await expectRowValues(row, [6]);

      // --- E. Keyboard Deletion Flow ---
      // Open actions menu via keyboard
      await tabUntilFocused(page, row.getByRole("button", { name: "Employee actions" }));
      await pressEnter(page);

      // Navigate to Delete and press Enter
      const deleteMenuItem = page
        .locator('[data-slot="dropdown-menu-content"]')
        .getByText("Delete", { exact: true });
      await deleteMenuItem.click();

      // Dismiss modal with Escape
      await expect(page.getByRole("heading", { name: "Delete Employee" })).toBeVisible();
      await pressEscape(page);
      await expect(page.getByRole("heading", { name: "Delete Employee" })).toHaveCount(0);
      await expectEmployeeRow(page, kbEmployee.displayName);

      // Reopen delete modal and confirm with keyboard
      await tabUntilFocused(page, row.getByRole("button", { name: "Employee actions" }));
      await pressEnter(page);
      await deleteMenuItem.click();

      await expect(page.getByRole("heading", { name: "Delete Employee" })).toBeVisible();
      await tabUntilFocused(page, page.getByRole("button", { name: "Delete Employee" }));
      await pressEnter(page);

      // Verify employee deleted
      await expect(employeeRow(page, kbEmployee.displayName)).toHaveCount(0);

      await signOut(page);
    });
  });

  test.describe("6. Controlled Network Failure & Error Recovery", () => {
    test("gracefully handles server errors, validation failures, timeouts, and network drops without crashing or losing form state", async ({
      page,
      provisionedEmployeePrerequisites,
      runId,
    }) => {
      const { institution, designation, customField } = provisionedEmployeePrerequisites;
      const employeeData = generateIndianEmployee(runId);

      // 1. Sign in as institution user
      await signIn(page, institution.username, institution.password);
      await goToEmployeeCreate(page);
      await expect(page.getByRole("combobox", { name: "Designation" })).toBeVisible();

      // --- A. Create Form Network Interceptions ---
      // Fill base form data
      await fillEmployeeForm(page, {
        surname: employeeData.surname,
        firstName: employeeData.firstName,
        middleName: employeeData.middleName,
        dateOfBirth: employeeData.dateOfBirth,
        gender: employeeData.gender,
        designationName: designation.name,
        seniorityRank: employeeData.seniorityRank,
        panNumber: employeeData.panNumber,
        contactNumber: employeeData.contactNumber,
        customFieldLabel: customField.label,
        customFieldValue: employeeData.customFieldValue,
      });

      // 1. Server validation failure (400)
      const unroute400 = await simulateValidationFailure(
        page,
        "**/trpc/employees.create*",
        "Duplicate employee record detected on server",
      );
      await submitEmployeeCreate(page);
      await expect(page.getByText("Duplicate employee record detected on server")).toBeVisible();
      // Form preserves inputs
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);
      await expect(page.getByLabel("First name")).toHaveValue(employeeData.firstName);
      await page.waitForTimeout(200);
      await unroute400();

      // 2. Server failure (500)
      const unroute500 = await simulateServerError(
        page,
        "**/trpc/employees.create*",
        500,
        "Internal database cluster connection failed",
      );
      await submitEmployeeCreate(page);
      await expect(page.getByText("Internal database cluster connection failed")).toBeVisible();
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);
      await page.waitForTimeout(200);
      await unroute500();

      // 3. Network failure / connection drop
      const unrouteAbort = await simulateNetworkFailure(page, "**/trpc/employees.create*");
      await submitEmployeeCreate(page);
      await expect(page.getByRole("button", { name: "Create Employee" })).toBeVisible();
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);
      await page.waitForTimeout(200);
      await unrouteAbort();

      // 4. Slow mutation & pending indicator
      const unrouteSlow = await simulateSlowResponse(page, "**/trpc/employees.create*", 1500);
      await submitEmployeeCreate(page);
      await expect(page.getByRole("button", { name: "Saving..." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Saving..." })).toBeDisabled();
      await unrouteSlow();

      // Verify successful redirection after slow response resolves
      await expect(page).toHaveURL(/\/employee$/);
      await expectEmployeeRow(page, employeeData.displayName);

      // --- B. Edit Form Network Interceptions ---
      await editEmployee(page, employeeData.displayName);
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);

      // 1. Server error (500) on update
      const unrouteUpdate500 = await simulateServerError(
        page,
        "**/trpc/employees.update*",
        500,
        "Unable to update employee record in database",
      );
      await page.getByLabel("Seniority Rank").fill("9");
      await submitEmployeeEdit(page);
      await expect(page.getByText("Unable to update employee record in database")).toBeVisible();
      // Modified value retained
      await expect(page.getByLabel("Seniority Rank")).toHaveValue("9");
      await page.waitForTimeout(200);
      await unrouteUpdate500();

      // 2. Slow response on update
      const unrouteUpdateSlow = await simulateSlowResponse(page, "**/trpc/employees.update*", 1500);
      await submitEmployeeEdit(page);
      await expect(page.getByRole("button", { name: "Saving..." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Saving..." })).toBeDisabled();
      await unrouteUpdateSlow();

      // Successful redirect back to directory
      await expect(page).toHaveURL(/\/employee$/);
      const row = employeeRow(page, employeeData.displayName);
      await expectRowValues(row, [9]);

      // 3. Unauthorized (401) on update
      await editEmployee(page, employeeData.displayName);
      await expect(page.getByLabel("Surname")).toHaveValue(employeeData.surname);
      const unroute401 = await simulateUnauthorized(
        page,
        "**/trpc/employees.update*",
        "UNAUTHORIZED",
      );
      await page.getByLabel("Seniority Rank").fill("10");
      await submitEmployeeEdit(page);
      await expect(page.getByText("UNAUTHORIZED")).toBeVisible();
      await expect(page.getByLabel("Seniority Rank")).toHaveValue("10");
      await page.waitForTimeout(200);
      await unroute401();

      await signOut(page);
    });
  });
});
