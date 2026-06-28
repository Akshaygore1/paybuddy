import { readFile } from "node:fs/promises";

import { expect, type Download, type Locator, type Page } from "@playwright/test";

import type { RunContext } from "./run-context";

const EMPLOYEE_DIRECTORY_EMPTY_STATE =
  "Start by creating a designation in Employee Setup, then add your first employee here.";
const CUSTOM_FIELDS_EMPTY_STATE = "No custom fields added yet.";
const DESIGNATIONS_EMPTY_STATE = "No designations added yet. Create one to unlock employee creation.";

export async function signIn(page: Page, identifier: string, password: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email or Username").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/employee$/);
  await expect(page.getByRole("heading", { name: "Employee" })).toBeVisible();
}

export async function selectOption(page: Page, triggerName: string, optionText: string) {
  await page.getByRole("combobox", { name: triggerName, exact: true }).click();
  await page.locator('[data-slot="select-content"]').getByRole("option", { name: optionText, exact: true }).click();
}

export async function goToInstitutionSettings(page: Page) {
  await page.getByRole("link", { name: "Employee Setup", exact: true }).click();
  await expect(page).toHaveURL(/\/institution-settings$/);
  await expect(page.getByRole("heading", { name: "Employee Setup" })).toBeVisible();
}

export async function goToEmployeeDirectory(page: Page) {
  await page.getByRole("link", { name: "Employee", exact: true }).click();
  await expect(page).toHaveURL(/\/employee$/);
  await expect(page.getByRole("heading", { name: "Employee" })).toBeVisible();
}

export async function goToEmployeeCreate(page: Page) {
  await page.goto("/employee/create");
  await expect(page).toHaveURL(/\/employee\/create$/);
  await expect(page.getByRole("heading", { name: "Create Employee" })).toBeVisible();
}

export async function createDesignation(page: Page, name: string) {
  await page.getByLabel("Designation name").fill(name);
  await page.getByRole("button", { name: "Create Designation" }).click();
  await expect(page.getByTestId("designation-name").filter({ hasText: name })).toBeVisible();
}

export async function clickDesignationMove(page: Page, name: string, direction: "up" | "down") {
  const label = direction === "up" ? `Move ${name} up` : `Move ${name} down`;
  await page.getByRole("button", { name: label, exact: true }).click();
}

export async function expectDesignationOrder(page: Page, namesInOrder: string[]) {
  await expect
    .poll(async () => {
      const designationNames = await page.getByTestId("designation-name").allInnerTexts();
      const indexes = namesInOrder.map((name) => designationNames.indexOf(name));
      return indexes.every((value) => value >= 0) &&
        indexes.every((value, index) => {
          if (index === 0) {
            return true;
          }

          const previousValue = indexes[index - 1];
          return previousValue !== undefined && value > previousValue;
        });
    })
    .toBeTruthy();
}

export async function addRequiredCustomField(page: Page, label: string) {
  await page.getByLabel("Field label").fill(label);
  await page.getByRole("checkbox", { name: "Required" }).click();
  await page.getByRole("button", { name: "Add Field" }).click();
  await expect(page.getByTestId("custom-field-manager-name").filter({ hasText: label })).toBeVisible();
  await expect(page.getByLabel(`${label} *`)).toBeVisible();
}

export async function fillEmployeeForm(
  page: Page,
  input: {
    firstName: string;
    middleName: string;
    surname: string;
    dateOfBirth: string;
    gender: "Male" | "Female";
    designationName: string;
    seniorityRank: number;
    panNumber: string;
    contactNumber: string;
    customFieldLabel: string;
    customFieldValue?: string;
  },
) {
  await page.getByLabel("Surname").fill(input.surname);
  await page.getByLabel("First name").fill(input.firstName);
  await page.getByLabel("Middle name").fill(input.middleName);
  await page.getByLabel("Date of Birth").fill(input.dateOfBirth);
  await selectOption(page, "Gender", input.gender);
  await selectOption(page, "Designation", input.designationName);
  await page.getByLabel("Seniority Rank").fill(String(input.seniorityRank));
  await page.getByLabel("PAN number").fill(input.panNumber);
  await page.getByLabel("Contact number").fill(input.contactNumber);

  if (input.customFieldValue !== undefined) {
    await page.getByLabel(`${input.customFieldLabel} *`).fill(input.customFieldValue);
  }
}

export async function submitEmployeeCreate(page: Page) {
  await page.getByRole("button", { name: "Create Employee" }).click();
}

export async function submitEmployeeEdit(page: Page) {
  await page.getByRole("button", { name: "Save Changes" }).click();
}

export async function expectEmployeeRow(page: Page, displayName: string) {
  await expect(employeeRow(page, displayName)).toBeVisible();
}

export async function enableCustomFieldColumn(page: Page, label: string) {
  await setColumnVisibility(page, label, true);
  await expect(page.getByRole("columnheader", { name: label, exact: true })).toBeVisible();
}

export async function setColumnVisibility(
  page: Page,
  label: string,
  visible: boolean,
) {
  await page.getByRole("button", { name: "Choose Columns" }).click();
  const columnToggle = page.getByRole("menuitemcheckbox", {
    name: label,
    exact: true,
  });
  const isChecked = (await columnToggle.getAttribute("aria-checked")) === "true";

  if (isChecked !== visible) {
    await columnToggle.click();
  }

  await page.keyboard.press("Escape");

  if (visible) {
    await expect(page.getByRole("columnheader", { name: label, exact: true })).toBeVisible();
    return;
  }

  await expect(page.getByRole("columnheader", { name: label, exact: true })).toHaveCount(0);
}

export async function searchEmployeeDirectory(page: Page, value: string) {
  await page.getByLabel("Search employees").fill(value);
}

export async function downloadEmployeeDirectoryCsv(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV", exact: true }).click();
  const download = await downloadPromise;

  return {
    download,
    rows: await readCsvDownload(download),
  };
}

export function employeeRow(page: Page, displayName: string) {
  return page.locator('table[aria-label="Employee directory"] tbody tr').filter({
    hasText: displayName,
  });
}

export async function openEmployeeActions(page: Page, displayName: string) {
  await employeeRow(page, displayName).getByRole("button", { name: "Employee actions" }).click();
}

export async function deleteEmployee(page: Page, displayName: string) {
  const row = employeeRow(page, displayName);

  if ((await row.count()) === 0) {
    return;
  }

  await openEmployeeActions(page, displayName);
  await page.locator('[data-slot="dropdown-menu-content"]').getByText("Delete", { exact: true }).click();
  await page.getByRole("button", { name: "Delete employee" }).click();
  await waitForMutationToSettle({
    targetRow: row,
    emptyState: employeeDirectoryEmptyState(page),
  });
}

export async function editEmployee(page: Page, displayName: string) {
  await openEmployeeActions(page, displayName);
  await page.locator('[data-slot="dropdown-menu-content"]').getByText("Edit", { exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/.*\/edit$/);
  await expect(page.getByRole("heading", { name: "Edit Employee" })).toBeVisible();
}

export async function archiveDesignation(page: Page, name: string) {
  const row = designationRow(page, name);

  if ((await row.count()) === 0) {
    return;
  }

  await row.getByRole("button", { name: `Remove ${name}`, exact: true }).click();
  await waitForMutationToSettle({
    targetRow: row,
    emptyState: designationEmptyState(page),
  });
}

export async function archiveCustomField(page: Page, label: string) {
  const row = customFieldManagerRow(page, label);

  if ((await row.count()) === 0) {
    return;
  }

  await row.getByRole("button", { name: `Remove ${label}`, exact: true }).click();
  await waitForMutationToSettle({
    targetRow: row,
    emptyState: customFieldEmptyState(page),
  });
  await expect(page.getByLabel(`${label} *`)).toHaveCount(0);
}

export async function assertRunEmployeeOrder(page: Page, run: RunContext) {
  const bodyRows = page.locator('table[aria-label="Employee directory"] tbody tr');
  const allRows = await bodyRows.allInnerTexts();
  const runRows = allRows
    .filter((text) => text.includes(run.suffix))
    .map((text) => text.replace(/\s+/g, " ").trim());

  expect(runRows).toHaveLength(4);
  expect(runRows[0]).toContain(run.employees.headmaster.displayName);
  expect(runRows[1]).toContain(run.employees.teacherA.displayName);
  expect(runRows[2]).toContain(run.employees.teacherB.displayName);
  expect(runRows[3]).toContain(run.employees.associate.displayName);
}

export async function expectRowValues(
  row: Locator,
  values: Array<string | number>,
) {
  for (const value of values) {
    await expect(row).toContainText(String(value));
  }
}

export async function waitForMutationToSettle(input: {
  targetRow: Locator;
  emptyState: Locator;
}) {
  await expect
    .poll(async () => {
      const rowCount = await input.targetRow.count();
      const emptyVisible = await input.emptyState.isVisible().catch(() => false);
      return rowCount === 0 || emptyVisible;
    })
    .toBeTruthy();
}

export async function deleteAllEmployees(page: Page) {
  await goToEmployeeDirectory(page);

  await waitForListToSettle({
    rows: page.locator('table[aria-label="Employee directory"] tbody tr'),
    emptyState: employeeDirectoryEmptyState(page),
  });

  while (!(await employeeDirectoryEmptyState(page).isVisible().catch(() => false))) {
    const displayName = await visibleEmployeeDisplayName(page);
    await deleteEmployee(page, displayName);
  }

  await expect(employeeDirectoryEmptyState(page)).toBeVisible();
}

export async function archiveAllCustomFields(page: Page) {
  await goToEmployeeCreate(page);

  await waitForListToSettle({
    rows: customFieldManagerRows(page),
    emptyState: customFieldEmptyState(page),
  });

  while (!(await customFieldEmptyState(page).isVisible().catch(() => false))) {
    const label = await visibleCustomFieldLabel(page);
    await archiveCustomField(page, label);
  }

  await expect(customFieldEmptyState(page)).toBeVisible();
}

export async function archiveAllDesignations(page: Page) {
  await goToInstitutionSettings(page);

  await waitForListToSettle({
    rows: designationRows(page),
    emptyState: designationEmptyState(page),
  });

  while (!(await designationEmptyState(page).isVisible().catch(() => false))) {
    const name = await visibleDesignationName(page);
    await archiveDesignation(page, name);
  }

  await expect(designationEmptyState(page)).toBeVisible();
}

export async function resetInstitutionWorkspace(page: Page) {
  await deleteAllEmployees(page);
  await archiveAllCustomFields(page);
  await archiveAllDesignations(page);
}

function employeeDirectoryEmptyState(page: Page) {
  return page.getByText(EMPLOYEE_DIRECTORY_EMPTY_STATE, { exact: true });
}

function customFieldEmptyState(page: Page) {
  return page.getByText(CUSTOM_FIELDS_EMPTY_STATE, { exact: true });
}

function designationEmptyState(page: Page) {
  return page.getByText(DESIGNATIONS_EMPTY_STATE, { exact: true });
}

function customFieldManagerRow(page: Page, label: string) {
  return page.getByTestId("custom-field-manager-row").filter({
    has: page.getByTestId("custom-field-manager-name").filter({ hasText: new RegExp(`^${escapeRegExp(label)}(?:\\s+\\*)?$`) }),
  });
}

function customFieldManagerRows(page: Page) {
  return page.getByTestId("custom-field-manager-row");
}

function designationRow(page: Page, name: string) {
  return page.getByTestId("designation-row").filter({
    has: page.getByTestId("designation-name").filter({ hasText: new RegExp(`^${escapeRegExp(name)}$`) }),
  });
}

function designationRows(page: Page) {
  return page.getByTestId("designation-row");
}

async function visibleEmployeeDisplayName(page: Page) {
  const name = await page
    .locator('table[aria-label="Employee directory"] tbody tr td')
    .first()
    .locator("p.font-medium")
    .textContent();

  if (!name) {
    throw new Error("Expected at least one employee row to be visible");
  }

  return name.replace(/\s+/g, " ").trim();
}

async function visibleCustomFieldLabel(page: Page) {
  const label = await page.getByTestId("custom-field-manager-name").first().textContent();

  if (!label) {
    throw new Error("Expected at least one custom field row to be visible");
  }

  return label.replace(/\s+\*$/, "").trim();
}

async function visibleDesignationName(page: Page) {
  const name = await page.getByTestId("designation-name").first().textContent();

  if (!name) {
    throw new Error("Expected at least one designation row to be visible");
  }

  return name.trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForListToSettle(input: {
  rows: Locator;
  emptyState: Locator;
}) {
  await expect
    .poll(async () => {
      const rowCount = await input.rows.count();
      const emptyVisible = await input.emptyState.isVisible().catch(() => false);
      return rowCount > 0 || emptyVisible;
    })
    .toBeTruthy();
}

async function readCsvDownload(download: Download) {
  const downloadPath = await download.path();

  if (!downloadPath) {
    throw new Error("Expected download path to be available");
  }

  return parseCsv(await readFile(downloadPath, "utf8"));
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (!inQuotes && character === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}
