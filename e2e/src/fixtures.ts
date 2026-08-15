import { test as base } from "@playwright/test";

import {
  provisionEmployeeDirectoryViaApi,
  provisionEmployeePrerequisitesViaApi,
  provisionInstitutionViaApi,
  provisionPayrollPrerequisitesViaApi,
  provisionReportsPrerequisitesViaApi,
  type ProvisionedEmployeeDirectory,
  type ProvisionedEmployeePrerequisites,
  type ProvisionedInstitution,
  type ProvisionedPayrollPrerequisites,
  type ProvisionedReportsPrerequisites,
} from "./api-client";
import {
  generateIndianEmployee,
  generateRealisticCustomField,
} from "./data/indian-employees";
import {
  generateIndianInstitution,
  generateRealisticDesignation,
  type IndianInstitutionSeed,
} from "./data/indian-institutions";
import { readTestEnv, type TestEnv } from "./env";
import { updateRunManifest, writeRunManifest, type RunManifest } from "./manifest";
import { createRunContext, type RunContext } from "./run-context";

type TestFixtures = {
  runId: string;
  institution: IndianInstitutionSeed;
  provisionedInstitution: ProvisionedInstitution;
  provisionedEmployeePrerequisites: ProvisionedEmployeePrerequisites;
  provisionedPayrollPrerequisites: ProvisionedPayrollPrerequisites;
  provisionedReportsPrerequisites: ProvisionedReportsPrerequisites;
  provisionedEmployeeDirectory: ProvisionedEmployeeDirectory;
  manifest: RunManifest;
};

type WorkerFixtures = {
  env: TestEnv;
  run: RunContext;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  env: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(readTestEnv());
    },
    { scope: "worker" },
  ],
  run: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(createRunContext());
    },
    { scope: "worker" },
  ],
  // eslint-disable-next-line no-empty-pattern
  runId: async ({}, use) => {
    const id = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await use(id);
  },
  institution: async ({ runId }, use) => {
    const institution = generateIndianInstitution(runId);
    await use(institution);
  },
  provisionedInstitution: async ({ env, institution, runId }, use) => {
    const provisioned = await provisionInstitutionViaApi(env, institution);
    await updateRunManifest(runId, (prev) => ({
      ...prev,
      createdInstitution: {
        id: provisioned.id,
        name: provisioned.name,
        tanNumber: provisioned.tanNumber,
        institutionHead: provisioned.institutionHead,
        address: provisioned.address,
        username: provisioned.username,
      },
    }));
    await use(provisioned);
  },
  provisionedEmployeePrerequisites: async ({ env, institution, runId }, use) => {
    const designationName = generateRealisticDesignation(runId);
    const customFieldLabel = generateRealisticCustomField(runId);
    const prerequisites = await provisionEmployeePrerequisitesViaApi(env, institution, {
      designationName,
      customFieldLabel,
      customFieldRequired: true,
    });

    await updateRunManifest(runId, (prev) => ({
      ...prev,
      createdInstitution: {
        id: prerequisites.institution.id,
        name: prerequisites.institution.name,
        tanNumber: prerequisites.institution.tanNumber,
        institutionHead: prerequisites.institution.institutionHead,
        address: prerequisites.institution.address,
        username: prerequisites.institution.username,
      },
      provisionedPrerequisites: {
        institution: {
          id: prerequisites.institution.id,
          name: prerequisites.institution.name,
          tanNumber: prerequisites.institution.tanNumber,
          username: prerequisites.institution.username,
        },
        designation: {
          id: prerequisites.designation.id,
          name: prerequisites.designation.name,
          sortOrder: prerequisites.designation.sortOrder,
        },
        customField: {
          id: prerequisites.customField.id,
          label: prerequisites.customField.label,
          key: prerequisites.customField.key,
          isRequired: prerequisites.customField.isRequired,
          sortOrder: prerequisites.customField.sortOrder,
        },
      },
    }));

    await use(prerequisites);
  },
  provisionedPayrollPrerequisites: async ({ env, institution, runId }, use) => {
    const designationName = generateRealisticDesignation(runId);
    const employeeData = generateIndianEmployee(runId);
    const prerequisites = await provisionPayrollPrerequisitesViaApi(env, institution, {
      designationName,
      employeeData,
    });

    await updateRunManifest(runId, (prev) => ({
      ...prev,
      createdInstitution: {
        id: prerequisites.institution.id,
        name: prerequisites.institution.name,
        tanNumber: prerequisites.institution.tanNumber,
        institutionHead: prerequisites.institution.institutionHead,
        address: prerequisites.institution.address,
        username: prerequisites.institution.username,
      },
      provisionedPrerequisites: {
        institution: {
          id: prerequisites.institution.id,
          name: prerequisites.institution.name,
          tanNumber: prerequisites.institution.tanNumber,
          username: prerequisites.institution.username,
        },
        designation: {
          id: prerequisites.designation.id,
          name: prerequisites.designation.name,
          sortOrder: prerequisites.designation.sortOrder,
        },
      },
      createdEmployee: {
        id: prerequisites.employee.id,
        surname: prerequisites.employee.surname,
        firstName: prerequisites.employee.firstName,
        middleName: prerequisites.employee.middleName,
        displayName: prerequisites.employee.displayName,
        dateOfBirth: prerequisites.employee.dateOfBirth,
        gender: prerequisites.employee.gender,
        designationName: prerequisites.designation.name,
        seniorityRank: prerequisites.employee.seniorityRank,
        panNumber: prerequisites.employee.panNumber,
        contactNumber: prerequisites.employee.contactNumber,
      },
    }));

    await use(prerequisites);
  },
  provisionedReportsPrerequisites: async ({ env, institution, runId }, use) => {
    const designationName = generateRealisticDesignation(runId);
    const employeeData = generateIndianEmployee(runId);
    const prerequisites = await provisionReportsPrerequisitesViaApi(env, institution, {
      designationName,
      employeeData,
    });

    await updateRunManifest(runId, (prev) => ({
      ...prev,
      createdInstitution: {
        id: prerequisites.institution.id,
        name: prerequisites.institution.name,
        tanNumber: prerequisites.institution.tanNumber,
        institutionHead: prerequisites.institution.institutionHead,
        address: prerequisites.institution.address,
        username: prerequisites.institution.username,
      },
      provisionedPrerequisites: {
        institution: {
          id: prerequisites.institution.id,
          name: prerequisites.institution.name,
          tanNumber: prerequisites.institution.tanNumber,
          username: prerequisites.institution.username,
        },
        designation: {
          id: prerequisites.designation.id,
          name: prerequisites.designation.name,
          sortOrder: prerequisites.designation.sortOrder,
        },
      },
      createdEmployee: {
        id: prerequisites.employee.id,
        surname: prerequisites.employee.surname,
        firstName: prerequisites.employee.firstName,
        middleName: prerequisites.employee.middleName,
        displayName: prerequisites.employee.displayName,
        dateOfBirth: prerequisites.employee.dateOfBirth,
        gender: prerequisites.employee.gender,
        designationName: prerequisites.designation.name,
        seniorityRank: prerequisites.employee.seniorityRank,
        panNumber: prerequisites.employee.panNumber,
        contactNumber: prerequisites.employee.contactNumber,
      },
      reportFixture: {
        employeeName: prerequisites.employee.displayName,
        financialYear: prerequisites.payroll.financialYearStart,
        grossSalary: prerequisites.payroll.gross,
        deduction: prerequisites.payroll.deductions,
        netSalary: prerequisites.payroll.net,
      },
    }));

    await use(prerequisites);
  },
  provisionedEmployeeDirectory: async ({ env, institution, runId }, use) => {
    const customFieldLabel = generateRealisticCustomField(runId);
    const directoryData = await provisionEmployeeDirectoryViaApi(env, institution, {
      customFieldLabel,
      employeeCount: 15,
    });

    await updateRunManifest(runId, (prev) => ({
      ...prev,
      createdInstitution: {
        id: directoryData.institution.id,
        name: directoryData.institution.name,
        tanNumber: directoryData.institution.tanNumber,
        institutionHead: directoryData.institution.institutionHead,
        address: directoryData.institution.address,
        username: directoryData.institution.username,
      },
      provisionedPrerequisites: {
        institution: {
          id: directoryData.institution.id,
          name: directoryData.institution.name,
          tanNumber: directoryData.institution.tanNumber,
          username: directoryData.institution.username,
        },
        designation: {
          id: directoryData.designations[0]?.id,
          name: directoryData.designations[0]?.name ?? "",
          sortOrder: directoryData.designations[0]?.sortOrder,
        },
        customField: {
          id: directoryData.customField.id,
          label: directoryData.customField.label,
          key: directoryData.customField.key,
          isRequired: directoryData.customField.isRequired,
          sortOrder: directoryData.customField.sortOrder,
        },
      },
    }));

    await use(directoryData);
  },
  manifest: [
    async ({ env, runId, institution, page }, use, testInfo) => {
      const startedAt = new Date().toISOString();
      const startTime = Date.now();
      const viewport = page.viewportSize() ?? undefined;
      const isMobile = testInfo.project.use.isMobile ?? false;

      const testFilePath = testInfo.file || "";
      const suitePath = testInfo.titlePath.join(" ").toLowerCase();
      const fullPath = `${testFilePath} ${suitePath}`.toLowerCase();
      const matchedFeature = fullPath.includes("employee-setup")
        ? "employee-setup"
        : fullPath.includes("employee")
          ? "employee"
          : fullPath.includes("payroll")
            ? "payroll"
            : fullPath.includes("reports")
              ? "reports"
              : fullPath.includes("institution")
                ? "institution"
                : process.env.E2E_FEATURE && process.env.E2E_FEATURE !== "all"
                  ? process.env.E2E_FEATURE
                  : "unknown";

      const matchedDepth =
        process.env.E2E_DEPTH ||
        (fullPath.includes("regression") ? "regression" : "smoke");

      const manifestData: RunManifest = {
        runId,
        targetUrl: env.baseURL,
        feature: matchedFeature,
        depth: matchedDepth,
        startedAt,
        status: "running",
        generatedCredentials: {
          adminIdentifier: env.adminIdentifier,
          institutionUsername: institution.username,
          institutionPassword: institution.password,
        },
        createdInstitution: {
          name: institution.name,
          tanNumber: institution.tanNumber,
          institutionHead: institution.institutionHead,
          address: institution.address,
          username: institution.username,
        },
        viewport: {
          name: testInfo.project.name,
          width: viewport?.width,
          height: viewport?.height,
          isMobile,
        },
      };

      await writeRunManifest(manifestData);

      try {
        await use(manifestData);
        const durationMs = Date.now() - startTime;
        const status =
          testInfo.status === "passed"
            ? "passed"
            : testInfo.status === "timedOut"
              ? "timedOut"
              : "failed";
        await updateRunManifest(runId, (prev) => ({
          ...prev,
          status,
          completedAt: new Date().toISOString(),
          durationMs,
          error: testInfo.error?.message,
        }));
      } catch (err) {
        const durationMs = Date.now() - startTime;
        await updateRunManifest(runId, (prev) => ({
          ...prev,
          status: "failed",
          completedAt: new Date().toISOString(),
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        }));
        throw err;
      }
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
