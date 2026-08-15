import { expect, test } from "../src/fixtures";
import {
  createInstitutionViaUI,
  expectAccessible,
  expectInstitutionDetails,
  expectInstitutionNavigation,
  fillInstitutionStep1,
  fillInstitutionStep2,
  generateIndianInstitution,
  goToInstitutionCreate,
  goToInstitutionDetail,
  goToInstitutionDirectory,
  pressEnter,
  pressTab,
  resetInstitutionPasswordViaUI,
  signIn,
  signOut,
  simulateNetworkFailure,
  simulateServerError,
  simulateSlowResponse,
  simulateUnauthorized,
  simulateValidationFailure,
  tabUntilFocused,
  toggleInstitutionLoginAccessViaUI,
} from "../src/helpers";

test.describe("institution regression suite", () => {
  test.describe("1. Form Validation & Step Boundaries", () => {
    test("validates empty, malformed, minimum, maximum, and boundary behavior across both creation-form steps", async ({
      page,
      env,
      runId,
    }) => {
      // 1. Sign in as admin
      await signIn(page, env.adminIdentifier, env.adminPassword);
      await goToInstitutionCreate(page);

      // --- Step 1 Validation ---
      // A. Empty submission
      await page.getByRole("button", { name: "Continue" }).click();

      // Multi-error submission verifies error presentation and accessible associations
      await expect(page.getByText("Institution name is required")).toBeVisible();
      await expect(page.getByText("TAN number is required")).toBeVisible();
      await expect(page.getByText("Institution head is required")).toBeVisible();
      await expect(page.getByText("Address is required")).toBeVisible();

      // Accessible associations: input has aria-invalid and Field has data-invalid
      await expect(page.getByLabel("Institution Name")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("TAN Number")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("Institution Head")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("Address")).toHaveAttribute("aria-invalid", "true");

      // B. Maximum / boundary validation: TAN Number > 64 chars
      await fillInstitutionStep1(page, {
        name: "Boundary High School",
        tanNumber: "PUNE" + "9".repeat(61), // 65 chars > 64
        institutionHead: "Dr. Boundary",
        address: "123 Boundary Road, Pune",
      });
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByText("TAN number is too long")).toBeVisible();
      await expect(page.getByLabel("TAN Number")).toHaveAttribute("aria-invalid", "true");

      // C. Valid Step 1 submission advances to Step 2
      const validTan = "PUNEP12345";
      await page.getByLabel("TAN Number").fill(validTan);
      await page.getByRole("button", { name: "Continue" }).click();

      // Verify advanced to Step 2
      await expect(page.getByText("Step 2 of 2")).toBeVisible();
      await expect(page.getByLabel("Username or Email")).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();

      // --- Step 2 Validation ---
      // A. Empty Step 2 submission
      await page.getByRole("button", { name: "Create Institution" }).click();
      await expect(
        page.getByText(
          "Username must be a valid email address or use only letters, numbers, underscores, and periods",
        ),
      ).toBeVisible();
      await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
      await expect(page.getByLabel("Username or Email")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");

      // B. Minimum username length (< 3 chars)
      await fillInstitutionStep2(page, {
        username: "ab",
        password: "Password123!",
      });
      await page.getByRole("button", { name: "Create Institution" }).click();
      await expect(
        page.getByText(
          "Username must be a valid email address or use only letters, numbers, underscores, and periods",
        ),
      ).toBeVisible();

      // C. Malformed username characters (e.g. spaces or invalid punctuation)
      await fillInstitutionStep2(page, {
        username: "bad user#$%",
        password: "Password123!",
      });
      await page.getByRole("button", { name: "Create Institution" }).click();
      await expect(
        page.getByText(
          "Username must be a valid email address or use only letters, numbers, underscores, and periods",
        ),
      ).toBeVisible();

      // D. Minimum password length (< 8 chars)
      const validUsername = `inst_${runId.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`;
      await fillInstitutionStep2(page, {
        username: validUsername,
        password: "1234567",
      });
      await page.getByRole("button", { name: "Create Institution" }).click();
      await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();

      // E. Back navigation preserves Step 1 data
      await page.getByRole("button", { name: "Back" }).click();
      await expect(page.getByText("Step 1 of 2")).toBeVisible();
      await expect(page.getByLabel("Institution Name")).toHaveValue("Boundary High School");
      await expect(page.getByLabel("TAN Number")).toHaveValue(validTan);
      await expect(page.getByLabel("Institution Head")).toHaveValue("Dr. Boundary");
      await expect(page.getByLabel("Address")).toHaveValue("123 Boundary Road, Pune");

      // Returning to Step 2 preserves Step 2 data
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByText("Step 2 of 2")).toBeVisible();
      await expect(page.getByLabel("Username or Email")).toHaveValue(validUsername);

      // Clean up session
      await signOut(page);
    });
  });

  test.describe("2. Directory, Details, Password Reset & Login Access Lifecycle", () => {
    test("verifies directory listing, detail persistence, password reset, credential transitions, and login deactivation/reactivation", async ({
      page,
      env,
      temporaryInstitution,
    }) => {
      const institution = temporaryInstitution;
      const newPassword = `${institution.password}_updated99!`;

      // 1. Sign in as admin and create institution via UI
      await signIn(page, env.adminIdentifier, env.adminPassword);
      const created = await createInstitutionViaUI(page, institution);

      // 2. Assert persisted details on the institution detail page
      await expectInstitutionDetails(page, created);

      // 3. Verify presence and metadata in the institution directory
      await goToInstitutionDirectory(page);
      const directoryRow = page.getByRole("row").filter({ hasText: institution.name });
      await expect(directoryRow).toBeVisible();
      await expect(directoryRow).toContainText(institution.tanNumber);
      await expect(directoryRow).toContainText(institution.institutionHead);
      await expect(directoryRow).toContainText(institution.username);
      await expect(directoryRow).toContainText("Active");

      // 4. Navigate back to details and test password reset
      await goToInstitutionDetail(page, created.id);

      // Validation: short password
      await page.getByLabel("New Password").fill("short");
      await page.getByRole("button", { name: "Reset Password" }).click();
      await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();

      // Valid password reset
      await resetInstitutionPasswordViaUI(page, newPassword);
      await expect(page.getByText("Institution password reset")).toBeVisible();
      await expect(page.getByLabel("New Password")).toHaveValue("");

      // 5. Verify old credential behavior: sign out admin, old password fails
      await signOut(page);
      await page.getByLabel("Email or Username").fill(institution.username);
      await page.getByLabel("Password").fill(institution.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      // Should fail and display error toast
      await expect(page.locator("[data-sonner-toast]")).toBeVisible();
      await expect(page).toHaveURL(/\/sign-in$/);

      // 6. Verify new credential behavior: sign in succeeds with new password
      await page.getByLabel("Password").fill(newPassword);
      await page.getByRole("button", { name: "Sign In" }).click();
      await expectInstitutionNavigation(page);

      // Sign out institution user
      await signOut(page);

      // 7. Admin deactivates login access
      await signIn(page, env.adminIdentifier, env.adminPassword);
      await goToInstitutionDetail(page, created.id);
      await toggleInstitutionLoginAccessViaUI(page, "Inactive");
      await expect(page.getByText("Institution login deactivated")).toBeVisible();

      // Sign out admin
      await signOut(page);

      // 8. Verify blocked login while deactivated
      await page.getByLabel("Email or Username").fill(institution.username);
      await page.getByLabel("Password").fill(newPassword);
      await page.getByRole("button", { name: "Sign In" }).click();
      // Login blocked with error toast
      await expect(page.locator("[data-sonner-toast]")).toBeVisible();
      await expect(page).toHaveURL(/\/sign-in$/);

      // 9. Admin reactivates login access
      await signIn(page, env.adminIdentifier, env.adminPassword);
      await goToInstitutionDetail(page, created.id);
      await toggleInstitutionLoginAccessViaUI(page, "Active");
      await expect(page.getByText("Institution login activated")).toBeVisible();

      // Sign out admin
      await signOut(page);

      // 10. Verify restored login
      await signIn(page, institution.username, newPassword);
      await expectInstitutionNavigation(page);

      // Sign out institution user
      await signOut(page);
    });
  });

  test.describe("3. Session, Logout & Route Guard Protection", () => {
    test("enforces role-based route guards and verifies session invalidation on logout for both roles", async ({
      page,
      env,
      temporaryInstitution,
    }) => {
      const institution = temporaryInstitution;
      // 1. Admin signs in and provisions institution
      await signIn(page, env.adminIdentifier, env.adminPassword);
      await createInstitutionViaUI(page, institution);

      // Verify admin can access admin routes
      await page.goto("/institutions");
      await expect(page).toHaveURL(/\/institutions$/);
      await page.goto("/institutions/create");
      await expect(page).toHaveURL(/\/institutions\/create$/);
      await page.goto("/admin/custom-fields");
      await expect(page).toHaveURL(/\/admin\/custom-fields$/);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard$/);

      // 2. Admin signs out -> revisiting protected pages redirects to /sign-in
      await signOut(page);

      await page.goto("/institutions");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/institutions/create");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/admin/custom-fields");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/sign-in$/);

      // 3. Institution user signs in
      await signIn(page, institution.username, institution.password);
      await expectInstitutionNavigation(page);

      // Verify institution user can access institution routes
      await page.goto("/employee");
      await expect(page).toHaveURL(/\/employee$/);
      await page.goto("/institution-settings");
      await expect(page).toHaveURL(/\/institution-settings$/);
      await page.goto("/payroll");
      await expect(page).toHaveURL(/\/payroll$/);
      await page.goto("/reports");
      await expect(page).toHaveURL(/\/reports$/);

      // 4. Role guard protection: Institution user accessing admin-only routes is redirected to default route (/dashboard)
      await page.goto("/institutions");
      await expect(page).toHaveURL(/\/dashboard$/);

      await page.goto("/institutions/create");
      await expect(page).toHaveURL(/\/dashboard$/);

      await page.goto("/admin/custom-fields");
      await expect(page).toHaveURL(/\/dashboard$/);

      // 5. Institution user signs out -> revisiting protected pages redirects to /sign-in
      await signOut(page);

      await page.goto("/employee");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/institution-settings");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/payroll");
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/reports");
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  });

  test.describe("4. Accessibility & Keyboard Operability", () => {
    test("scans primary Institution pages for WCAG serious violations and validates full keyboard operability", async ({
      page,
      env,
      temporaryInstitution,
      runId,
    }) => {
      const institution = temporaryInstitution;
      const kbInstitution = generateIndianInstitution(`${runId}kb`);

      // 1. Sign in as admin
      await signIn(page, env.adminIdentifier, env.adminPassword);

      // 2. Scan /institutions directory
      await goToInstitutionDirectory(page);
      await expectAccessible(page);

      // 3. Scan /institutions/create (Step 1)
      await goToInstitutionCreate(page);
      await expectAccessible(page);

      // Advance to Step 2 and scan /institutions/create (Step 2)
      await fillInstitutionStep1(page, institution);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByText("Step 2 of 2")).toBeVisible();
      await expectAccessible(page);

      // Create institution and scan /institutions/:id detail page
      await fillInstitutionStep2(page, institution);
      await page.getByRole("button", { name: "Create Institution" }).click();
      await expect(page).toHaveURL(/\/institutions\/(?!create$)[a-zA-Z0-9_-]+$/);
      await expectAccessible(page);

      // 4. Full Keyboard Operability: Create institution via keyboard navigation
      await goToInstitutionCreate(page);

      // Focus institution name input
      await page.getByLabel("Institution Name").focus();
      await page.keyboard.type(kbInstitution.name);

      await pressTab(page);
      await page.keyboard.type(kbInstitution.tanNumber);

      await pressTab(page);
      await page.keyboard.type(kbInstitution.institutionHead);

      await pressTab(page);
      await page.keyboard.type(kbInstitution.address);

      // Tab to Continue button and press Enter
      await tabUntilFocused(page, page.getByRole("button", { name: "Continue" }));
      await pressEnter(page);

      await expect(page.getByText("Step 2 of 2")).toBeVisible();

      // Keyboard fill Step 2
      await page.getByLabel("Username or Email").focus();
      await page.keyboard.type(kbInstitution.username);

      await pressTab(page);
      await page.keyboard.type(kbInstitution.password);

      // Tab to Create Institution button and press Enter
      await tabUntilFocused(page, page.getByRole("button", { name: "Create Institution" }));
      await pressEnter(page);

      // Verify navigation to Detail page
      await expect(page).toHaveURL(/\/institutions\/(?!create$)[a-zA-Z0-9_-]+$/);
      await expect(page.getByRole("heading", { name: kbInstitution.name })).toBeVisible();

      // 5. Keyboard interaction on Detail page: Reset password & toggle login access
      const newKbPassword = `${kbInstitution.password}_kbReset1!`;
      await page.getByLabel("New Password").focus();
      await page.keyboard.type(newKbPassword);

      await tabUntilFocused(page, page.getByRole("button", { name: "Reset Password" }));
      await pressEnter(page);
      await expect(page.getByText("Institution password reset")).toBeVisible();

      // Tab to Deactivate Login button and activate with Space / Enter
      await tabUntilFocused(page, page.getByRole("button", { name: "Deactivate Login" }));
      await pressEnter(page);
      await expect(page.getByText("Institution login deactivated")).toBeVisible();
      await expect(page.getByText("Current login status: Inactive")).toBeVisible();

      // Tab to Activate Login button and activate with Enter
      await tabUntilFocused(page, page.getByRole("button", { name: "Activate Login" }));
      await pressEnter(page);
      await expect(page.getByText("Institution login activated")).toBeVisible();
      await expect(page.getByText("Current login status: Active")).toBeVisible();

      await signOut(page);
    });
  });

  test.describe("5. Controlled Request Interception & Error Recovery", () => {
    test("handles server-side validation error, temporary server failure, network failure, slow mutation, and unauthorized error gracefully", async ({
      page,
      env,
      temporaryInstitution,
    }) => {
      const institution = temporaryInstitution;
      // 1. Sign in as admin
      await signIn(page, env.adminIdentifier, env.adminPassword);

      // --- A. Server-Side Validation Failure (400) ---
      await goToInstitutionCreate(page);
      await fillInstitutionStep1(page, institution);
      await page.getByRole("button", { name: "Continue" }).click();
      await fillInstitutionStep2(page, institution);

      const unroute400 = await simulateValidationFailure(
        page,
        "**/trpc/institutions.create*",
        "TAN number duplicate or invalid according to income tax rules",
      );

      await page.getByRole("button", { name: "Create Institution" }).click();
      await expect(
        page.getByText("TAN number duplicate or invalid according to income tax rules"),
      ).toBeVisible();
      // Verify form state is preserved and page did not crash
      await expect(page.getByLabel("Username or Email")).toHaveValue(institution.username);
      await expect(page.getByLabel("Password")).toHaveValue(institution.password);
      await unroute400();

      // --- B. Temporary Server Failure (500) ---
      const unroute500 = await simulateServerError(
        page,
        "**/trpc/institutions.create*",
        500,
        "Database cluster unreachable, please try again",
      );

      await page.getByRole("button", { name: "Create Institution" }).click();
      await expect(page.getByText("Database cluster unreachable, please try again")).toBeVisible();
      // Form state preserved
      await expect(page.getByLabel("Username or Email")).toHaveValue(institution.username);
      await unroute500();

      // --- C. Network Failure / Abort ---
      const unrouteAbort = await simulateNetworkFailure(page, "**/trpc/institutions.create*");
      await page.getByRole("button", { name: "Create Institution" }).click();
      // Assert error feedback appears or button stays functional
      await expect(page.getByRole("button", { name: "Create Institution" })).toBeVisible();
      await unrouteAbort();

      // --- D. Slow Mutation & Pending Feedback ---
      const unrouteSlow = await simulateSlowResponse(page, "**/trpc/institutions.create*", 1200);
      await page.getByRole("button", { name: "Create Institution" }).click();

      // Assert pending state
      await expect(page.getByRole("button", { name: "Creating..." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Creating..." })).toBeDisabled();

      // Await success completion after delay
      await expect(page).toHaveURL(/\/institutions\/(?!create$)[a-zA-Z0-9_-]+$/);
      await expect(page.getByText("Institution created successfully")).toBeVisible();
      await unrouteSlow();

      // --- E. Unauthorized / Session Expired (401) ---
      const unroute401 = await simulateUnauthorized(
        page,
        "**/trpc/institutions.resetPassword*",
        "UNAUTHORIZED",
      );

      await page.getByLabel("New Password").fill("NewSecurePassword123!");
      await page.getByRole("button", { name: "Reset Password" }).click();
      await expect(page.getByText("UNAUTHORIZED")).toBeVisible();
      await unroute401();

      await signOut(page);
    });
  });
});
