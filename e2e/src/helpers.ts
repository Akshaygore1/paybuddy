import { readFile } from "node:fs/promises";

import { expect, type Download, type Locator, type Page } from "@playwright/test";

import type { RunContext } from "./run-context";

export * from "./api-client";
export * from "./data/indian-institutions";
export * from "./data/indian-employees";
export * from "./a11y-helpers";
export * from "./keyboard-helpers";
export * from "./network-helpers";

const EMPLOYEE_DIRECTORY_EMPTY_STATE =
  "Start by creating a designation in Employee Setup, then add your first employee here.";
const CUSTOM_FIELDS_EMPTY_STATE = "No custom fields added yet.";
const DESIGNATIONS_EMPTY_STATE =
  "No designations added yet. Create one to unlock employee creation.";

export async function signIn(page: Page, identifier: string, password: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email or Username").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/(?:dashboard|employee)$/);
}

export async function selectOption(page: Page, triggerName: string, optionText: string) {
  await page.getByRole("combobox", { name: triggerName, exact: true }).click();
  const option = page
    .locator('[data-slot="select-content"]')
    .getByRole("option", { name: optionText, exact: true });
  await expect(option).toBeVisible();
  await option.click({ force: true });
}

export async function fillPayrollAmount(input: Locator, value: string) {
  await input.focus();
  const currentValue = await input.inputValue();
  await expect(input).toHaveValue(currentValue.replaceAll(",", ""));
  await input.fill(value);
}

export function employeeFullName(employee: {
  firstName: string;
  middleName: string;
  surname: string;
}) {
  return [employee.firstName, employee.middleName, employee.surname].filter(Boolean).join(" ");
}

export async function savePayrollAndWait(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/trpc/payroll.save"),
  );
  const saveButton = page.getByRole("button", { name: "Save Payroll" });
  await saveButton.click();
  const response = await responsePromise;

  if (!response.ok()) {
    throw new Error(`Payroll save request failed with status ${response.status()}`);
  }

  await expect(page.getByText("Payroll saved", { exact: true }).last()).toBeVisible();
}

export async function selectGlobalFinancialYear(page: Page, optionText: string) {
  await openSidebarIfMobile(page);
  await selectOption(page, "Select financial year", optionText);
}

export async function goToInstitutionSettings(page: Page) {
  await openSidebarIfMobile(page);
  await page.getByRole("link", { name: "Employee Setup", exact: true }).click();
  await expect(page).toHaveURL(/\/institution-settings$/);
  await expect(page.getByRole("heading", { name: "Employee Setup" })).toBeVisible();
}

export async function goToEmployeeDirectory(page: Page) {
  await openSidebarIfMobile(page);
  await page.getByRole("link", { name: "Employee", exact: true }).click();
  await expect(page).toHaveURL(/\/employee$/);
  await expect(page.getByRole("heading", { name: "Employee" })).toBeVisible();
}

export async function goToEmployeeCreate(page: Page) {
  await page.goto("/employee/create");
  await expect(page).toHaveURL(/\/employee\/create$/);
  await expect(page.getByRole("heading", { name: "Create Employee" })).toBeVisible();
}

export async function goToPayroll(page: Page) {
  await openSidebarIfMobile(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await expect(page).toHaveURL(/\/payroll$/);
  await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();
}

export async function goToReports(page: Page) {
  await openSidebarIfMobile(page);
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByRole("heading", { name: /Reports/ })).toBeVisible();
}

export function payrollSectionCard(page: Page, section: "Earnings" | "Deductions") {
  return page.locator('[data-slot="card"]').filter({
    has: page.getByText(section, { exact: true }),
  });
}

export async function downloadPayrollArtifact(page: Page, buttonName: string) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  if (!downloadPath) {
    throw new Error("Expected downloaded payslip path to be available");
  }

  return {
    download,
    bytes: await readFile(downloadPath),
  };
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
      return (
        indexes.every((value) => value >= 0) &&
        indexes.every((value, index) => {
          if (index === 0) {
            return true;
          }

          const previousValue = indexes[index - 1];
          return previousValue !== undefined && value > previousValue;
        })
      );
    })
    .toBeTruthy();
}

export async function addRequiredCustomField(page: Page, label: string) {
  await page.getByLabel("Field label").fill(label);
  await page.getByRole("checkbox", { name: "Required" }).click();
  await page.getByRole("button", { name: "Add Field" }).click();
  await expect(
    page.getByTestId("custom-field-manager-name").filter({ hasText: label }),
  ).toBeVisible();
  await expect(page.getByLabel(`${label} *`)).toBeVisible();
}

export async function addOptionalCustomField(page: Page, label: string) {
  await page.getByLabel("Field label").fill(label);
  await page.getByRole("button", { name: "Add Field" }).click();
  await expect(
    page.getByTestId("custom-field-manager-name").filter({ hasText: label }),
  ).toBeVisible();
  await expect(page.getByLabel(label, { exact: true })).toBeVisible();
}

export async function fillEmployeeForm(
  page: Page,
  input: {
    firstName?: string;
    middleName?: string;
    surname?: string;
    dateOfBirth?: string;
    gender?: "Male" | "Female";
    designationName?: string;
    seniorityRank?: number | string;
    panNumber?: string;
    pfNumber?: string;
    npsAccountNumber?: string;
    whatsAppNumber?: string;
    contactNumber?: string;
    customFieldLabel?: string;
    customFieldValue?: string;
    customFields?: Record<string, string>;
  },
) {
  if (input.surname !== undefined) await page.getByLabel("Surname").fill(input.surname);
  if (input.firstName !== undefined) await page.getByLabel("First name").fill(input.firstName);
  if (input.middleName !== undefined) await page.getByLabel("Middle name").fill(input.middleName);
  if (input.dateOfBirth !== undefined)
    await page.getByLabel("Date of Birth").fill(input.dateOfBirth);
  if (input.gender !== undefined) await selectOption(page, "Gender", input.gender);
  if (input.designationName !== undefined)
    await selectOption(page, "Designation", input.designationName);
  if (input.seniorityRank !== undefined)
    await page.getByLabel("Seniority Rank").fill(String(input.seniorityRank));
  if (input.panNumber !== undefined) await page.getByLabel("PAN number").fill(input.panNumber);
  if (input.pfNumber !== undefined) await page.getByLabel("PF number").fill(input.pfNumber);
  if (input.npsAccountNumber !== undefined)
    await page.getByLabel("NPS account number").fill(input.npsAccountNumber);
  if (input.whatsAppNumber !== undefined)
    await page.getByLabel("WhatsApp number").fill(input.whatsAppNumber);
  if (input.contactNumber !== undefined)
    await page.getByLabel("Contact number").fill(input.contactNumber);

  if (input.customFieldLabel && input.customFieldValue !== undefined) {
    await page
      .getByLabel(new RegExp(`^${escapeRegExp(input.customFieldLabel)}(?:\\s+\\*)?$`))
      .fill(input.customFieldValue);
  }

  if (input.customFields) {
    for (const [label, value] of Object.entries(input.customFields)) {
      await page.getByLabel(new RegExp(`^${escapeRegExp(label)}(?:\\s+\\*)?$`)).fill(value);
    }
  }
}

export async function submitEmployeeCreate(page: Page) {
  await page.getByRole("button", { name: "Create Employee" }).click({ force: true });
}

export async function submitEmployeeEdit(page: Page) {
  await page.getByRole("button", { name: "Save Changes" }).click({ force: true });
}

export async function expectEmployeeRow(page: Page, displayName: string) {
  await expect(employeeRow(page, displayName)).toBeVisible();
}

export async function enableCustomFieldColumn(page: Page, label: string) {
  await setColumnVisibility(page, label, true);
  await expect(page.getByRole("columnheader", { name: label, exact: true })).toBeVisible();
}

export async function setColumnVisibility(page: Page, label: string, visible: boolean) {
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
  await expect(page.locator('[data-slot="dropdown-menu-content"]')).toHaveCount(0);

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
  await page
    .locator('[data-slot="dropdown-menu-content"]')
    .getByText("Delete", { exact: true })
    .click();
  await page.getByRole("button", { name: "Delete employee" }).click();
  await waitForMutationToSettle({
    targetRow: row,
    emptyState: employeeDirectoryEmptyState(page),
  });
}

export async function editEmployee(page: Page, displayName: string) {
  await openEmployeeActions(page, displayName);
  await page
    .locator('[data-slot="dropdown-menu-content"]')
    .getByText("Edit", { exact: true })
    .click();
  await expect(page).toHaveURL(/\/employee\/.*\/edit$/);
  await expect(page.getByRole("heading", { name: "Edit Employee" })).toBeVisible();
}

export async function archiveDesignation(page: Page, name: string) {
  const row = designationRow(page, name);

  if ((await row.count()) === 0) {
    return;
  }

  await row.getByRole("button", { name: `Remove ${name}`, exact: true }).click();
  const confirmButton = page.getByRole("button", {
    name: "Remove Designation",
  });
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
  }
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
  const confirmButton = page.getByRole("button", { name: "Remove Field" });
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
  }
  await waitForMutationToSettle({
    targetRow: row,
    emptyState: customFieldEmptyState(page),
  });
  await expect(page.getByLabel(new RegExp(`^${escapeRegExp(label)}(?:\\s+\\*)?$`))).toHaveCount(0);
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

export async function expectRowValues(row: Locator, values: Array<string | number>) {
  for (const value of values) {
    await expect(row).toContainText(String(value));
  }
}

export async function waitForMutationToSettle(input: { targetRow: Locator; emptyState: Locator }) {
  await expect
    .poll(async () => {
      const rowCount = await input.targetRow.count();
      const emptyVisible = await input.emptyState.isVisible().catch(() => false);
      return rowCount === 0 || emptyVisible;
    })
    .toBeTruthy();
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
    has: page
      .getByTestId("custom-field-manager-name")
      .filter({ hasText: new RegExp(`^${escapeRegExp(label)}(?:\\s+\\*)?$`) }),
  });
}

function designationRow(page: Page, name: string) {
  return page.getByTestId("designation-row").filter({
    has: page
      .getByTestId("designation-name")
      .filter({ hasText: new RegExp(`^${escapeRegExp(name)}$`) }),
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

export async function signOut(page: Page) {
  const signOutButton = page.getByRole("button", {
    name: "Sign Out",
    exact: true,
  });
  const trigger = page.locator('[data-sidebar="trigger"]');
  const isMobile = (page.viewportSize()?.width ?? 1000) < 768;

  if (isMobile) {
    // Wait for any previous sheet closing animation to finish
    await page.waitForTimeout(300);
    const isVisible = await signOutButton.isVisible().catch(() => false);
    if (!isVisible && (await trigger.isVisible().catch(() => false))) {
      await trigger.click();
      await expect(signOutButton).toBeVisible();
    }
  } else {
    if (!(await signOutButton.isVisible().catch(() => false))) {
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.click();
        await expect(signOutButton).toBeVisible();
      }
    }
  }

  await signOutButton.click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
}

export async function openSidebarIfMobile(page: Page) {
  const trigger = page.locator('[data-sidebar="trigger"]');
  const isTriggerVisible = await trigger.isVisible().catch(() => false);
  if (isTriggerVisible) {
    const dashboardLink = page.getByRole("link", { name: "Dashboard" }).first();
    const isLinkVisible = await dashboardLink.isVisible().catch(() => false);
    if (!isLinkVisible) {
      await trigger.click();
      await expect(dashboardLink).toBeVisible();
    }
  }
}

export async function expectAdminNavigation(page: Page) {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Institution" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Reports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Employee", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Payroll", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Employee Setup", exact: true })).toHaveCount(0);

  await openSidebarIfMobile(page);
  await expect(page.getByRole("link", { name: "Institution", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Custom Fields", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reports", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Employee Setup", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Payroll", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Employee", exact: true })).toHaveCount(0);
}

export async function expectInstitutionNavigation(page: Page) {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Employee", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Payroll", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Reports", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Employee Setup", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Institution", exact: true })).toHaveCount(0);

  await openSidebarIfMobile(page);
  await expect(page.getByRole("link", { name: "Employee", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Employee Setup", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Payroll", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reports", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Institution", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Manage Custom Fields", exact: true })).toHaveCount(
    0,
  );
}

export async function createInstitutionViaUI(
  page: Page,
  data: {
    name: string;
    tanNumber: string;
    institutionHead: string;
    address: string;
    username: string;
    password: string;
  },
): Promise<{
  id: string;
  name: string;
  tanNumber: string;
  institutionHead: string;
  address: string;
  username: string;
  password: string;
}> {
  await page.goto("/institutions/create");
  await expect(page).toHaveURL(/\/institutions\/create$/);
  await expect(page.getByRole("heading", { name: "Create Institution" })).toBeVisible();

  // Step 1
  await page.getByLabel("Institution Name").fill(data.name);
  await page.getByLabel("TAN Number").fill(data.tanNumber);
  await page.getByLabel("Institution Head").fill(data.institutionHead);
  await page.getByLabel("Address").fill(data.address);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2
  await expect(page.getByLabel("Username or Email")).toBeVisible();
  await page.getByLabel("Username or Email").fill(data.username);
  await page.getByLabel("Password").fill(data.password);
  await page.getByRole("button", { name: "Create Institution" }).click();

  // Redirect to detail page
  await expect(page).toHaveURL(/\/institutions\/(?!create$)[a-zA-Z0-9_-]+$/);
  const url = page.url();
  const institutionId = url.split("/institutions/")[1]?.split("?")[0] || "";

  return {
    ...data,
    id: institutionId,
  };
}

export async function expectInstitutionDetails(
  page: Page,
  data: {
    id?: string;
    name: string;
    tanNumber: string;
    institutionHead: string;
    address: string;
    username: string;
  },
) {
  if (data.id) {
    await expect(page).toHaveURL(new RegExp(`/institutions/${escapeRegExp(data.id)}$`));
  }
  await expect(page.getByRole("heading", { name: data.name })).toBeVisible();
  await expect(page.getByText(data.name).first()).toBeVisible();
  await expect(page.getByText(data.tanNumber, { exact: true })).toBeVisible();
  await expect(page.getByText(data.institutionHead, { exact: true })).toBeVisible();
  await expect(page.getByText(data.username, { exact: true })).toBeVisible();
  await expect(page.getByText(data.address, { exact: true })).toBeVisible();
  await expect(page.getByText("Current login status: Active")).toBeVisible();
}

export async function goToInstitutionDirectory(page: Page) {
  await page.goto("/institutions");
  await expect(page).toHaveURL(/\/institutions$/);
  await expect(page.getByRole("heading", { name: "Institution" })).toBeVisible();
}

export async function goToInstitutionCreate(page: Page) {
  await page.goto("/institutions/create");
  await expect(page).toHaveURL(/\/institutions\/create$/);
  await expect(page.getByRole("heading", { name: "Create Institution" })).toBeVisible();
}

export async function goToInstitutionDetail(page: Page, institutionId: string) {
  await page.goto(`/institutions/${institutionId}`);
  await expect(page).toHaveURL(new RegExp(`/institutions/${escapeRegExp(institutionId)}$`));
}

export async function fillInstitutionStep1(
  page: Page,
  data: {
    name?: string;
    tanNumber?: string;
    institutionHead?: string;
    address?: string;
  },
) {
  if (data.name !== undefined) await page.getByLabel("Institution Name").fill(data.name);
  if (data.tanNumber !== undefined) await page.getByLabel("TAN Number").fill(data.tanNumber);
  if (data.institutionHead !== undefined)
    await page.getByLabel("Institution Head").fill(data.institutionHead);
  if (data.address !== undefined) await page.getByLabel("Address").fill(data.address);
}

export async function fillInstitutionStep2(
  page: Page,
  data: {
    username?: string;
    password?: string;
  },
) {
  if (data.username !== undefined) await page.getByLabel("Username or Email").fill(data.username);
  if (data.password !== undefined) await page.getByLabel("Password").fill(data.password);
}

export async function resetInstitutionPasswordViaUI(page: Page, newPassword: string) {
  await page.getByLabel("New Password").fill(newPassword);
  await page.getByRole("button", { name: "Reset Password" }).click();
}

export async function toggleInstitutionLoginAccessViaUI(
  page: Page,
  expectNewState: "Active" | "Inactive",
) {
  const buttonName = expectNewState === "Inactive" ? "Deactivate Login" : "Activate Login";
  await page.getByRole("button", { name: buttonName }).click();
  await expect(page.getByText(`Current login status: ${expectNewState}`)).toBeVisible();
  await expect(page.getByText(`Status: ${expectNewState}`, { exact: true })).toBeVisible();
}
