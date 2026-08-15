import { expect, test } from "../src/fixtures";
import {
  employeeRow,
  enableCustomFieldColumn,
  expectEmployeeRow,
  expectInstitutionNavigation,
  expectRowValues,
  fillEmployeeForm,
  generateIndianEmployee,
  goToEmployeeCreate,
  searchEmployeeDirectory,
  signIn,
  signOut,
  submitEmployeeCreate,
} from "../src/helpers";
import { updateRunManifest } from "../src/manifest";

test.describe("employee smoke", () => {
  test("provisions prerequisites via API, creates realistic Indian employee via UI, verifies directory persistence and navigation", async ({
    page,
    env,
    runId,
    provisionedEmployeePrerequisites,
  }) => {
    const { institution, designation, customField } = provisionedEmployeePrerequisites;
    const employeeData = generateIndianEmployee(runId);

    // 1. Log run context for inspection (never log passwords)
    console.log(
      `[E2E Smoke: Employee] Run ID: ${runId} | Institution: "${institution.name}" | Username: "${institution.username}" | Employee: "${employeeData.displayName}" | Designation: "${designation.name}" | Target: ${env.baseURL}`,
    );
    test
      .info()
      .annotations.push(
        { type: "run-id", description: runId },
        { type: "institution-name", description: institution.name },
        { type: "institution-username", description: institution.username },
        { type: "designation-name", description: designation.name },
        { type: "custom-field-label", description: customField.label },
        { type: "employee-name", description: employeeData.displayName },
      );

    // 2. Sign in as the generated institution user
    await signIn(page, institution.username, institution.password);

    // 3. Verify role-appropriate navigation for institution user
    await expectInstitutionNavigation(page);

    // 4. Navigate to Employee Create page
    await goToEmployeeCreate(page);

    // 5. Fill the employee form with realistic Indian data across all control types
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

    // 6. Submit the form
    await submitEmployeeCreate(page);

    // 7. Verify redirect to directory and check that employee is visible and persisted with expected values
    await expect(page).toHaveURL(/\/employee$/);
    await expect(page.getByRole("heading", { name: "Employee" })).toBeVisible();
    await expectEmployeeRow(page, employeeData.displayName);

    const row = employeeRow(page, employeeData.displayName);
    await expectRowValues(row, [
      employeeData.seniorityRank,
      designation.name,
      employeeData.contactNumber,
    ]);

    // 8. Enable custom field column and verify the custom field value is visible
    await enableCustomFieldColumn(page, customField.label);
    await expectRowValues(row, [employeeData.customFieldValue]);

    // 9. Verify search filtering in the directory
    await searchEmployeeDirectory(page, employeeData.surname);
    await expect(row).toBeVisible();
    await searchEmployeeDirectory(page, "");

    // 10. Record created employee details in the run manifest
    await updateRunManifest(runId, (prev) => ({
      ...prev,
      createdEmployee: {
        surname: employeeData.surname,
        firstName: employeeData.firstName,
        middleName: employeeData.middleName,
        displayName: employeeData.displayName,
        dateOfBirth: employeeData.dateOfBirth,
        gender: employeeData.gender,
        designationName: designation.name,
        seniorityRank: employeeData.seniorityRank,
        panNumber: employeeData.panNumber,
        contactNumber: employeeData.contactNumber,
        customFields: {
          [customField.label]: employeeData.customFieldValue,
        },
      },
    }));

    // 11. Institution user signs out
    await signOut(page);
  });
});
