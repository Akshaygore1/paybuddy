import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export type AxeScanOptions = {
  include?: string | string[];
  exclude?: string | string[];
  disabledRules?: string[];
  impactLevels?: ("critical" | "serious" | "moderate" | "minor")[];
};

export async function scanAccessibility(page: Page, options: AxeScanOptions = {}) {
  let builder = new AxeBuilder({ page });

  const defaultExcludes = [
    "[data-sonner-toaster]",
    "region[aria-label='Notifications alt+T']",
    ".cn-toast",
    ".react-query-devtools",
    "[data-query-devtools]",
  ];

  const excludes = [
    ...defaultExcludes,
    ...(options.exclude
      ? Array.isArray(options.exclude)
        ? options.exclude
        : [options.exclude]
      : []),
  ];

  for (const exc of excludes) {
    builder = builder.exclude(exc);
  }

  if (options.include) {
    const includes = Array.isArray(options.include) ? options.include : [options.include];
    for (const inc of includes) {
      builder = builder.include(inc);
    }
  }

  if (options.disabledRules && options.disabledRules.length > 0) {
    builder = builder.disableRules(options.disabledRules);
  }

  const results = await builder.analyze();
  const targetImpacts = options.impactLevels ?? ["critical", "serious"];
  const targetedViolations = results.violations.filter(
    (v) =>
      v.impact && targetImpacts.includes(v.impact as "critical" | "serious" | "moderate" | "minor"),
  );

  return {
    results,
    violations: results.violations,
    targetedViolations,
    passes: targetedViolations.length === 0,
  };
}

export async function expectAccessible(page: Page, options: AxeScanOptions = {}) {
  const { targetedViolations } = await scanAccessibility(page, options);

  if (targetedViolations.length > 0) {
    const formatted = targetedViolations
      .map(
        (v) =>
          `[${v.impact?.toUpperCase()}] ${v.id}: ${v.help} (${v.helpUrl})\n` +
          v.nodes
            .map(
              (n) =>
                `  - Target: ${n.target.join(", ")}\n    HTML: ${n.html}\n    Summary: ${n.failureSummary}`,
            )
            .join("\n"),
      )
      .join("\n\n");
    expect(targetedViolations, `Accessibility violations detected:\n${formatted}`).toHaveLength(0);
  } else {
    expect(targetedViolations).toHaveLength(0);
  }
}
