# TDS Nivaran Payroll Portal

## Features Available Today

**Simple customer guide**  
**Last updated:** 11 August 2026

## What TDS Nivaran is used for

TDS Nivaran helps an institute keep employee information, payroll details, payslips, and yearly reports in one place.

There are two types of users:

- **Admin:** creates and manages institute accounts.
- **Institute team:** manages employees and payroll for its own institute.

## 1. Features for all users

### Sign in

Users sign in with:

- Email or username
- Password

The password must have at least 8 characters.

- Admin users sign in with email.
- Institute users sign in with their institute username.
- Users can sign out at any time.
- New users are created by the Admin. There is no public sign-up page.

### Choose a financial year

Users can choose one of these financial years:

- 2023-2024
- 2024-2025
- 2025-2026
- 2026-2027
- 2027-2028
- 2028-2029

The financial year runs from April to March. The selected year is used in Payroll and Reports.

### Messages and help while using the portal

The portal shows:

- A loading message while information is being opened.
- A success message after an item is saved or updated.
- A clear message when something needs to be corrected.
- Helpful instructions when there is no information yet.

## 2. Admin features

### Admin home page

The Admin home page has quick links to:

- **Institute Management**
- **Reports**

### Manage institutes

#### Institute list

The Admin can see a list of all institutes created in TDS Nivaran.

The list shows:

- Institute Name
- TAN Number
- Institute Head
- Username
- Login Status — Active or Inactive
- Date Created

The Admin can:

- Add a new institute.
- Open an institute's details.
- Move through the list using Previous and Next.

Up to 10 institutes are shown at a time.

#### Add a new institute

Adding an institute has two steps.

##### Step 1: Institute details

| Field            | What to enter                      | Required? |
| ---------------- | ---------------------------------- | :-------: |
| Institution Name | Name of the institute.             |    Yes    |
| TAN Number       | Tax deduction account number.      |    Yes    |
| Institution Head | Name of the head of the institute. |    Yes    |
| Address          | Institute address.                 |    Yes    |

Select **Continue** to go to the next step. If a required field is empty, the portal asks the Admin to complete it.

##### Step 2: Institute login

| Field             | What to enter                                                                  | Required? |
| ----------------- | ------------------------------------------------------------------------------ | :-------: |
| Username or Email | A username, such as `greenfield_admin`, or a full email address.               |    Yes    |
| Password          | The first password for the institute user. It must have at least 8 characters. |    Yes    |

Available buttons:

- **Back:** returns to Step 1 and keeps the details already entered.
- **Create Institution:** creates the institute and its login.
- **Cancel:** returns to the institute list.

After the institute is created:

- A success message is shown.
- The new institute's details open automatically.
- The institute login is Active.

The same TAN Number cannot be used for two institutes.

#### Institute details

The Admin can open an institute to view:

- Institution Name
- TAN Number
- Institution Head
- Username
- System User Name
- System Email
- Address
- Date Created
- Last Updated
- Login Status

#### Reset an institute password

The Admin can set a new password for an institute user.

1. Enter a **New Password**.
2. Select **Reset Password**.

The new password must have at least 8 characters. There is no second confirmation-password box.

#### Turn off institute login

The Admin can select **Deactivate Login** to block an institute from signing in and **Activate Login** to restore access later.

When a login is deactivated:

- The institute user cannot sign in.
- The institute stays in the institute list.
- The status changes to Inactive.

### Admin reports

The Admin can view a report for any institute.

To view a report:

1. Select an institute.
2. Select a financial year.
3. Review the employee payroll information.

The Admin can search the report, move between pages, and download it as a CSV file that can be opened in Excel.

## 3. Institute team features

### Institute home page

The institute team can open:

- **Employee**
- **Employee Setup**
- **Payroll**
- **Reports**

### Employee Setup

Employee Setup helps the institute prepare the information used in employee records.

#### Add a designation

A designation is a job title or role, such as Teacher, Headmaster, Clerk, or Accountant.

| Field            | What to enter                  | Required? |
| ---------------- | ------------------------------ | :-------: |
| Designation name | Name of the job title or role. |    Yes    |

Select **Create Designation** to add it to the institute.

The portal does not allow the same active designation to be added twice.

#### Arrange designations

Each designation in the list shows:

- Designation name
- Display order
- **Move up**
- **Move down**
- **Remove**

The institute team can arrange designations from higher roles to lower roles. This order is used in the employee form.

Removing a designation takes it out of the list for new employees. Existing employees using that designation are not deleted.

#### Add custom employee fields

The institute can add its own employee fields, for example:

- Staff Code
- Department
- Joining Reference
- Any other information needed by the institute

Custom employee fields are added from the **Add Employee** screen.

| Field / option | What it does                                   |
| -------------- | ---------------------------------------------- |
| Field label    | Name of the new field.                         |
| Required       | Makes the field compulsory for every employee. |
| Add Field      | Adds the field to employee forms.              |
| Remove         | Removes the field from future employee forms.  |

## 4. Employee management

### Employee list

The employee list shows the employees of the institute.

The list can show these columns:

| Column                 | Shown at first? |
| ---------------------- | :-------------: |
| Employee               |       Yes       |
| Rank                   |       Yes       |
| Designation            |       Yes       |
| Date of Birth          |       No        |
| Gender                 |       No        |
| Contact                |       Yes       |
| WhatsApp               |       No        |
| PAN                    |       No        |
| PF                     |       No        |
| NPS                    |       No        |
| Created                |       Yes       |
| Custom employee fields |       No        |

#### Choose columns

The **Choose Columns** button lets the user show or hide columns. This is useful when the user wants to focus on only certain information.

#### Search employees

The **Search employees** box can search the information in the columns currently being shown, including custom employee fields.

Search can find:

- Employee name
- Rank
- Designation
- Date of Birth
- Gender
- Contact number
- WhatsApp number
- PAN, PF, or NPS number
- Created date
- Custom field values

The search works even if capital letters are used differently.

#### Employee actions

Each employee has an action menu with:

- **Edit:** change the employee's information.
- **Delete:** permanently remove the employee after confirmation.

The portal clearly warns that deleting an employee cannot be undone.

#### Download employee list

The **Download CSV** button downloads the employee list.

- It includes the columns selected by the user.
- The file can be opened in Excel or other spreadsheet programs.
- The file name is `employee-directory.csv`.
- The complete employee list is downloaded, not only the page currently being viewed.

The list shows up to 10 employees at a time and has Previous and Next buttons.

### Add an employee

Select **Add Employee** to open the employee form.

#### Employee fields

| Field              | What to enter                                            | Required? |
| ------------------ | -------------------------------------------------------- | :-------: |
| Surname            | Employee's surname.                                      |    Yes    |
| First name         | Employee's first name.                                   |    Yes    |
| Middle name        | Employee's middle name.                                  |    Yes    |
| Date of Birth      | Employee's date of birth.                                |    Yes    |
| Gender             | Male or Female.                                          |    Yes    |
| Designation        | Select a designation from the institute list.            |    Yes    |
| Seniority Rank     | A whole number greater than zero. Rank 1 is the highest. |    Yes    |
| PAN number         | Employee PAN number.                                     |    No     |
| PF number          | Employee PF number.                                      |    No     |
| NPS account number | Employee NPS account number.                             |    No     |
| WhatsApp number    | Employee WhatsApp number.                                |    No     |
| Contact number     | Employee contact number.                                 |    No     |

Important points:

- Date of Birth must be a valid date.
- An employee cannot be saved until a designation has been created and selected.
- The employee list uses Seniority Rank to arrange employees.
- PAN, PF, NPS, WhatsApp, and Contact details are optional.

#### Custom fields on the employee form

Any custom fields created by the institute appear below the standard employee fields.

- A required custom field is marked with an asterisk.
- Required custom fields must be completed before saving.
- The information is saved with the employee.
- Custom fields can be shown in the employee list and downloaded in the CSV file.

#### Employee form buttons

- **Create Employee:** saves the new employee.
- **Back:** returns to the employee list.
- **Cancel:** returns to the employee list without saving.

### Edit an employee

The Edit Employee screen has the same fields as the Add Employee screen:

- Surname
- First name
- Middle name
- Date of Birth
- Gender
- Designation
- Seniority Rank
- PAN number
- PF number
- NPS account number
- WhatsApp number
- Contact number
- Custom employee fields

The employee's existing information is already filled in. The user can change it and select **Save Changes**.

## 5. Payroll

Payroll lets the institute enter earnings and deductions for each employee.

### Choose the payroll period

First select:

| Selection      | What it means                                 |
| -------------- | --------------------------------------------- |
| Employee       | The employee whose payroll is being prepared. |
| Financial year | The year for which payroll is being entered.  |
| Month          | A month from the selected financial year.     |

The available months are:

April, May, June, July, August, September, October, November, December, January, February, and March.

Payroll values are effective by month. A saved set remains in use for later months until another month introduces a change. Saving an older month removes later saved payroll changes for that employee and financial year, making the older month the new baseline for every following month.

### Payroll totals

After selecting an employee, the portal shows:

- Employee name
- Total Earnings
- Total Deductions
- Net Pay

Net Pay is calculated as Total Earnings minus Total Deductions. The totals update while amounts are entered.

### Earnings fields

The Earnings section contains:

| Field                   |
| ----------------------- |
| Basic Pay               |
| D.A.                    |
| D.A. Difference Arrears |
| HRA                     |
| C.L.A                   |
| V.A/T.A. Arrear         |

The section also shows **Total Earnings**.

### Deduction fields

The Deductions section contains:

| Field            |
| ---------------- |
| Recovery         |
| G.P.F            |
| R.D              |
| C.M. Fund        |
| Income Tax / TDS |
| Professional Tax |
| L.I.C            |

The section also shows **Total Deductions**.

### Enter payroll amounts

- Amounts are entered in Indian Rupees.
- Amount inputs use Indian digit grouping after entry, such as `1,25,000.00`.
- Whole amounts and amounts with up to two decimal places can be entered.
- Empty amounts are treated as zero.
- Incorrect amounts are highlighted before saving.
- Earnings and Deductions show the effective previous month's amount in a read-only column.
- April shows no previous-month amount because it begins the selected financial year.

### Add custom payroll fields

The institute can add its own Earnings or Deduction fields, such as an allowance or a special recovery.

To add one:

1. Choose **Earnings** or **Deductions**.
2. Enter the **Field label**.
3. Select **Add Field**.

Custom payroll fields:

- Are available to every employee in the institute from the selected month.
- Can have a different amount for each employee.
- Can be removed from a selected month while remaining visible in older months.
- Can be restored later with empty employee amounts.

### Save payroll

Select **Save Payroll** to save the amounts for the selected employee and month. The saved values continue into later months until another saved month changes them. If later months already contain saved changes, saving this month resets those later values so they inherit from this new baseline until edited again.

The portal:

- Stops the user from saving an incorrect amount.
- Shows the values effective for the selected employee, financial year, and month.
- Warns before discarding unsaved changes when switching the employee, financial year, or month.
- Shows a success message after saving.

### Download payslips

After payroll is saved, the user can download:

- **Monthly Payslip**
- **Annual Payslip**

Each payslip includes:

- Institute name
- Institute address
- TAN number
- Employee name
- Financial year
- Month, for the monthly payslip
- Earnings and Total Earnings
- Deductions and Total Deductions
- Net Salary
- Total row

The Annual Payslip shows the values effective in each of the 12 months. Months after the selected month are shown in gray as projections and remain included in the annual total.

The user must save payroll before downloading a payslip. The user must also save any changes made after the last save.

## 6. Reports

### Institute reports

The institute team can see reports for its own institute. It cannot see another institute's report.

The report shows one row for each employee:

| Column                | Simple meaning                                 |
| --------------------- | ---------------------------------------------- |
| Name                  | Employee name.                                 |
| Gross Salary          | Total earnings for the year.                   |
| Deduction             | Total deductions for the year.                 |
| Net Salary            | Earnings after deductions.                     |
| TDS Deducted Till Now | Income tax/TDS already entered.                |
| Total Tax             | Calculated tax for the year.                   |
| Pending TDS           | Tax still remaining after TDS already entered. |

Yearly earnings, deductions, net salary, and TDS are calculated by summing the values effective in each of the 12 payroll months.

The user can:

- Choose the financial year.
- Search by employee name or any displayed information.
- Move through the report pages.
- Download the report as `fy-payroll-report.csv`, which can be opened in Excel.

### Admin reports

The Admin sees the same report information but first chooses which institute to view.

### Tax calculation

The current tax report calculation is set up for FY 2026-2027. The report uses the payroll amounts entered in the portal to show Total Tax and Pending TDS.

## 7. Features not included at present

The current version does not include:

- Public sign-up for new users.
- Forgot password or self-service password recovery.
- Editing institute details after the institute is created.
- Turning an institute login back on after it has been deactivated.
- Uploading employees in bulk.
- Updating or deleting many employees at one time.
- Uploading employee photos or documents.
- Changing the name or Required setting of an existing custom employee field.
- Manually changing the tax amount or choosing a different tax method.

## 8. Quick view: who can use what

| Feature                                |             Admin             |       Institute team       |
| -------------------------------------- | :---------------------------: | :------------------------: |
| Sign in and sign out                   |              Yes              |            Yes             |
| Home page                              |              Yes              |            Yes             |
| Add and manage institutes              |              Yes              |             No             |
| View institute details                 |              Yes              |             No             |
| Reset institute password               |              Yes              |             No             |
| Activate or deactivate institute login |              Yes              |             No             |
| Add and arrange designations           |              No               |            Yes             |
| Add, edit, and delete employees        |              No               |            Yes             |
| Add custom employee fields             |              No               |            Yes             |
| Enter payroll                          |              No               |            Yes             |
| Add custom payroll fields              |              No               |            Yes             |
| Download payslips                      |              No               |            Yes             |
| View reports                           | Yes, for a selected institute | Yes, for its own institute |
| Download reports                       |              Yes              |            Yes             |
