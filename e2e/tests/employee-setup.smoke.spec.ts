import { test } from "../src/fixtures";
import {
  createDesignation,
  expectInstitutionNavigation,
  generateRealisticDesignation,
  goToEmployeeCreate,
  signIn,
  signOut,
} from "../src/helpers";
import { updateRunManifest } from "../src/manifest";

test.describe("employee-setup smoke", () => {
  test("provisions institution via API, verifies designation workflow and role navigation", async ({
    page,
    env,
    runId,
    provisionedInstitution,
  }) => {
    const designationName = generateRealisticDesignation(runId);

    // 1. Log run ID and username for inspection (never log passwords)
    console.log(
      `[E2E Smoke: Employee Setup] Run ID: ${runId} | Institution: "${provisionedInstitution.name}" | Username: "${provisionedInstitution.username}" | Designation: "${designationName}" | Target: ${env.baseURL}`,
    );
    test
      .info()
      .annotations.push(
        { type: "run-id", description: runId },
        { type: "institution-name", description: provisionedInstitution.name },
        { type: "institution-username", description: provisionedInstitution.username },
        { type: "designation-name", description: designationName },
      );

    // 2. Sign in as the generated institution user
    await signIn(page, provisionedInstitution.username, provisionedInstitution.password);

    // 3. Verify role-appropriate navigation (Institution user does NOT see Institution management)
    await expectInstitutionNavigation(page);

    // 4. Go to the employee create form
    await goToEmployeeCreate(page);

    // 5. Create a realistically named designation via the inline dialog and verify it is selected
    await createDesignation(page, designationName);

    // 6. Record created designation in the run manifest
    await updateRunManifest(runId, (prev) => ({
      ...prev,
      createdDesignation: {
        name: designationName,
      },
    }));

    // 7. Institution user signs out
    await signOut(page);
  });
});
