import { test, expect, type Page } from "@playwright/test";
import { signIn, selectOption } from "../src/helpers";

const employees = [
  {
    fullName: "Rajesh Ramesh Patil",
    designationName: "Headmaster",
    basicPay: "75000",
    recovery: "2000",
    allowances: [
      { label: "Dearness Allowance", amount: "15000" },
      { label: "House Rent Allowance", amount: "8000" }
    ]
  },
  {
    fullName: "Sunita Anil Kulkarni",
    designationName: "Teacher",
    basicPay: "45000",
    recovery: "1000",
    allowances: [
      { label: "Dearness Allowance", amount: "9000" },
      { label: "House Rent Allowance", amount: "5000" }
    ]
  },
  {
    fullName: "Sachin Suresh Joshi",
    designationName: "Teacher",
    basicPay: "45000",
    recovery: "1000",
    allowances: [
      { label: "Dearness Allowance", amount: "9000" },
      { label: "House Rent Allowance", amount: "5000" }
    ]
  },
  {
    fullName: "Priya Sanjay Deshmukh",
    designationName: "Teacher",
    basicPay: "45000",
    recovery: "1000",
    allowances: [
      { label: "Dearness Allowance", amount: "9000" },
      { label: "House Rent Allowance", amount: "5000" }
    ]
  },
  {
    fullName: "Amit Vijay Pawar",
    designationName: "Associate Teacher",
    basicPay: "35000",
    recovery: "800",
    allowances: [
      { label: "Dearness Allowance", amount: "7000" },
      { label: "House Rent Allowance", amount: "4000" }
    ]
  },
  {
    fullName: "Snehal Nitin Shinde",
    designationName: "Associate Teacher",
    basicPay: "35000",
    recovery: "800",
    allowances: [
      { label: "Dearness Allowance", amount: "7000" },
      { label: "House Rent Allowance", amount: "4000" }
    ]
  },
  {
    fullName: "Rahul Manohar More",
    designationName: "Associate Teacher",
    basicPay: "35000",
    recovery: "800",
    allowances: [
      { label: "Dearness Allowance", amount: "7000" },
      { label: "House Rent Allowance", amount: "4000" }
    ]
  },
  {
    fullName: "Anjali Devendra Gaikwad",
    designationName: "Librarian",
    basicPay: "40000",
    recovery: "900",
    allowances: [
      { label: "Dearness Allowance", amount: "8000" },
      { label: "House Rent Allowance", amount: "4500" }
    ]
  },
  {
    fullName: "Nitin Vasant Tambe",
    designationName: "Clerk",
    basicPay: "30000",
    recovery: "500",
    allowances: [
      { label: "Dearness Allowance", amount: "6000" },
      { label: "House Rent Allowance", amount: "3500" }
    ]
  },
  {
    fullName: "Kavita Prakash Gokhale",
    designationName: "Clerk",
    basicPay: "30000",
    recovery: "500",
    allowances: [
      { label: "Dearness Allowance", amount: "6000" },
      { label: "House Rent Allowance", amount: "3500" }
    ]
  },
  {
    fullName: "Vikas Ramchandra Bhat",
    designationName: "Associate Teacher",
    basicPay: "35000",
    recovery: "800",
    allowances: [
      { label: "Dearness Allowance", amount: "7000" },
      { label: "House Rent Allowance", amount: "4000" }
    ]
  },
  {
    fullName: "Jyoti Sharad Kadam",
    designationName: "Associate Teacher",
    basicPay: "35000",
    recovery: "800",
    allowances: [
      { label: "Dearness Allowance", amount: "7000" },
      { label: "House Rent Allowance", amount: "4000" }
    ]
  },
  {
    fullName: "Sanjay Arvind Kamble",
    designationName: "Support Staff",
    basicPay: "20000",
    recovery: "300",
    allowances: [
      { label: "Dearness Allowance", amount: "4000" },
      { label: "House Rent Allowance", amount: "2500" }
    ]
  },
  {
    fullName: "Sujata Dilip Kale",
    designationName: "Support Staff",
    basicPay: "20000",
    recovery: "300",
    allowances: [
      { label: "Dearness Allowance", amount: "4000" },
      { label: "House Rent Allowance", amount: "2500" }
    ]
  },
  {
    fullName: "Ramesh Dnyaneshwar Rane",
    designationName: "Support Staff",
    basicPay: "20000",
    recovery: "300",
    allowances: [
      { label: "Dearness Allowance", amount: "4000" },
      { label: "House Rent Allowance", amount: "2500" }
    ]
  }
];

async function ensureCustomField(page: Page, label: string, section: "earnings" | "deductions") {
  const input = page.getByLabel(`${label} amount`);
  if (await input.count() === 0) {
    console.log(`Custom field "${label}" not found. Adding it to ${section}...`);
    // Select the section
    await selectOption(page, "Select custom payroll field section", section === "earnings" ? "Earnings" : "Deductions");
    // Fill the field label using placeholder
    await page.getByPlaceholder("Allowance name").fill(label);
    // Click Add Field
    await page.getByRole("button", { name: "Add Field" }).click();
    // Wait for it to be visible
    await expect(input).toBeVisible();
  }
}

test("Add payroll for all 15 employees", async ({ page }) => {
  test.setTimeout(180000); // Set higher timeout (3 minutes) for 15 payroll entries

  // 1. Sign in
  console.log("Signing in as sbschool@mail.com...");
  await signIn(page, "sbschool@mail.com", "Akshay@123");

  // 2. Add payroll for each employee
  for (const emp of employees) {
    console.log(`Processing payroll for ${emp.fullName} (${emp.designationName})...`);
    
    // Navigate directly to payroll page to reset the form state
    await page.goto("/payroll");
    await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();

    // Select Employee, Year, Month
    await selectOption(page, "Select employee", emp.fullName);
    await expect(page.getByLabel("Basic Pay amount")).toBeVisible();
    await selectOption(page, "Select payroll financial year", "2026-2027");
    await selectOption(page, "Select payroll month", "June 2026");

    // Fill Basic Pay and Recovery
    await page.getByLabel("Basic Pay amount").fill(emp.basicPay);
    await page.getByLabel("Recovery amount").fill(emp.recovery);

    // Add / Ensure Custom Allowances exist, then fill them
    for (const allowance of emp.allowances) {
      await ensureCustomField(page, allowance.label, "earnings");
      await page.getByLabel(`${allowance.label} amount`).fill(allowance.amount);
    }

    // Save Payroll
    await page.getByRole("button", { name: "Save Payroll" }).click();

    // Verify payroll saved toast
    await expect(page.getByText("Payroll saved")).toBeVisible();
    console.log(`Payroll saved successfully for ${emp.fullName}`);
  }

  console.log("All 15 payrolls have been processed successfully!");
});
