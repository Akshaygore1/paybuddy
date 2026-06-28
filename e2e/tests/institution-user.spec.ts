import {
  addRequiredCustomField,
  archiveCustomField,
  archiveDesignation,
  assertRunEmployeeOrder,
  clickDesignationMove,
  createDesignation,
  deleteEmployee,
  downloadEmployeeDirectoryCsv,
  editEmployee,
  employeeRow,
  enableCustomFieldColumn,
  expectDesignationOrder,
  expectEmployeeRow,
  expectRowValues,
  fillEmployeeForm,
  goToEmployeeCreate,
  goToEmployeeDirectory,
  goToInstitutionSettings,
  resetInstitutionWorkspace,
  searchEmployeeDirectory,
  selectOption,
  setColumnVisibility,
  signIn,
  submitEmployeeCreate,
  submitEmployeeEdit,
} from "../src/helpers";
import { expect, test } from "../src/fixtures";

test.describe("institution user flows", () => {
  test.describe.configure({ mode: "serial" });

  test("signs in to the institution workspace", async ({ page, env }) => {
    await signIn(page, env.identifier, env.password);
    await expect(
      page.getByRole("link", { name: "Employee Setup" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Institution" })).toHaveCount(
      0,
    );
  });

  test("resets the workspace, manages designation ordering, and creates employees", async ({
    page,
    env,
    run,
  }) => {
    await signIn(page, env.identifier, env.password);
    await resetInstitutionWorkspace(page);
    await goToInstitutionSettings(page);

    await createDesignation(page, run.designationNames.headmaster);
    await createDesignation(page, run.designationNames.teacher);
    await createDesignation(page, run.designationNames.associate);

    await expectDesignationOrder(page, [
      run.designationNames.headmaster,
      run.designationNames.teacher,
      run.designationNames.associate,
    ]);

    await clickDesignationMove(page, run.designationNames.associate, "up");
    await clickDesignationMove(page, run.designationNames.associate, "up");
    await expectDesignationOrder(page, [
      run.designationNames.associate,
      run.designationNames.headmaster,
      run.designationNames.teacher,
    ]);

    await goToEmployeeCreate(page);
    await addRequiredCustomField(page, run.customFieldLabel);

    await fillEmployeeForm(page, {
      ...run.employees.headmaster,
      customFieldLabel: run.customFieldLabel,
      customFieldValue: undefined,
    });
    await submitEmployeeCreate(page);
    await expect(page.getByRole("alert")).toHaveCount(1);
    await expect(page.getByRole("alert")).toContainText(
      `${run.customFieldLabel} is required`,
    );
    await expect(
      page.locator('input[id^="employee-custom-create-"]'),
    ).toHaveCount(1);

    await page
      .getByLabel(`${run.customFieldLabel} *`)
      .fill(run.employees.headmaster.customFieldValue);
    await submitEmployeeCreate(page);
    await expect(page).toHaveURL(/\/employee$/);

    for (const employee of [
      run.employees.teacherA,
      run.employees.teacherB,
      run.employees.associate,
    ]) {
      await goToEmployeeCreate(page);
      await fillEmployeeForm(page, {
        ...employee,
        customFieldLabel: run.customFieldLabel,
        customFieldValue: employee.customFieldValue,
      });
      await submitEmployeeCreate(page);
      await expect(page).toHaveURL(/\/employee$/);
    }
  });

  test("shows the created directory rows and ordering", async ({
    page,
    env,
    run,
  }) => {
    await signIn(page, env.identifier, env.password);
    await goToEmployeeDirectory(page);

    for (const employee of Object.values(run.employees)) {
      await expectEmployeeRow(page, employee.displayName);
    }

    await enableCustomFieldColumn(page, run.customFieldLabel);

    await expectRowValues(
      employeeRow(page, run.employees.headmaster.displayName),
      [
        run.designationNames.headmaster,
        run.employees.headmaster.seniorityRank,
        run.employees.headmaster.customFieldValue,
      ],
    );
    await expectRowValues(
      employeeRow(page, run.employees.teacherA.displayName),
      [
        run.designationNames.teacher,
        run.employees.teacherA.seniorityRank,
        run.employees.teacherA.customFieldValue,
      ],
    );

    await assertRunEmployeeOrder(page, run);
  });

  test("filters the directory by visible columns and exports visible columns to csv", async ({
    page,
    env,
    run,
  }) => {
    await signIn(page, env.identifier, env.password);
    await goToEmployeeDirectory(page);

    await searchEmployeeDirectory(page, run.employees.teacherA.surname);
    await expectEmployeeRow(page, run.employees.teacherA.displayName);
    await expect(employeeRow(page, run.employees.teacherB.displayName)).toHaveCount(
      0,
    );
    await expect(page.getByText("1 matching employee records of 4")).toBeVisible();
    await expect(
      page.getByText("Showing 1-1 of 1 matches (4 total)", { exact: true }),
    ).toBeVisible();

    await enableCustomFieldColumn(page, run.customFieldLabel);
    await searchEmployeeDirectory(page, run.employees.teacherA.customFieldValue);
    await expectEmployeeRow(page, run.employees.teacherA.displayName);
    await expect(employeeRow(page, run.employees.headmaster.displayName)).toHaveCount(
      0,
    );

    await setColumnVisibility(page, run.customFieldLabel, false);
    await expect(
      page.getByText("No employees match your search.", { exact: true }),
    ).toBeVisible();

    await searchEmployeeDirectory(page, run.employees.associate.surname);
    await expectEmployeeRow(page, run.employees.associate.displayName);
    await enableCustomFieldColumn(page, run.customFieldLabel);

    const { download, rows } = await downloadEmployeeDirectoryCsv(page);
    expect(download.suggestedFilename()).toBe("employee-directory.csv");
    expect(rows[0]).toEqual([
      "Employee",
      "Rank",
      "Designation",
      "Contact",
      run.customFieldLabel,
      "Created",
    ]);

    const exportedNames = rows.slice(1).map((row) => row[0]);
    expect(exportedNames).toEqual(
      expect.arrayContaining([
        run.employees.headmaster.displayName,
        run.employees.teacherA.displayName,
        run.employees.teacherB.displayName,
        run.employees.associate.displayName,
      ]),
    );
    expect(rows).toHaveLength(5);
  });

  test("saves payroll and downloads monthly and annual payslips", async ({
    page,
    env,
    run,
  }) => {
    await signIn(page, env.identifier, env.password);
    await page.getByRole("link", { name: "Payroll", exact: true }).click();
    await expect(page).toHaveURL(/\/payroll$/);
    await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();

    const employeeName = [
      run.employees.headmaster.firstName,
      run.employees.headmaster.middleName,
      run.employees.headmaster.surname,
    ].join(" ");
    const customPayrollFieldLabel = `Test Allowance ${run.suffix}`;

    await selectOption(page, "Select employee", employeeName);
    await expect(
      page.getByRole("combobox", { name: "Select employee", exact: true }),
    ).toContainText(employeeName);
    await selectOption(page, "Select payroll financial year", "2026-2027");
    await selectOption(page, "Select payroll month", "June 2026");
    await page.getByRole("button", { name: "Show Payroll Form" }).click();

    await page.getByLabel("Basic Pay amount").fill("1000");
    await page.getByLabel("Recovery amount").fill("100");
    await page.getByLabel("Field label").fill(customPayrollFieldLabel);
    await page.getByRole("button", { name: "Add Field" }).click();
    await expect(
      page.getByLabel(`${customPayrollFieldLabel} amount`),
    ).toBeVisible();
    await page.getByLabel(`${customPayrollFieldLabel} amount`).fill("250");

    await expect(page.getByText("₹1,250.00")).toBeVisible();
    await expect(page.getByText("₹100.00")).toBeVisible();
    await expect(page.getByText("₹1,150.00")).toBeVisible();
    await page.getByRole("button", { name: "Save Payroll" }).click();
    await expect(page.getByText("Payroll saved")).toBeVisible();

    await page.reload();
    await selectOption(page, "Select employee", employeeName);
    await expect(
      page.getByRole("combobox", { name: "Select employee", exact: true }),
    ).toContainText(employeeName);
    await selectOption(page, "Select payroll financial year", "2026-2027");
    await selectOption(page, "Select payroll month", "June 2026");
    await page.getByRole("button", { name: "Show Payroll Form" }).click();
    await expect(page.getByLabel("Basic Pay amount")).toHaveValue("1000.00");
    await expect(
      page.getByLabel(`${customPayrollFieldLabel} amount`),
    ).toHaveValue("250.00");

    const monthlyDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download Monthly Payslip" })
      .click();
    await expect((await monthlyDownload).suggestedFilename()).toMatch(
      /^payslip-.*jun-2026\.pdf$/,
    );

    const annualDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Annual Payslip" }).click();
    await expect((await annualDownload).suggestedFilename()).toMatch(
      /^annual-payslip-.*2026-2027\.pdf$/,
    );
  });

  test("edits one employee and then deletes all created employees", async ({
    page,
    env,
    run,
  }) => {
    await signIn(page, env.identifier, env.password);
    await goToEmployeeDirectory(page);
    await enableCustomFieldColumn(page, run.customFieldLabel);

    await editEmployee(page, run.employees.associate.displayName);
    await fillEmployeeForm(page, {
      ...run.employees.associate,
      designationName: run.editedAssociate.designationName,
      seniorityRank: run.editedAssociate.seniorityRank,
      customFieldLabel: run.customFieldLabel,
      customFieldValue: run.editedAssociate.customFieldValue,
    });
    await submitEmployeeEdit(page);
    await expect(page).toHaveURL(/\/employee$/);
    await enableCustomFieldColumn(page, run.customFieldLabel);

    await expectRowValues(
      employeeRow(page, run.employees.associate.displayName),
      [
        run.editedAssociate.designationName,
        run.editedAssociate.seniorityRank,
        run.editedAssociate.customFieldValue,
      ],
    );

    for (const employee of Object.values(run.employees)) {
      await deleteEmployee(page, employee.displayName);
    }
  });

  test("archives the run setup and leaves the workspace clean", async ({
    page,
    env,
    run,
  }) => {
    await signIn(page, env.identifier, env.password);
    await goToEmployeeCreate(page);
    await archiveCustomField(page, run.customFieldLabel);
    await expect(
      page.getByText("No custom fields added yet.", { exact: true }),
    ).toBeVisible();

    await goToInstitutionSettings(page);
    await archiveDesignation(page, run.designationNames.associate);
    await archiveDesignation(page, run.designationNames.teacher);
    await archiveDesignation(page, run.designationNames.headmaster);
    await expect(
      page.getByText(
        "No designations added yet. Create one to unlock employee creation.",
        {
          exact: true,
        },
      ),
    ).toBeVisible();

    await goToEmployeeDirectory(page);
    await expect(
      page.getByText(
        "Start by creating a designation in Employee Setup, then add your first employee here.",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
  });
});
