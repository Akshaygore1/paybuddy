import { test, expect } from "@playwright/test";
import { signIn, goToInstitutionSettings, createDesignation, goToEmployeeCreate, fillEmployeeForm, submitEmployeeCreate, selectOption } from "../src/helpers";

const designations = [
  "Headmaster",
  "Teacher",
  "Associate Teacher",
  "Librarian",
  "Clerk",
  "Support Staff"
];

const employees = [
  {
    firstName: "Rajesh",
    middleName: "Ramesh",
    surname: "Patil",
    dateOfBirth: "1975-08-12",
    gender: "Male" as const,
    designationName: "Headmaster",
    seniorityRank: 1,
    panNumber: "BNDP1234A",
    contactNumber: "9820123456"
  },
  {
    firstName: "Sunita",
    middleName: "Anil",
    surname: "Kulkarni",
    dateOfBirth: "1980-05-20",
    gender: "Female" as const,
    designationName: "Teacher",
    seniorityRank: 2,
    panNumber: "ASDK5678B",
    contactNumber: "9819234567"
  },
  {
    firstName: "Sachin",
    middleName: "Suresh",
    surname: "Joshi",
    dateOfBirth: "1982-11-15",
    gender: "Male" as const,
    designationName: "Teacher",
    seniorityRank: 3,
    panNumber: "CNPJ9012C",
    contactNumber: "9892345678"
  },
  {
    firstName: "Priya",
    middleName: "Sanjay",
    surname: "Deshmukh",
    dateOfBirth: "1985-03-24",
    gender: "Female" as const,
    designationName: "Teacher",
    seniorityRank: 4,
    panNumber: "DSPD3456D",
    contactNumber: "9769456789"
  },
  {
    firstName: "Amit",
    middleName: "Vijay",
    surname: "Pawar",
    dateOfBirth: "1988-09-05",
    gender: "Male" as const,
    designationName: "Associate Teacher",
    seniorityRank: 5,
    panNumber: "PWAP7890E",
    contactNumber: "9821567890"
  },
  {
    firstName: "Snehal",
    middleName: "Nitin",
    surname: "Shinde",
    dateOfBirth: "1990-07-18",
    gender: "Female" as const,
    designationName: "Associate Teacher",
    seniorityRank: 6,
    panNumber: "SHSS1234F",
    contactNumber: "9833678901"
  },
  {
    firstName: "Rahul",
    middleName: "Manohar",
    surname: "More",
    dateOfBirth: "1992-12-30",
    gender: "Male" as const,
    designationName: "Associate Teacher",
    seniorityRank: 7,
    panNumber: "MRRM5678G",
    contactNumber: "9920789012"
  },
  {
    firstName: "Anjali",
    middleName: "Devendra",
    surname: "Gaikwad",
    dateOfBirth: "1987-04-14",
    gender: "Female" as const,
    designationName: "Librarian",
    seniorityRank: 8,
    panNumber: "GKAG9012H",
    contactNumber: "9819890123"
  },
  {
    firstName: "Nitin",
    middleName: "Vasant",
    surname: "Tambe",
    dateOfBirth: "1984-01-25",
    gender: "Male" as const,
    designationName: "Clerk",
    seniorityRank: 9,
    panNumber: "TMNT3456I",
    contactNumber: "9757901234"
  },
  {
    firstName: "Kavita",
    middleName: "Prakash",
    surname: "Gokhale",
    dateOfBirth: "1989-10-10",
    gender: "Female" as const,
    designationName: "Clerk",
    seniorityRank: 10,
    panNumber: "GKKG7890J",
    contactNumber: "9869012345"
  },
  {
    firstName: "Vikas",
    middleName: "Ramchandra",
    surname: "Bhat",
    dateOfBirth: "1991-06-22",
    gender: "Male" as const,
    designationName: "Associate Teacher",
    seniorityRank: 11,
    panNumber: "BHVB1234K",
    contactNumber: "9820123499"
  },
  {
    firstName: "Jyoti",
    middleName: "Sharad",
    surname: "Kadam",
    dateOfBirth: "1993-02-28",
    gender: "Female" as const,
    designationName: "Associate Teacher",
    seniorityRank: 12,
    panNumber: "KDJK5678L",
    contactNumber: "9819234511"
  },
  {
    firstName: "Sanjay",
    middleName: "Arvind",
    surname: "Kamble",
    dateOfBirth: "1986-11-02",
    gender: "Male" as const,
    designationName: "Support Staff",
    seniorityRank: 13,
    panNumber: "KMSK9012M",
    contactNumber: "9892345622"
  },
  {
    firstName: "Sujata",
    middleName: "Dilip",
    surname: "Kale",
    dateOfBirth: "1990-04-15",
    gender: "Female" as const,
    designationName: "Support Staff",
    seniorityRank: 14,
    panNumber: "KLSK3456N",
    contactNumber: "9769456733"
  },
  {
    firstName: "Ramesh",
    middleName: "Dnyaneshwar",
    surname: "Rane",
    dateOfBirth: "1983-08-08",
    gender: "Male" as const,
    designationName: "Support Staff",
    seniorityRank: 15,
    panNumber: "RNRR7890O",
    contactNumber: "9821567844"
  }
];

test("Add school designations and 15 employees", async ({ page }) => {
  // 1. Sign in
  console.log("Signing in as sbschool@mail.com...");
  await signIn(page, "sbschool@mail.com", "Akshay@123");

  // 2. Add Designations
  console.log("Navigating to Employee Setup to add designations...");
  await goToInstitutionSettings(page);

  for (const name of designations) {
    const existing = page.getByTestId("designation-name").filter({ hasText: name });
    if (await existing.count() === 0) {
      console.log(`Creating designation: ${name}`);
      await createDesignation(page, name);
    } else {
      console.log(`Designation already exists: ${name}`);
    }
  }

  // 3. Add Employees
  console.log("Adding 15 employees...");
  for (const employee of employees) {
    console.log(`Adding employee: ${employee.firstName} ${employee.surname} (${employee.designationName})`);
    await goToEmployeeCreate(page);

    // Fill the standard form
    await page.getByLabel("Surname").fill(employee.surname);
    await page.getByLabel("First name").fill(employee.firstName);
    await page.getByLabel("Middle name").fill(employee.middleName);
    await page.getByLabel("Date of Birth").fill(employee.dateOfBirth);
    await selectOption(page, "Gender", employee.gender);
    await selectOption(page, "Designation", employee.designationName);
    await page.getByLabel("Seniority Rank").fill(String(employee.seniorityRank));
    await page.getByLabel("PAN number").fill(employee.panNumber);
    await page.getByLabel("Contact number").fill(employee.contactNumber);

    // Dynamically handle any required custom fields by finding all text inputs inside custom field containers
    // and filling them if their labels have '*'
    const customFieldInputs = await page.locator('input[id^="employee-custom-create-"]').all();
    for (const input of customFieldInputs) {
      const id = await input.getAttribute("id");
      if (id) {
        const label = await page.locator(`label[for="${id}"]`).textContent();
        if (label && label.includes("*")) {
          console.log(`Filling required custom field "${label.trim()}"...`);
          await input.fill("School Data Automation");
        }
      }
    }

    await submitEmployeeCreate(page);
    
    // Wait for redirection back to the employee directory
    await expect(page).toHaveURL(/\/employee$/);
  }

  console.log("Successfully added all designations and 15 employees!");
});
