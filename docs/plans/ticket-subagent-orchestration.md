# Autonomous Ticket-to-Sub-Agent Orchestration

## Summary

Act as the coordinator for `/Users/akshay/Desktop/paybuddy`. Continue automatically until every ticket in `tickets.md` is strictly verified and committed, or a genuine external blocker prevents progress.

Use the environment's available delegation mechanism without depending on a particular model or tool name. Process one ticket at a time, giving each ticket a fresh dedicated implementation sub-agent and an independent review sub-agent. The coordinator manages dependency ordering, validation, ticket bookkeeping, and Git commits; it does not perform the ticket implementation itself.

## Coordinator Workflow

1. Read completely before acting:

   - `AGENTS.md` and every referenced instruction file.
   - `tickets.md`.
   - `docs/specs/feature-based-e2e-suite.md`.
   - Relevant package scripts, E2E configuration, and existing implementation.

2. Inspect `git status`, recent commits, and the current diff. Preserve all pre-existing work. The currently known untracked `tickets.md` and `docs/specs/` are authoritative task inputs, not disposable files.

3. Parse `tickets.md` as a dependency graph:

   - A ticket is complete only when all its acceptance checkboxes are checked.
   - A ticket is frontier-ready when it is incomplete and every title in its `Blocked by` field is complete.
   - Select the first frontier-ready ticket in file order.
   - Never ask the user which ticket to choose.
   - Never start a blocked ticket.

4. Before new work, validate the existing completed foundation with repository checks and the Institution smoke suite. If a completed ticket no longer satisfies its acceptance criteria, reopen and repair it before allowing dependent tickets to proceed.

5. Preflight the runtime without exposing secrets:

   - Confirm Bun and dependencies are available.
   - Confirm `BASE_URL` and administrator credentials are available through the supported environment files or variables.
   - If the target is local and not running, start `bun run dev` in a persistent background process and wait for readiness.
   - Never print passwords, manifests containing passwords, or secret environment values.
   - Under the strict gate, stop with a precise blocker if credentials or a reachable test environment cannot be obtained.

## Per-Ticket Agent Loop

For each frontier ticket:

1. Create a fresh dedicated implementation sub-agent. Give it:

   - The exact ticket title, description, acceptance checklist, and blockers.
   - The linked specification and repository instructions.
   - The current relevant diff and implementation context.
   - Instructions to inspect existing code before editing, implement the entire ticket, preserve unrelated changes, and avoid committing or editing `tickets.md`.
   - Instructions to use accessible Playwright locators, externally observable assertions, existing authenticated product APIs for fixture setup, unique retained test data, and no test-only endpoint, direct database access, broad cleanup, hard-coded credentials, or unit tests.
   - Instructions to return a structured report containing changed files, acceptance evidence for every checkbox, commands run with results, and unresolved risks.

2. Keep that sub-agent dedicated to the ticket through correction rounds. Do not assign it another ticket.

3. After implementation, create a fresh independent review sub-agent. It must inspect the working-tree diff read-only against:

   - Every ticket acceptance item.
   - The feature-based E2E specification.
   - Repository coding and testing standards.
   - Security of credentials and generated manifests.
   - Test isolation, retained-data safety, accessible locators, persistence assertions, mobile expectations, and regression risks.

4. The reviewer returns either `PASS` or actionable findings with file and location references. Send findings back to the implementation sub-agent and repeat implementation and review until it passes.

5. If the same failure persists for two correction rounds, use a fresh diagnostic sub-agent to identify the root cause, then return its findings to the ticket owner. Stop only after three consecutive no-progress attempts or a genuine external blocker, leaving the work intact and reporting exact evidence.

6. The coordinator then runs the strict verification gate. Do not mark any checkbox complete based only on the sub-agent's claim.

7. Once verification passes:

   - Update every satisfied checkbox for that ticket in `tickets.md`.
   - Confirm all acceptance items are checked.
   - Stage only explicit ticket-owned files; never use broad staging such as `git add .`.
   - Include `tickets.md` and its linked specification in the first pending-ticket commit if they remain untracked.
   - Create one focused commit using the ticket title as the imperative commit subject.
   - Confirm no unintended files were committed.
   - Terminate the ticket-specific agents, recalculate the frontier, and immediately continue.

Do not push, create a pull request, rewrite existing commits, or stop merely to summarize progress.

## Strict Verification Gate

Run for every ticket:

- `rtk bun run check`.
- Playwright discovery for the affected suite.
- The focused ticket suite against the configured environment.
- Any narrower checks needed to prove individual acceptance items.
- Review the generated manifest and reports without displaying secrets.
- Confirm the working tree contains no generated credentials or test artifacts intended to be ignored.

Use these focused runtime mappings:

- Feature smoke ticket:  
  `rtk bun e2e/src/runner.ts --feature <feature> --depth smoke`  
  This must exercise both configured desktop and mobile projects.
- Feature regression ticket:  
  `rtk bun e2e/src/runner.ts --feature <feature> --depth regression --project desktop`
- Complete smoke ticket:  
  `rtk bun e2e/src/runner.ts --depth smoke`
- Final regression ticket: run repository checks, Playwright discovery, every feature smoke suite, and:  
  `rtk bun e2e/src/runner.ts --depth regression`

Feature slugs are `institution`, `employee-setup`, `employee`, `payroll`, and `reports`. When a ticket changes shared fixtures, helpers, runner behavior, or configuration, rerun every previously completed suite that consumes the changed code.

A redirect, toast, test discovery, or type check alone is never enough when the ticket requires persisted or downloaded behavior. Do not weaken assertions to make a test pass.

## Interfaces, Completion, and Assumptions

- The orchestration interface is `tickets.md`: headings identify tickets, `Blocked by` defines exact title-based dependencies, and checkboxes define acceptance.
- Each implementation agent must return: ticket title, files changed, per-checkbox evidence, verification results, and blockers.
- Each review agent must return: `PASS`, or prioritized actionable findings.
- Production code may change only when required to restore behavior explicitly promised by the specification; do not introduce test-only seams.
- Created E2E data must remain preserved after success and failure.
- If interrupted, resume by inspecting the dirty tree, identifying the earliest active frontier ticket, and assigning a fresh dedicated agent to continue it without discarding work.
- Completion means no unchecked acceptance items remain, every dependency is satisfied, every ticket has passed independent review and strict verification, and each ticket has its own focused commit.
