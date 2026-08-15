import { createAuth } from "@tds-nivaran/auth";
import { createDb } from "@tds-nivaran/db";
import {
  employeeCustomFieldDefinitions,
  employeeCustomFieldValues,
  employeeDesignations,
  employeePayrollProfiles,
  employeePayrollVersions,
  employees,
  institutions,
  payrollCustomFieldDefinitions,
  payrollCustomFieldPeriods,
  payrollLineItems,
  user,
} from "@tds-nivaran/db/schema/index";
import { eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

const E2E_BULK_MARKER = "run-";
const MAX_DELETE_BATCH_SIZE = 90;

const resetTenantSchema = z.object({
  institutionId: z.string().trim().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(8),
});

const cleanupSchema = z.object({
  mode: z.enum(["dry-run", "delete", "delete-run"]),
  marker: z.string().trim().min(1).max(80),
  expectedCount: z.number().int().nonnegative().optional(),
  institutionIds: z.array(z.string().min(1)).max(1_000).optional(),
  reportHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});

type Db = ReturnType<typeof createDb>;
type Auth = ReturnType<typeof createAuth>;

type CandidateInstitution = {
  institutionId: string;
  userId: string;
  name: string;
  tanNumber: string;
  username: string | null;
};

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

function normalizeMarker(marker: string): string {
  const normalized = marker.toLowerCase();
  if (!/^run(?:-[a-z0-9]+)*-?$/.test(normalized)) {
    throw new Error(
      `Invalid E2E marker "${marker}". Markers must start with run- and contain only lowercase letters, numbers, and hyphens.`,
    );
  }

  return normalized;
}

function cleanMarker(marker: string): string {
  return marker.replace(/[^a-z0-9]/g, "");
}

function isGeneratedInstitution(candidate: CandidateInstitution, marker: string): boolean {
  const normalizedName = candidate.name.toLowerCase();
  const normalizedUsername = candidate.username?.toLowerCase() ?? "";
  return (
    normalizedName.includes(`[${marker}`) &&
    normalizedUsername.startsWith(`inst_${cleanMarker(marker)}`)
  );
}

async function getGeneratedInstitutions(db: Db, marker: string): Promise<CandidateInstitution[]> {
  const candidates = await db
    .select({
      institutionId: institutions.id,
      userId: institutions.userId,
      name: institutions.name,
      tanNumber: institutions.tanNumber,
      username: user.username,
    })
    .from(institutions)
    .innerJoin(user, eq(user.id, institutions.userId));

  return candidates
    .filter((candidate) => isGeneratedInstitution(candidate, marker))
    .sort((left, right) => left.institutionId.localeCompare(right.institutionId));
}

async function buildCleanupReport(db: Db, marker: string): Promise<E2ECleanupReport> {
  const candidates = await getGeneratedInstitutions(db, marker);
  const records = candidates.map((candidate) => ({
    institutionId: candidate.institutionId,
    userId: candidate.userId,
    name: candidate.name,
    tanNumber: candidate.tanNumber,
    username: candidate.username ?? "",
  }));
  const canonical = records
    .map((record) =>
      [record.institutionId, record.userId, record.name, record.tanNumber, record.username].join(
        "\u001f",
      ),
    )
    .join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const reportHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return {
    marker,
    matchedCount: records.length,
    reportHash,
    records,
  };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function deleteUsers(db: Db, userIds: string[]): Promise<void> {
  for (const batch of chunks(userIds, MAX_DELETE_BATCH_SIZE)) {
    await db.delete(user).where(inArray(user.id, batch));
  }
}

async function clearInstitutionChildData(db: Db, institutionId: string): Promise<void> {
  const payrollProfileIds = db
    .select({ id: employeePayrollProfiles.id })
    .from(employeePayrollProfiles)
    .where(eq(employeePayrollProfiles.institutionId, institutionId));
  const payrollVersionIds = db
    .select({ id: employeePayrollVersions.id })
    .from(employeePayrollVersions)
    .where(inArray(employeePayrollVersions.payrollProfileId, payrollProfileIds));
  const payrollCustomFieldIds = db
    .select({ id: payrollCustomFieldDefinitions.id })
    .from(payrollCustomFieldDefinitions)
    .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId));
  const employeeIds = db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.institutionId, institutionId));
  const employeeCustomFieldIds = db
    .select({ id: employeeCustomFieldDefinitions.id })
    .from(employeeCustomFieldDefinitions)
    .where(eq(employeeCustomFieldDefinitions.institutionId, institutionId));

  // Delete the most dependent records first. This also handles the payroll
  // custom-field foreign key that intentionally uses ON DELETE RESTRICT.
  await db
    .delete(payrollLineItems)
    .where(inArray(payrollLineItems.payrollVersionId, payrollVersionIds));
  await db
    .delete(employeePayrollVersions)
    .where(inArray(employeePayrollVersions.payrollProfileId, payrollProfileIds));
  await db
    .delete(employeePayrollProfiles)
    .where(eq(employeePayrollProfiles.institutionId, institutionId));
  await db
    .delete(payrollCustomFieldPeriods)
    .where(inArray(payrollCustomFieldPeriods.customFieldDefinitionId, payrollCustomFieldIds));
  await db
    .delete(payrollCustomFieldDefinitions)
    .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId));
  await db
    .delete(employeeCustomFieldValues)
    .where(
      or(
        inArray(employeeCustomFieldValues.employeeId, employeeIds),
        inArray(employeeCustomFieldValues.fieldDefinitionId, employeeCustomFieldIds),
      ),
    );
  await db.delete(employees).where(eq(employees.institutionId, institutionId));
  await db
    .delete(employeeCustomFieldDefinitions)
    .where(eq(employeeCustomFieldDefinitions.institutionId, institutionId));
  await db
    .delete(employeeDesignations)
    .where(eq(employeeDesignations.institutionId, institutionId));
}

export async function resetE2ETenant(
  db: Db,
  auth: Auth,
  headers: Headers,
  input: z.infer<typeof resetTenantSchema>,
) {
  const target = await db
    .select({
      institutionId: institutions.id,
      userId: institutions.userId,
      name: institutions.name,
      tanNumber: institutions.tanNumber,
      institutionHead: institutions.institutionHead,
      address: institutions.address,
      username: user.username,
      role: user.role,
    })
    .from(institutions)
    .innerJoin(user, eq(user.id, institutions.userId))
    .where(eq(institutions.id, input.institutionId))
    .get();

  if (!target) {
    throw new Error("Configured E2E institution was not found.");
  }
  if (target.role !== "user" || target.username !== input.username) {
    throw new Error(
      "Configured E2E institution ID and username do not identify the same institution user.",
    );
  }

  await clearInstitutionChildData(db, target.institutionId);
  await auth.api.setUserPassword({
    headers,
    body: {
      userId: target.userId,
      newPassword: input.password,
    },
  });
  await db
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null })
    .where(eq(user.id, target.userId));

  return {
    id: target.institutionId,
    userId: target.userId,
    name: target.name,
    tanNumber: target.tanNumber,
    institutionHead: target.institutionHead,
    address: target.address,
    username: target.username,
    loginActive: true,
  };
}

export async function cleanupE2EInstitutions(
  db: Db,
  input: z.infer<typeof cleanupSchema>,
): Promise<E2ECleanupReport & { deletedCount?: number }> {
  const marker = normalizeMarker(input.marker);
  const report = await buildCleanupReport(db, marker);

  if (input.mode === "dry-run") {
    return report;
  }

  if (input.mode === "delete-run") {
    if (marker === E2E_BULK_MARKER) {
      throw new Error("Run teardown cannot use the bulk cleanup marker.");
    }
    await deleteUsers(
      db,
      report.records.map((record) => record.userId),
    );
    return { ...report, deletedCount: report.records.length };
  }

  if (marker !== E2E_BULK_MARKER) {
    throw new Error("Bulk cleanup requires the exact run- marker.");
  }
  if (input.expectedCount !== undefined && report.matchedCount !== input.expectedCount) {
    throw new Error(
      `Bulk cleanup aborted: expected ${input.expectedCount} generated institutions, found ${report.matchedCount}.`,
    );
  }

  const expectedIds = [...(input.institutionIds ?? [])].sort();
  const actualIds = report.records.map((record) => record.institutionId).sort();
  if (
    expectedIds.length !== actualIds.length ||
    expectedIds.some((institutionId, index) => institutionId !== actualIds[index])
  ) {
    throw new Error(
      "Bulk cleanup aborted: the current marker-filtered institution IDs differ from the dry-run report.",
    );
  }
  if (!input.reportHash || input.reportHash !== report.reportHash) {
    throw new Error(
      "Bulk cleanup aborted: the current marker-filtered list differs from the dry-run report hash.",
    );
  }

  await deleteUsers(
    db,
    report.records.map((record) => record.userId),
  );
  return { ...report, deletedCount: report.records.length };
}

export { cleanupSchema, resetTenantSchema };
