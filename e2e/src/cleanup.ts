#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  dryRunE2EInstitutionCleanupViaApi,
  executeE2EInstitutionCleanupViaApi,
  type E2ECleanupReport,
} from "./api-client";
import { readTestEnv } from "./env";
import { repositoryRoot } from "./load-env";

const BULK_MARKER = "run-";

type CleanupOptions = {
  mode: "dry-run" | "execute";
  marker: string;
  expectedCount?: number;
  reportPath?: string;
};

function printHelp(): void {
  console.log(`
Usage: bun e2e/src/cleanup.ts --dry-run [options]
       bun e2e/src/cleanup.ts --execute --report <path> [options]

Options:
  --dry-run                 Generate a marker-filtered report; never delete data.
  --execute                 Delete only the exact list captured in --report.
  --report <path>           JSON report path (required for --execute).
  --marker <value>          Marker prefix (default: run-).
  --expected-count <count>  Optional assertion for the reviewed report count.
  --help                    Show this message.
`);
}

function parseOptions(args: string[]): CleanupOptions {
  let mode: CleanupOptions["mode"] | undefined;
  let marker = BULK_MARKER;
  let expectedCount: number | undefined;
  let reportPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) continue;

    if (argument === "--help") {
      printHelp();
      process.exit(0);
    }
    if (argument === "--dry-run") {
      mode = "dry-run";
      continue;
    }
    if (argument === "--execute") {
      mode = "execute";
      continue;
    }
    if (argument === "--report") {
      reportPath = args[++index];
      continue;
    }
    if (argument === "--marker") {
      marker = args[++index] ?? "";
      continue;
    }
    if (argument === "--expected-count") {
      expectedCount = Number(args[++index]);
      continue;
    }

    throw new Error(`Unknown cleanup option "${argument}".`);
  }

  if (!mode) {
    throw new Error("Choose exactly one of --dry-run or --execute.");
  }
  if (!/^run(?:-[a-z0-9]+)*-?$/.test(marker.toLowerCase())) {
    throw new Error("--marker must start with run- and contain only safe marker characters.");
  }
  if (mode === "execute" && marker !== BULK_MARKER) {
    throw new Error("Bulk execution requires the exact --marker run- filter.");
  }
  if (expectedCount !== undefined && (!Number.isInteger(expectedCount) || expectedCount < 0)) {
    throw new Error("--expected-count must be a non-negative integer.");
  }
  if (mode === "execute" && !reportPath) {
    throw new Error("--execute requires a report created by a prior --dry-run.");
  }

  return { mode, marker, expectedCount, reportPath };
}

function defaultReportPath(): string {
  return resolve(repositoryRoot, "e2e/.cleanup", `cleanup-${Date.now().toString(36)}.json`);
}

async function writeReport(path: string, report: E2ECleanupReport): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...report,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function readReport(path: string): Promise<E2ECleanupReport> {
  const report = JSON.parse(await readFile(path, "utf8")) as E2ECleanupReport;
  if (
    report.marker !== BULK_MARKER ||
    report.matchedCount !== report.records.length ||
    report.records.some((record) => !record.institutionId || !record.userId || !record.username)
  ) {
    throw new Error("The cleanup report is invalid or was not produced by the bulk dry-run.");
  }
  return report;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const env = readTestEnv();

  if (options.mode === "dry-run") {
    const report = await dryRunE2EInstitutionCleanupViaApi(env, options.marker);
    const reportPath = resolve(options.reportPath ?? defaultReportPath());
    await writeReport(reportPath, report);
    console.log(
      `E2E cleanup dry-run: ${report.matchedCount} generated institutions matched marker "${report.marker}".`,
    );
    console.log(`Report: ${reportPath}`);
    console.log(`Report hash: ${report.reportHash}`);
    console.log("Deletion was not attempted.");
    return;
  }

  const report = await readReport(resolve(options.reportPath!));
  if (options.expectedCount !== undefined && report.matchedCount !== options.expectedCount) {
    throw new Error(
      `Refusing deletion: the dry-run report contains ${report.matchedCount} records, expected ${options.expectedCount}.`,
    );
  }

  const result = await executeE2EInstitutionCleanupViaApi(env, report, options.expectedCount);
  console.log(
    `E2E cleanup deleted ${result.deletedCount} generated institutions after the dry-run list was revalidated.`,
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
