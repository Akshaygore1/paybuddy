import { expect, test } from "../src/fixtures";
import {
  createInstitutionViaUI,
  expectAdminNavigation,
  expectInstitutionDetails,
  expectInstitutionNavigation,
  goToInstitutionDirectory,
  signIn,
  signOut,
} from "../src/helpers";

test.describe("institution smoke", () => {
  test("creates a realistic institution, verifies persistence and role-based access", async ({
    page,
    env,
    institution,
    runId,
  }) => {
    // 1. Log run ID and username for inspection (never log password)
    console.log(
      `[E2E Smoke: Institution] Run ID: ${runId} | Institution: "${institution.name}" | Username: "${institution.username}" | Target: ${env.baseURL}`,
    );
    test
      .info()
      .annotations.push(
        { type: "run-id", description: runId },
        { type: "institution-name", description: institution.name },
        { type: "institution-username", description: institution.username },
      );

    // 2. Sign in as administrator
    await signIn(page, env.adminIdentifier, env.adminPassword);
    await expectAdminNavigation(page);

    // 3. Create uniquely marked institution through the browser UI
    const createdInstitution = await createInstitutionViaUI(page, institution);

    // 4. Verify persisted details on the institution detail page
    await expectInstitutionDetails(page, createdInstitution);

    // Verify presence in the institution directory table
    await goToInstitutionDirectory(page);
    await expect(page.getByRole("link", { name: institution.name })).toBeVisible();
    await expect(page.getByText(institution.tanNumber, { exact: true })).toBeVisible();

    // 5. Admin signs out
    await signOut(page);

    // 6. Sign in with the newly generated institution credentials
    await signIn(page, institution.username, institution.password);

    // 7. Verify role-appropriate navigation for institution user
    await expectInstitutionNavigation(page);

    // 8. Institution user signs out
    await signOut(page);
  });
});
