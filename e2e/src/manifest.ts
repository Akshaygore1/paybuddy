import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type RunManifest = {
  runId: string;
  targetUrl: string;
  feature: string;
  depth: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  status: "running" | "passed" | "failed" | "timedOut" | "interrupted";
  generatedCredentials: {
    adminIdentifier: string;
    institutionUsername: string;
    institutionPassword: string;
  };
  createdInstitution?: {
    id?: string;
    name: string;
    tanNumber: string;
    institutionHead: string;
    address: string;
    username: string;
  };
  createdDesignation?: {
    id?: string;
    name: string;
  };
  provisionedPrerequisites?: {
    institution?: {
      id?: string;
      name: string;
      tanNumber: string;
      username: string;
    };
    designation?: {
      id?: string;
      name: string;
      sortOrder?: number;
    };
    customField?: {
      id?: string;
      label: string;
      key?: string;
      isRequired?: boolean;
      sortOrder?: number;
    };
  };
  createdEmployee?: {
    id?: string;
    surname: string;
    firstName: string;
    middleName: string;
    displayName: string;
    dateOfBirth: string;
    gender: string;
    designationName: string;
    seniorityRank: number;
    panNumber?: string;
    contactNumber?: string;
    customFields?: Record<string, string>;
  };
  payrollRecord?: {
    employeeName: string;
    financialYear: string;
    month: string;
    basicPay: string;
    deduction: string;
    gross: string;
    deductions: string;
    net: string;
  };
  viewport?: {
    name: string;
    width?: number;
    height?: number;
    isMobile?: boolean;
  };
  error?: string;
};

const MANIFESTS_DIR = resolve(import.meta.dirname, "..", ".manifests");

export function getManifestPath(runId: string): string {
  return resolve(MANIFESTS_DIR, `manifest-${runId}.json`);
}

export async function writeRunManifest(manifest: RunManifest): Promise<string> {
  await mkdir(MANIFESTS_DIR, { recursive: true });
  const filePath = getManifestPath(manifest.runId);
  await writeFile(filePath, JSON.stringify(manifest, null, 2), "utf8");
  return filePath;
}

export async function updateRunManifest(
  runId: string,
  updater: (prev: RunManifest) => RunManifest,
): Promise<void> {
  const filePath = getManifestPath(runId);
  try {
    const content = await readFile(filePath, "utf8");
    const prev = JSON.parse(content) as RunManifest;
    const updated = updater(prev);
    await writeFile(filePath, JSON.stringify(updated, null, 2), "utf8");
  } catch (error) {
    console.warn(`[Manifest] Could not update manifest for ${runId}:`, error);
  }
}
