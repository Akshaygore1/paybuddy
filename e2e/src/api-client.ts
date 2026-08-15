import {
  generateIndianEmployee,
  generateIndianEmployeeCatalog,
  type IndianEmployeeCatalogItem,
  type IndianEmployeeSeed,
} from "./data/indian-employees";
import type { IndianInstitutionSeed } from "./data/indian-institutions";
import type { TestEnv } from "./env";

export type ProvisionedInstitution = IndianInstitutionSeed & {
  id: string;
  userId?: string;
};

type TrpcResponse<T> = {
  result?: {
    data?: T | { json?: T };
  };
  error?: {
    message?: string;
  };
};

function unwrapTrpcData<T>(response: TrpcResponse<T>): T | undefined {
  const data = response.result?.data;
  if (data && typeof data === "object" && "json" in data) {
    return data.json;
  }
  return data as T | undefined;
}

export async function authenticateAdminViaApi(env: TestEnv): Promise<{ cookieHeader: string }> {
  const origin = env.baseURL;
  const isEmail = env.adminIdentifier.includes("@");
  const authPath = isEmail ? "/api/auth/sign-in/email" : "/api/auth/sign-in/username";
  const body = isEmail
    ? { email: env.adminIdentifier, password: env.adminPassword }
    : { username: env.adminIdentifier, password: env.adminPassword };

  const serverURL = env.serverURL;
  const response = await fetch(`${serverURL}${authPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to authenticate admin via API (${response.status}): ${errorText}`);
  }

  let cookieHeader = "";
  if (typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie();
    cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  } else {
    const raw = response.headers.get("set-cookie");
    if (raw) {
      cookieHeader = raw.split(";")[0] ?? "";
    }
  }

  if (!cookieHeader) {
    throw new Error("Admin authentication succeeded but no session cookie was returned.");
  }

  return { cookieHeader };
}

export async function createInstitutionViaApi(
  env: TestEnv,
  cookieHeader: string,
  institutionData: IndianInstitutionSeed,
): Promise<ProvisionedInstitution> {
  const origin = env.baseURL;
  const serverURL = env.serverURL;

  const response = await fetch(`${serverURL}/trpc/institutions.create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: origin,
    },
    body: JSON.stringify({
      name: institutionData.name,
      tanNumber: institutionData.tanNumber,
      institutionHead: institutionData.institutionHead,
      address: institutionData.address,
      username: institutionData.username,
      password: institutionData.password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to create institution via tRPC API (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as {
    result?: {
      data?: {
        id: string;
        userId?: string;
        name: string;
        tanNumber: string;
        institutionHead: string;
        address: string;
      };
    };
    error?: {
      message?: string;
    };
  };

  if (!json.result?.data?.id) {
    throw new Error(
      `tRPC institutions.create did not return institution data: ${json.error?.message || JSON.stringify(json)}`,
    );
  }

  return {
    ...institutionData,
    id: json.result.data.id,
    userId: json.result.data.userId,
  };
}

export async function provisionInstitutionViaApi(
  env: TestEnv,
  institutionData: IndianInstitutionSeed,
): Promise<ProvisionedInstitution> {
  const { cookieHeader } = await authenticateAdminViaApi(env);
  return createInstitutionViaApi(env, cookieHeader, institutionData);
}

export async function getConfiguredInstitutionViaApi(
  env: TestEnv,
  cookieHeader: string,
): Promise<ProvisionedInstitution> {
  const response = await fetch(`${env.serverURL}/trpc/institutions.list`, {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
      Origin: env.baseURL,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to list institutions while validating the shared E2E tenant (${response.status}): ${errorText}`,
    );
  }

  const json = (await response.json()) as TrpcResponse<
    Array<{
      id: string;
      userId: string;
      name: string;
      tanNumber: string;
      institutionHead: string;
      address: string;
      username: string | null;
    }>
  >;
  const institutions = unwrapTrpcData(json);
  const configured = institutions?.find((candidate) => candidate.id === env.institutionId);

  if (!configured) {
    throw new Error(
      `E2E_INSTITUTION_ID "${env.institutionId}" was not found in the institution directory.`,
    );
  }
  if (configured.username !== env.institutionUsername) {
    throw new Error(
      `E2E_INSTITUTION_ID "${env.institutionId}" belongs to username "${configured.username ?? "<none>"}", not E2E_INSTITUTION_USERNAME.`,
    );
  }

  return {
    id: configured.id,
    userId: configured.userId,
    name: configured.name,
    tanNumber: configured.tanNumber,
    institutionHead: configured.institutionHead,
    address: configured.address,
    username: configured.username,
    password: env.institutionPassword,
  };
}

async function postE2EOperation<T>(
  env: TestEnv,
  cookieHeader: string,
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${env.serverURL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: env.baseURL,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`E2E operation ${path} failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
}

export async function resetE2ETenantViaApi(
  env: TestEnv,
  institution: ProvisionedInstitution,
): Promise<void> {
  const { cookieHeader } = await authenticateAdminViaApi(env);
  await postE2EOperation(env, cookieHeader, "/api/e2e/tenant/reset", {
    institutionId: institution.id,
    username: env.institutionUsername,
    password: env.institutionPassword,
  });
}

export async function cleanupE2ERunInstitutionsViaApi(
  env: TestEnv,
  runId: string,
): Promise<{ deletedCount: number }> {
  const { cookieHeader } = await authenticateAdminViaApi(env);
  return postE2EOperation<{ deletedCount: number }>(
    env,
    cookieHeader,
    "/api/e2e/institutions/cleanup",
    {
      mode: "delete-run",
      marker: runId,
    },
  );
}

export type E2ECleanupReport = {
  marker: string;
  matchedCount: number;
  reportHash: string;
  records: Array<{
    institutionId: string;
    userId: string;
    name: string;
    tanNumber: string;
    username: string;
  }>;
};

export async function dryRunE2EInstitutionCleanupViaApi(
  env: TestEnv,
  marker = "run-",
): Promise<E2ECleanupReport> {
  const { cookieHeader } = await authenticateAdminViaApi(env);
  return postE2EOperation<E2ECleanupReport>(env, cookieHeader, "/api/e2e/institutions/cleanup", {
    mode: "dry-run",
    marker,
  });
}

export async function executeE2EInstitutionCleanupViaApi(
  env: TestEnv,
  report: E2ECleanupReport,
  expectedCount?: number,
): Promise<E2ECleanupReport & { deletedCount: number }> {
  const { cookieHeader } = await authenticateAdminViaApi(env);
  const body = {
    mode: "delete" as const,
    marker: report.marker,
    institutionIds: report.records.map((record) => record.institutionId),
    reportHash: report.reportHash,
    ...(expectedCount === undefined ? {} : { expectedCount }),
  };
  return postE2EOperation<E2ECleanupReport & { deletedCount: number }>(
    env,
    cookieHeader,
    "/api/e2e/institutions/cleanup",
    body,
  );
}

export async function authenticateInstitutionViaApi(
  env: TestEnv,
  credentials: { username: string; password: string },
): Promise<{ cookieHeader: string }> {
  const origin = env.baseURL;
  const isEmail = credentials.username.includes("@");
  const authPath = isEmail ? "/api/auth/sign-in/email" : "/api/auth/sign-in/username";
  const body = isEmail
    ? { email: credentials.username, password: credentials.password }
    : { username: credentials.username, password: credentials.password };

  const serverURL = env.serverURL;
  const response = await fetch(`${serverURL}${authPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to authenticate institution via API (${response.status}): ${errorText}`,
    );
  }

  let cookieHeader = "";
  if (typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie();
    cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  } else {
    const raw = response.headers.get("set-cookie");
    if (raw) {
      cookieHeader = raw.split(";")[0] ?? "";
    }
  }

  if (!cookieHeader) {
    throw new Error("Institution authentication succeeded but no session cookie was returned.");
  }

  return { cookieHeader };
}

export type ProvisionedDesignation = {
  id: string;
  name: string;
  sortOrder: number;
};

export async function createDesignationViaApi(
  env: TestEnv,
  cookieHeader: string,
  name: string,
): Promise<ProvisionedDesignation> {
  const origin = env.baseURL;
  const serverURL = env.serverURL;

  const response = await fetch(`${serverURL}/trpc/employeeSettings.createDesignation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: origin,
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to create designation via tRPC API (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as {
    result?: {
      data?: {
        id: string;
        name: string;
        sortOrder: number;
      };
    };
    error?: {
      message?: string;
    };
  };

  if (!json.result?.data?.id) {
    throw new Error(
      `tRPC employeeSettings.createDesignation did not return designation data: ${json.error?.message || JSON.stringify(json)}`,
    );
  }

  return {
    id: json.result.data.id,
    name: json.result.data.name,
    sortOrder: json.result.data.sortOrder,
  };
}

export type ProvisionedCustomField = {
  id: string;
  label: string;
  key: string;
  isRequired: boolean;
  sortOrder: number;
};

export async function createCustomFieldViaApi(
  env: TestEnv,
  cookieHeader: string,
  data: { label: string; isRequired?: boolean },
): Promise<ProvisionedCustomField> {
  const origin = env.baseURL;
  const serverURL = env.serverURL;

  const response = await fetch(`${serverURL}/trpc/employeeSettings.addCustomField`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: origin,
    },
    body: JSON.stringify({
      label: data.label,
      isRequired: data.isRequired ?? false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to add custom field via tRPC API (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as {
    result?: {
      data?: {
        id: string;
        label: string;
        key: string;
        isRequired: boolean;
        sortOrder: number;
      };
    };
    error?: {
      message?: string;
    };
  };

  if (!json.result?.data?.id) {
    throw new Error(
      `tRPC employeeSettings.addCustomField did not return custom field data: ${json.error?.message || JSON.stringify(json)}`,
    );
  }

  return {
    id: json.result.data.id,
    label: json.result.data.label,
    key: json.result.data.key,
    isRequired: json.result.data.isRequired,
    sortOrder: json.result.data.sortOrder,
  };
}

export type ProvisionedEmployeePrerequisites = {
  institution: ProvisionedInstitution;
  designation: ProvisionedDesignation;
  customField: ProvisionedCustomField;
};

export async function provisionEmployeePrerequisitesViaApi(
  env: TestEnv,
  institutionData: IndianInstitutionSeed,
  options?: {
    designationName?: string;
    customFieldLabel?: string;
    customFieldRequired?: boolean;
  },
): Promise<ProvisionedEmployeePrerequisites> {
  const institution = await provisionInstitutionViaApi(env, institutionData);
  return prepareEmployeePrerequisitesViaApi(env, institution, options);
}

export async function prepareEmployeePrerequisitesViaApi(
  env: TestEnv,
  institution: ProvisionedInstitution,
  options?: {
    designationName?: string;
    customFieldLabel?: string;
    customFieldRequired?: boolean;
  },
): Promise<ProvisionedEmployeePrerequisites> {
  const { cookieHeader } = await authenticateInstitutionViaApi(env, {
    username: institution.username,
    password: institution.password,
  });

  const designationName = options?.designationName ?? `Senior Teacher [${institution.tanNumber}]`;
  const customFieldLabel = options?.customFieldLabel ?? `Staff ID [${institution.tanNumber}]`;

  const designation = await createDesignationViaApi(env, cookieHeader, designationName);
  const customField = await createCustomFieldViaApi(env, cookieHeader, {
    label: customFieldLabel,
    isRequired: options?.customFieldRequired ?? true,
  });

  return {
    institution,
    designation,
    customField,
  };
}

export type ProvisionedEmployee = IndianEmployeeSeed & {
  id: string;
  designationId: string;
  pfNumber?: string;
  npsAccountNumber?: string;
  whatsAppNumber?: string;
};

export async function createEmployeeViaApi(
  env: TestEnv,
  cookieHeader: string,
  data: {
    firstName: string;
    middleName: string;
    surname: string;
    dateOfBirth: string;
    gender: "Male" | "Female";
    designationId: string;
    seniorityRank: number;
    panNumber?: string;
    pfNumber?: string;
    npsAccountNumber?: string;
    whatsAppNumber?: string;
    contactNumber?: string;
    customFieldValues?: Record<string, string>;
  },
): Promise<ProvisionedEmployee> {
  const origin = env.baseURL;
  const serverURL = env.serverURL;

  const response = await fetch(`${serverURL}/trpc/employees.create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: origin,
    },
    body: JSON.stringify({
      firstName: data.firstName,
      middleName: data.middleName,
      surname: data.surname,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      designationId: data.designationId,
      seniorityRank: data.seniorityRank,
      panNumber: data.panNumber ?? "",
      pfNumber: data.pfNumber ?? "",
      npsAccountNumber: data.npsAccountNumber ?? "",
      whatsAppNumber: data.whatsAppNumber ?? "",
      contactNumber: data.contactNumber ?? "",
      customFieldValues: data.customFieldValues ?? {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to create employee via tRPC API (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as {
    result?: {
      data?: {
        id: string;
        firstName: string;
        middleName: string;
        surname: string;
        dateOfBirth: string;
        gender: "Male" | "Female";
        designationId: string;
        seniorityRank: number;
        panNumber: string | null;
        pfNumber: string | null;
        npsAccountNumber: string | null;
        whatsAppNumber: string | null;
        contactNumber: string | null;
      };
    };
    error?: {
      message?: string;
    };
  };

  if (!json.result?.data?.id) {
    throw new Error(
      `tRPC employees.create did not return employee data: ${json.error?.message || JSON.stringify(json)}`,
    );
  }

  const res = json.result.data;
  const displayName = `${res.surname}, ${res.firstName} ${res.middleName}`.trim();

  return {
    id: res.id,
    firstName: res.firstName,
    middleName: res.middleName,
    surname: res.surname,
    displayName,
    dateOfBirth: res.dateOfBirth,
    gender: res.gender,
    designationId: res.designationId,
    seniorityRank: res.seniorityRank,
    panNumber: res.panNumber ?? data.panNumber ?? "",
    pfNumber: res.pfNumber ?? data.pfNumber ?? "",
    npsAccountNumber: res.npsAccountNumber ?? data.npsAccountNumber ?? "",
    whatsAppNumber: res.whatsAppNumber ?? data.whatsAppNumber ?? "",
    contactNumber: res.contactNumber ?? data.contactNumber ?? "",
    customFieldValue: data.customFieldValues
      ? (Object.values(data.customFieldValues)[0] ?? "")
      : "",
  };
}

export type ProvisionedEmployeeDirectory = {
  institution: ProvisionedInstitution;
  cookieHeader: string;
  designations: ProvisionedDesignation[];
  customField: ProvisionedCustomField;
  catalog: IndianEmployeeCatalogItem[];
  employees: ProvisionedEmployee[];
};

export async function provisionEmployeeDirectoryViaApi(
  env: TestEnv,
  institutionData: IndianInstitutionSeed,
  options?: {
    employeeCount?: number;
    designationNames?: string[];
    customFieldLabel?: string;
    customFieldRequired?: boolean;
  },
): Promise<ProvisionedEmployeeDirectory> {
  const institution = await provisionInstitutionViaApi(env, institutionData);
  return prepareEmployeeDirectoryViaApi(env, institution, options);
}

export async function prepareEmployeeDirectoryViaApi(
  env: TestEnv,
  institution: ProvisionedInstitution,
  options?: {
    employeeCount?: number;
    designationNames?: string[];
    customFieldLabel?: string;
    customFieldRequired?: boolean;
  },
): Promise<ProvisionedEmployeeDirectory> {
  const { cookieHeader } = await authenticateInstitutionViaApi(env, {
    username: institution.username,
    password: institution.password,
  });

  const desigNames = options?.designationNames ?? [
    `Principal [${institution.tanNumber}]`,
    `Senior Teacher [${institution.tanNumber}]`,
    `Junior Teacher [${institution.tanNumber}]`,
  ];

  const designations: ProvisionedDesignation[] = [];
  for (const name of desigNames) {
    const desig = await createDesignationViaApi(env, cookieHeader, name);
    designations.push(desig);
  }

  const customFieldLabel = options?.customFieldLabel ?? `Staff ID [${institution.tanNumber}]`;
  const customField = await createCustomFieldViaApi(env, cookieHeader, {
    label: customFieldLabel,
    isRequired: options?.customFieldRequired ?? false,
  });

  const employeeCount = options?.employeeCount ?? 15;
  const catalog = generateIndianEmployeeCatalog(employeeCount, institution.tanNumber);

  const employees: ProvisionedEmployee[] = [];
  for (const item of catalog) {
    const desig = designations[item.designationIndex % designations.length]!;
    const employee = await createEmployeeViaApi(env, cookieHeader, {
      firstName: item.firstName,
      middleName: item.middleName,
      surname: item.surname,
      dateOfBirth: item.dateOfBirth,
      gender: item.gender,
      designationId: desig.id,
      seniorityRank: item.seniorityRank,
      panNumber: item.panNumber,
      pfNumber: item.pfNumber,
      npsAccountNumber: item.npsAccountNumber,
      whatsAppNumber: item.whatsAppNumber,
      contactNumber: item.contactNumber,
      customFieldValues: {
        [customField.id]: item.customFieldValue,
      },
    });
    employees.push(employee);
  }

  return {
    institution,
    cookieHeader,
    designations,
    customField,
    catalog,
    employees,
  };
}

export type ProvisionedPayrollPrerequisites = {
  institution: ProvisionedInstitution;
  designation: ProvisionedDesignation;
  employee: ProvisionedEmployee;
};

export async function provisionPayrollPrerequisitesViaApi(
  env: TestEnv,
  institutionData: IndianInstitutionSeed,
  options?: {
    designationName?: string;
    employeeData?: IndianEmployeeSeed;
  },
): Promise<ProvisionedPayrollPrerequisites> {
  const institution = await provisionInstitutionViaApi(env, institutionData);
  return preparePayrollPrerequisitesViaApi(env, institution, options);
}

export async function preparePayrollPrerequisitesViaApi(
  env: TestEnv,
  institution: ProvisionedInstitution,
  options?: {
    designationName?: string;
    employeeData?: IndianEmployeeSeed;
  },
): Promise<ProvisionedPayrollPrerequisites> {
  const { cookieHeader } = await authenticateInstitutionViaApi(env, {
    username: institution.username,
    password: institution.password,
  });

  const designationName = options?.designationName ?? `Senior Teacher [${institution.tanNumber}]`;
  const designation = await createDesignationViaApi(env, cookieHeader, designationName);

  const employeeData = options?.employeeData ?? generateIndianEmployee(institution.tanNumber);
  const employee = await createEmployeeViaApi(env, cookieHeader, {
    ...employeeData,
    designationId: designation.id,
  });

  return {
    institution,
    designation,
    employee,
  };
}

export async function savePayrollViaApi(
  env: TestEnv,
  cookieHeader: string,
  data: {
    employeeId: string;
    financialYearStart: number;
    month: string;
    lineItems: Array<{
      section: "earnings" | "deductions";
      fixedFieldKey?: string | null;
      customFieldDefinitionId?: string | null;
      amount: string;
    }>;
  },
): Promise<unknown> {
  const origin = env.baseURL;
  const serverURL = env.serverURL;

  const response = await fetch(`${serverURL}/trpc/payroll.save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: origin,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to save payroll via tRPC API (${response.status}): ${errorText}`);
  }

  return response.json();
}

export type ProvisionedReportsPrerequisites = {
  institution: ProvisionedInstitution;
  designation: ProvisionedDesignation;
  employee: ProvisionedEmployee;
  payroll: {
    financialYearStart: number;
    month: string;
    basicPay: string;
    deduction: string;
    gross: string;
    deductions: string;
    net: string;
  };
};

export async function provisionReportsPrerequisitesViaApi(
  env: TestEnv,
  institutionData: IndianInstitutionSeed,
  options?: {
    designationName?: string;
    employeeData?: IndianEmployeeSeed;
    financialYearStart?: number;
    month?: string;
    basicPay?: string;
    deduction?: string;
  },
): Promise<ProvisionedReportsPrerequisites> {
  const institution = await provisionInstitutionViaApi(env, institutionData);
  return prepareReportsPrerequisitesViaApi(env, institution, options);
}

export async function prepareReportsPrerequisitesViaApi(
  env: TestEnv,
  institution: ProvisionedInstitution,
  options?: {
    designationName?: string;
    employeeData?: IndianEmployeeSeed;
    financialYearStart?: number;
    month?: string;
    basicPay?: string;
    deduction?: string;
  },
): Promise<ProvisionedReportsPrerequisites> {
  const { cookieHeader } = await authenticateInstitutionViaApi(env, {
    username: institution.username,
    password: institution.password,
  });

  const designationName = options?.designationName ?? `Senior Teacher [${institution.tanNumber}]`;
  const designation = await createDesignationViaApi(env, cookieHeader, designationName);

  const employeeData = options?.employeeData ?? generateIndianEmployee(institution.tanNumber);
  const employee = await createEmployeeViaApi(env, cookieHeader, {
    ...employeeData,
    designationId: designation.id,
  });

  const financialYearStart = options?.financialYearStart ?? 2026;
  const month = options?.month ?? `${financialYearStart}-04`;
  const basicPay = options?.basicPay ?? "45000";
  const deduction = options?.deduction ?? "200";

  await savePayrollViaApi(env, cookieHeader, {
    employeeId: employee.id,
    financialYearStart,
    month,
    lineItems: [
      {
        section: "earnings",
        fixedFieldKey: "basicPay",
        amount: basicPay,
      },
      {
        section: "deductions",
        fixedFieldKey: "professionalTax",
        amount: deduction,
      },
    ],
  });

  const basicPayNum = parseFloat(basicPay) || 0;
  const deductionNum = parseFloat(deduction) || 0;
  const annualGross = basicPayNum * 12;
  const annualDeduction = deductionNum * 12;
  const annualNet = annualGross - annualDeduction;

  const grossFormatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(annualGross);

  const deductionFormatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(annualDeduction);

  const netFormatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(annualNet);

  return {
    institution,
    designation,
    employee,
    payroll: {
      financialYearStart,
      month,
      basicPay,
      deduction,
      gross: grossFormatted,
      deductions: deductionFormatted,
      net: netFormatted,
    },
  };
}
