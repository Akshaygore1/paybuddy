import { createDb } from "@tds-nivaran/db";
import { executeD1Batch } from "@tds-nivaran/db/d1";
import {
  payrollCustomFieldDefinitions,
  payrollCustomFieldPeriods,
} from "@tds-nivaran/db/schema/index";
import { TRPCError } from "@trpc/server";
import type { BatchItem } from "drizzle-orm/batch";
import { and, asc, desc, eq } from "drizzle-orm";

type Db = ReturnType<typeof createDb>;

export type PayrollSection = "earnings" | "deductions";

export type PayrollCustomField = {
  id: string;
  section: PayrollSection;
  label: string;
  key: string;
  sortOrder: number;
};

export type PayrollCustomFieldPeriod = {
  id: string;
  customFieldDefinitionId: string;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
};

export type PayrollFieldTimeline = {
  fields: PayrollCustomField[];
  periods: PayrollCustomFieldPeriod[];
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildPayrollFieldKeyBase(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "field";
}

function buildUniquePayrollFieldKey(label: string, existingKeys: Iterable<string>) {
  const baseKey = buildPayrollFieldKeyBase(label);
  const unavailableKeys = new Set(existingKeys);
  let key = baseKey;
  let suffix = 2;

  while (unavailableKeys.has(key)) {
    key = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return key;
}

export function buildPayrollFieldTimelineModule(options: { db?: Db } = {}) {
  const db = options.db ?? createDb();

  async function load(institutionId: string): Promise<PayrollFieldTimeline> {
    const [fields, periods] = await Promise.all([
      db
        .select({
          id: payrollCustomFieldDefinitions.id,
          section: payrollCustomFieldDefinitions.section,
          label: payrollCustomFieldDefinitions.label,
          key: payrollCustomFieldDefinitions.key,
          sortOrder: payrollCustomFieldDefinitions.sortOrder,
        })
        .from(payrollCustomFieldDefinitions)
        .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId))
        .orderBy(
          asc(payrollCustomFieldDefinitions.section),
          asc(payrollCustomFieldDefinitions.sortOrder),
          asc(payrollCustomFieldDefinitions.label),
        ),
      db
        .select({
          id: payrollCustomFieldPeriods.id,
          customFieldDefinitionId: payrollCustomFieldPeriods.customFieldDefinitionId,
          effectiveFromMonth: payrollCustomFieldPeriods.effectiveFromMonth,
          effectiveToMonth: payrollCustomFieldPeriods.effectiveToMonth,
        })
        .from(payrollCustomFieldPeriods)
        .innerJoin(
          payrollCustomFieldDefinitions,
          eq(payrollCustomFieldDefinitions.id, payrollCustomFieldPeriods.customFieldDefinitionId),
        )
        .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId))
        .orderBy(asc(payrollCustomFieldPeriods.effectiveFromMonth)),
    ]);

    return { fields, periods };
  }

  function getActivePeriodForMonth(
    timeline: PayrollFieldTimeline,
    customFieldDefinitionId: string,
    month: string,
  ) {
    return (
      timeline.periods.find(
        (period) =>
          period.customFieldDefinitionId === customFieldDefinitionId &&
          period.effectiveFromMonth <= month &&
          (!period.effectiveToMonth || month < period.effectiveToMonth),
      ) ?? null
    );
  }

  function getActiveFieldsForMonth(timeline: PayrollFieldTimeline, month: string) {
    return timeline.fields.filter((field) => getActivePeriodForMonth(timeline, field.id, month));
  }

  function filterSavedLineItems<TLineItem extends { customFieldDefinitionId: string | null }>(
    input: {
      savedLineItems: TLineItem[];
      versionEffectiveMonth: string;
      month: string;
      timeline: PayrollFieldTimeline;
    },
  ) {
    const fieldIdsWithPeriods = new Set(
      input.timeline.periods.map((period) => period.customFieldDefinitionId),
    );

    return input.savedLineItems.filter((item) => {
      if (!item.customFieldDefinitionId) return true;
      if (!fieldIdsWithPeriods.has(item.customFieldDefinitionId)) return true;

      const activePeriod = getActivePeriodForMonth(
        input.timeline,
        item.customFieldDefinitionId,
        input.month,
      );

      return Boolean(activePeriod && input.versionEffectiveMonth >= activePeriod.effectiveFromMonth);
    });
  }

  async function getNextSortOrder(institutionId: string, section: PayrollSection) {
    const current = await db
      .select({ sortOrder: payrollCustomFieldDefinitions.sortOrder })
      .from(payrollCustomFieldDefinitions)
      .where(
        and(
          eq(payrollCustomFieldDefinitions.institutionId, institutionId),
          eq(payrollCustomFieldDefinitions.section, section),
        ),
      )
      .orderBy(desc(payrollCustomFieldDefinitions.sortOrder))
      .get();

    return (current?.sortOrder ?? 0) + 1;
  }

  async function addField(
    institutionId: string,
    input: { section: PayrollSection; label: string; month: string },
  ) {
    const timeline = await load(institutionId);
    const matchingFields = timeline.fields.filter(
      (field) =>
        field.section === input.section && normalizeText(field.label) === normalizeText(input.label),
    );

    if (matchingFields.some((field) => getActivePeriodForMonth(timeline, field.id, input.month))) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A payroll field with this label already exists in this section",
      });
    }

    let field = matchingFields[0];
    const statements: BatchItem<"sqlite">[] = [];

    if (!field) {
      field = {
        id: crypto.randomUUID(),
        section: input.section,
        label: input.label.trim(),
        key: buildUniquePayrollFieldKey(
          input.label,
          timeline.fields.map((existingField) => existingField.key),
        ),
        sortOrder: await getNextSortOrder(institutionId, input.section),
      };
      statements.push(
        db.insert(payrollCustomFieldDefinitions).values({
          ...field,
          institutionId,
        }),
      );
    } else {
      statements.push(
        db
          .update(payrollCustomFieldDefinitions)
          .set({ isActive: true })
          .where(eq(payrollCustomFieldDefinitions.id, field.id)),
      );
    }

    const nextPeriod = timeline.periods
      .filter(
        (period) =>
          period.customFieldDefinitionId === field.id &&
          period.effectiveFromMonth > input.month,
      )
      .sort((left, right) => left.effectiveFromMonth.localeCompare(right.effectiveFromMonth))[0];

    statements.push(
      db.insert(payrollCustomFieldPeriods).values({
        id: crypto.randomUUID(),
        customFieldDefinitionId: field.id,
        effectiveFromMonth: input.month,
        effectiveToMonth: nextPeriod?.effectiveFromMonth ?? null,
      }),
    );
    await executeD1Batch(db, statements);

    return field;
  }

  async function archiveField(institutionId: string, input: { id: string; month: string }) {
    const field = await db
      .select()
      .from(payrollCustomFieldDefinitions)
      .where(
        and(
          eq(payrollCustomFieldDefinitions.id, input.id),
          eq(payrollCustomFieldDefinitions.institutionId, institutionId),
        ),
      )
      .get();

    if (!field) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payroll field was not found",
      });
    }

    const timeline = await load(institutionId);
    const activePeriod = getActivePeriodForMonth(timeline, input.id, input.month);

    if (!activePeriod) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payroll field was not active for this month",
      });
    }

    const archivePeriodStatement =
      activePeriod.effectiveFromMonth === input.month
        ? db
            .delete(payrollCustomFieldPeriods)
            .where(eq(payrollCustomFieldPeriods.id, activePeriod.id))
        : db
            .update(payrollCustomFieldPeriods)
            .set({ effectiveToMonth: input.month })
            .where(eq(payrollCustomFieldPeriods.id, activePeriod.id));
    const hasLaterOpenPeriod = timeline.periods.some(
      (period) =>
        period.id !== activePeriod.id &&
        period.customFieldDefinitionId === input.id &&
        period.effectiveFromMonth > input.month &&
        !period.effectiveToMonth,
    );

    await executeD1Batch(db, [
      archivePeriodStatement,
      db
        .update(payrollCustomFieldDefinitions)
        .set({ isActive: hasLaterOpenPeriod })
        .where(eq(payrollCustomFieldDefinitions.id, input.id)),
    ]);

    return field;
  }

  return {
    load,
    getActivePeriodForMonth,
    getActiveFieldsForMonth,
    filterSavedLineItems,
    addField,
    archiveField,
  };
}

export type PayrollFieldTimelineModule = ReturnType<typeof buildPayrollFieldTimelineModule>;
