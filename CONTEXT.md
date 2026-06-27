# Paybuddy Context

## Domain Terms

- **Institution**: A customer organization that uses Paybuddy to manage payroll-related Employee data.
- **Institution account**: The admin-managed account row and Login Access for an Institution, backed by a Better Auth user.
- **Employee**: A person whose payroll-related details are managed by an Institution.
- **Employee record**: The stored base fields, Designation, and Custom Field values for one Employee.
- **Designation**: An Institution-defined role/title option used on Employee records and ordered in Employee Setup.
- **Custom Field**: An Institution-defined Employee record field with a label, generated key, required flag, active flag, and display order.
- **Login Access**: Whether the Better Auth user for an Institution account is allowed to sign in.

## Architecture Notes

- Employee record behavior lives behind the Employee record module, with the tRPC router acting as a narrow procedure adapter.
- Institution account behavior lives behind the Institution account module. Bootstrap user endpoints remain separate operational paths.
- Access context is a watch item. Current duplication across `adminProcedure`, `userProcedure`, `institutionProcedure`, `AdminRouteGuard`, and `UserRouteGuard` is real but shallow. Refactor only when role-routing rules or Institution lookup rules grow.
