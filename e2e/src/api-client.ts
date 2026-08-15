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
