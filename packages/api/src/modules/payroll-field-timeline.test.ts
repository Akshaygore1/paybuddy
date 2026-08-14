import * as schema from "@tds-nivaran/db/schema/index";
import { TRPCError } from "@trpc/server";
import { drizzle } from "drizzle-orm/d1";
import { afterEach, describe, expect, it } from "vitest";

import { createSqliteD1 } from "./d1-test-utils";
import { buildPayrollFieldTimelineModule } from "./payroll-field-timeline";

describe("Payroll field timeline", () => {
  const openDatabases: Array<{ close: () => void }> = [];

  afterEach(() => {
    for (const database of openDatabases.splice(0)) {
      database.close();
    }
  });

  async function createTimeline(seedSql = "") {
    const sqlite = await createSqliteD1();
    openDatabases.push(sqlite);
    await sqlite.executeMultiple(`
      create table payroll_custom_field_definitions (
        id text primary key, institution_id text not null, section text not null,
        label text not null, key text not null, is_active integer default 1 not null,
        sort_order integer not null, created_at integer default 0 not null,
        updated_at integer default 0 not null
      );
      create table payroll_custom_field_periods (
        id text primary key, custom_field_definition_id text not null,
        effective_from_month text not null, effective_to_month text,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      ${seedSql}
    `);
    const db = drizzle(sqlite.client, { schema });

    return {
      sqlite,
      timeline: buildPayrollFieldTimelineModule({ db: db as never }),
    };
  }

  it("uses inclusive start and exclusive end months across gaps and reopenings", async () => {
    const { timeline } = await createTimeline(`
      insert into payroll_custom_field_definitions values
        ('allowance', 'institution-1', 'earnings', 'Allowance', 'allowance', 1, 1, 0, 0);
      insert into payroll_custom_field_periods values
        ('period-april', 'allowance', '2026-04', '2026-09', 0, 0),
        ('period-december', 'allowance', '2026-12', null, 0, 0);
    `);
    const loaded = await timeline.load("institution-1");

    expect(timeline.getActiveFieldsForMonth(loaded, "2026-04").map((field) => field.id)).toEqual([
      "allowance",
    ]);
    expect(timeline.getActiveFieldsForMonth(loaded, "2026-09")).toEqual([]);
    expect(timeline.getActiveFieldsForMonth(loaded, "2026-11")).toEqual([]);
    expect(timeline.getActiveFieldsForMonth(loaded, "2026-12").map((field) => field.id)).toEqual([
      "allowance",
    ]);
    expect(timeline.getActiveFieldsForMonth(loaded, "2027-03").map((field) => field.id)).toEqual([
      "allowance",
    ]);
    expect(
      timeline.filterSavedLineItems({
        savedLineItems: [{ customFieldDefinitionId: "allowance", amountPaise: 5_000 }],
        versionEffectiveMonth: "2026-04",
        month: "2026-12",
        timeline: loaded,
      }),
    ).toEqual([]);
  });

  it("removes a period when archived in its start month", async () => {
    const { sqlite, timeline } = await createTimeline(`
      insert into payroll_custom_field_definitions values
        ('allowance', 'institution-1', 'earnings', 'Allowance', 'allowance', 1, 1, 0, 0);
      insert into payroll_custom_field_periods values
        ('period-june', 'allowance', '2026-06', null, 0, 0);
    `);

    await timeline.archiveField("institution-1", { id: "allowance", month: "2026-06" });

    expect((await sqlite.execute("select * from payroll_custom_field_periods")).rows).toEqual([]);
    expect(
      (await sqlite.execute("select is_active from payroll_custom_field_definitions")).rows,
    ).toEqual([{ is_active: 0 }]);
  });

  it("closes a period when archived after its start month", async () => {
    const { sqlite, timeline } = await createTimeline(`
      insert into payroll_custom_field_definitions values
        ('allowance', 'institution-1', 'earnings', 'Allowance', 'allowance', 1, 1, 0, 0);
      insert into payroll_custom_field_periods values
        ('period-june', 'allowance', '2026-06', null, 0, 0);
    `);

    await timeline.archiveField("institution-1", { id: "allowance", month: "2026-09" });

    expect(
      (await sqlite.execute("select effective_to_month from payroll_custom_field_periods")).rows,
    ).toEqual([{ effective_to_month: "2026-09" }]);
  });

  it("reopens an archived field with a new effective period", async () => {
    const { timeline } = await createTimeline(`
      insert into payroll_custom_field_definitions values
        ('allowance', 'institution-1', 'earnings', 'Allowance', 'allowance', 0, 1, 0, 0);
      insert into payroll_custom_field_periods values
        ('period-april', 'allowance', '2026-04', '2026-09', 0, 0);
    `);

    const field = await timeline.addField("institution-1", {
      section: "earnings",
      label: " allowance ",
      month: "2026-12",
    });
    const loaded = await timeline.load("institution-1");

    expect(field.id).toBe("allowance");
    expect(loaded.periods).toEqual([
      expect.objectContaining({ effectiveFromMonth: "2026-04", effectiveToMonth: "2026-09" }),
      expect.objectContaining({ effectiveFromMonth: "2026-12", effectiveToMonth: null }),
    ]);
  });

  it("preserves a future open period when an earlier period is archived", async () => {
    const { sqlite, timeline } = await createTimeline(`
      insert into payroll_custom_field_definitions values
        ('allowance', 'institution-1', 'earnings', 'Allowance', 'allowance', 1, 1, 0, 0);
      insert into payroll_custom_field_periods values
        ('period-april', 'allowance', '2026-04', '2026-10', 0, 0),
        ('period-december', 'allowance', '2026-12', null, 0, 0);
    `);

    await timeline.archiveField("institution-1", { id: "allowance", month: "2026-09" });

    expect(
      (
        await sqlite.execute(
          "select effective_from_month, effective_to_month from payroll_custom_field_periods order by effective_from_month",
        )
      ).rows,
    ).toEqual([
      { effective_from_month: "2026-04", effective_to_month: "2026-09" },
      { effective_from_month: "2026-12", effective_to_month: null },
    ]);
    expect(
      (await sqlite.execute("select is_active from payroll_custom_field_definitions")).rows,
    ).toEqual([{ is_active: 1 }]);
  });

  it("conflicts only for a normalized active label in the same section and month", async () => {
    const { timeline } = await createTimeline(`
      insert into payroll_custom_field_definitions values
        ('allowance', 'institution-1', 'earnings', 'Special Allowance', 'special_allowance', 1, 1, 0, 0);
      insert into payroll_custom_field_periods values
        ('period-april', 'allowance', '2026-04', null, 0, 0);
    `);

    await expect(
      timeline.addField("institution-1", {
        section: "earnings",
        label: " special   allowance ",
        month: "2026-04",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      timeline.addField("institution-1", {
        section: "deductions",
        label: "Special Allowance",
        month: "2026-04",
      }),
    ).resolves.toMatchObject({ section: "deductions", label: "Special Allowance" });
  });

  it("rejects a Payroll field ID owned by another Institution", async () => {
    const { timeline } = await createTimeline(`
      insert into payroll_custom_field_definitions values
        ('allowance', 'institution-2', 'earnings', 'Allowance', 'allowance', 1, 1, 0, 0);
      insert into payroll_custom_field_periods values
        ('period-april', 'allowance', '2026-04', null, 0, 0);
    `);

    await expect(
      timeline.archiveField("institution-1", { id: "allowance", month: "2026-09" }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      timeline.archiveField("institution-1", { id: "allowance", month: "2026-09" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
