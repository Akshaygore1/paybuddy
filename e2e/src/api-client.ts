import { generateIndianEmployee, type IndianEmployeeSeed } from "./data/indian-employees";
import type { IndianInstitutionSeed } from "./data/indian-institutions";
import type { TestEnv } from "./env";

export type ProvisionedInstitution = IndianInstitutionSeed & {
  id: string;
  userId?: string;
};

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
    throw new Error(
      `Failed to create designation via tRPC API (${response.status}): ${errorText}`,
    );
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
    throw new Error(
      `Failed to add custom field via tRPC API (${response.status}): ${errorText}`,
    );
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
    panNumber: res.panNumber ?? "",
    contactNumber: res.contactNumber ?? "",
    customFieldValue: data.customFieldValues ? Object.values(data.customFieldValues)[0] ?? "" : "",
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

