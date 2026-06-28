import { addRequiredCustomField, archiveCustomField, archiveDesignation, assertRunEmployeeOrder, clickDesignationMove, createDesignation, deleteEmployee, editEmployee, employeeRow, enableCustomFieldColumn, expectDesignationOrder, expectEmployeeRow, expectRowValues, fillEmployeeForm, goToEmployeeCreate, goToEmployeeDirectory, goToInstitutionSettings, resetInstitutionWorkspace, signIn, submitEmployeeCreate, submitEmployeeEdit } from "../src/helpers";
import { expect, test } from "../src/fixtures";

test.describe("institution user flows", () => {
  test.describe.configure({ mode: "serial" });

  test("signs in to the institution workspace", async ({ page, env }) => {
    await signIn(page, env.identifier, env.password);
    await expect(page.getByRole("link", { name: "Employee Setup" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Institution" })).toHaveCount(0);
  });

  test("resets the workspace, manages designation ordering, and creates employees", async ({ page, env, run }) => {
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
    await expect(page.getByRole("alert")).toContainText(`${run.customFieldLabel} is required`);
    await expect(page.locator('input[id^="employee-custom-create-"]')).toHaveCount(1);

    await page.getByLabel(`${run.customFieldLabel} *`).fill(run.employees.headmaster.customFieldValue);
    await submitEmployeeCreate(page);
    await expect(page).toHaveURL(/\/employee$/);

    for (const employee of [run.employees.teacherA, run.employees.teacherB, run.employees.associate]) {
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

  test("shows the created directory rows and ordering", async ({ page, env, run }) => {
    await signIn(page, env.identifier, env.password);
    await goToEmployeeDirectory(page);

    for (const employee of Object.values(run.employees)) {
      await expectEmployeeRow(page, employee.displayName);
    }

    await enableCustomFieldColumn(page, run.customFieldLabel);

    await expectRowValues(employeeRow(page, run.employees.headmaster.displayName), [
      run.designationNames.headmaster,
      run.employees.headmaster.seniorityRank,
      run.employees.headmaster.customFieldValue,
    ]);
    await expectRowValues(employeeRow(page, run.employees.teacherA.displayName), [
      run.designationNames.teacher,
      run.employees.teacherA.seniorityRank,
      run.employees.teacherA.customFieldValue,
    ]);

    await assertRunEmployeeOrder(page, run);
  });

  test("edits one employee and then deletes all created employees", async ({ page, env, run }) => {
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

    await expectRowValues(employeeRow(page, run.employees.associate.displayName), [
      run.editedAssociate.designationName,
      run.editedAssociate.seniorityRank,
      run.editedAssociate.customFieldValue,
    ]);

    for (const employee of Object.values(run.employees)) {
      await deleteEmployee(page, employee.displayName);
    }
  });

  test("archives the run setup and leaves the workspace clean", async ({ page, env, run }) => {
    await signIn(page, env.identifier, env.password);
    await goToEmployeeCreate(page);
    await archiveCustomField(page, run.customFieldLabel);
    await expect(page.getByText("No custom fields added yet.", { exact: true })).toBeVisible();

    await goToInstitutionSettings(page);
    await archiveDesignation(page, run.designationNames.associate);
    await archiveDesignation(page, run.designationNames.teacher);
    await archiveDesignation(page, run.designationNames.headmaster);
    await expect(
      page.getByText("No designations added yet. Create one to unlock employee creation.", {
        exact: true,
      }),
    ).toBeVisible();

    await goToEmployeeDirectory(page);
    await expect(
      page.getByText("Start by creating a designation in Employee Setup, then add your first employee here.", {
        exact: true,
      }),
    ).toBeVisible();
  });
});
