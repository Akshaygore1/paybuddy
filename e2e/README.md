# E2E

Run the Playwright suite against a deployed or local institution-user environment.

Use a dedicated disposable institution-user test account. The suite performs a full UI-only preflight reset before fixture creation and will delete all employees, custom fields, and designations visible to that account. Repeated runs against the same account are supported because the suite self-resets through the product UI.

## Required environment variables

- `BASE_URL`
- `TEST_IDENTIFIER`
- `TEST_PASSWORD`

## Commands

- `bun run test:e2e`
- `bun run test:e2e:ui`
- `bun run test:e2e:headed`

The suite is isolated in this top-level workspace and is not referenced by the Cloudflare deploy path.
