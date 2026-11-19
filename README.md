# Staff payroll

NestJS API for a company staff hierarchy and salary calculation on any date.

There are three roles. Everyone has a name, a join date, and a base salary. A new member inherits the company default when a base salary is not sent. Employees cannot have subordinates. Managers and sales can, and anyone can have a supervisor.

Salaries on a given date:

| Role | Tenure | Extra |
| --- | --- | --- |
| Employee | +3% of base per full year, capped at +30% | — |
| Manager | +5% of base per full year, capped at +40% | +0.5% of the salaries of direct subordinates |
| Sales | +1% of base per full year, capped at +35% | +0.3% of the salaries of subordinates at every level |

A year counts only after the anniversary of the join date. Someone whose join date is still in the future is not employed on that date: their salary is 0 and they are left out of the company total. The subordinate percentage is applied to salaries that are already fully calculated, so a sales lead above a manager receives 0.3% of that manager's salary including the manager's own 0.5%.

## Architecture

```
src/
  companies/    company resource
  staff/        staff resource and the rules for writing the hierarchy
  salary/       role rules, pure salary calculator, payroll routes
  prisma/       Prisma client
```

`calculateSalaries` is a pure function. It walks the tree from the leaves upward on an explicit stack and memoizes each person, so a salary is computed once. Nest services only load rows and map the result to JSON. Role rates live in one table: tenure, cap, and how deep the subordinate bonus reaches. A new role is one row in that table.

SQLite via Prisma. Amounts are stored as integer cents and the API speaks ordinary currency units (`10000` means 10000.00). A salary cannot exceed 21474836.47, because Prisma reads SQLite integers as 32-bit values, and more than two decimal places are rejected. Percentages are applied in basis points (`0.5%` = 50 bps) so the result does not depend on binary floats.

Changing a supervisor checks the hierarchy and writes the row in one serializable transaction. A supervisor must be a manager or sales in the same company, and the new link must not form a cycle. A member who still has subordinates cannot be deleted. The database link uses `ON DELETE SET NULL`, so deleting a whole company can cascade through the staff table; the service still refuses to delete one person who has reports.

## API

```
POST   /companies                              { name, defaultBaseSalary }
GET    /companies
GET    /companies/:companyId
GET    /companies/:companyId/payroll?on=YYYY-MM-DD

POST   /companies/:companyId/staff             { name, type, joinedAt, baseSalary?, supervisorId? }
GET    /companies/:companyId/staff
GET    /companies/:companyId/staff/:staffId
PATCH  /companies/:companyId/staff/:staffId    { name?, joinedAt?, baseSalary?, supervisorId? }
DELETE /companies/:companyId/staff/:staffId
GET    /companies/:companyId/staff/:staffId/salary?on=YYYY-MM-DD
```

`type` is `employee`, `manager`, or `sales`. Send `"supervisorId": null` to detach a supervisor. Payroll and salary responses include tenure years, the tenure bonus, the subordinate bonus, and the total.

## Run

Copy `.env.example` to `.env` first. Prisma reads `DATABASE_URL` from that file, and `.env` is not committed.

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

The API listens on `0.0.0.0` and `PORT` (default `3000`). Optional sample company:

```bash
npx prisma db seed
```

```bash
npm test
npm run test:e2e
```

## Advantages

- The salary rules live in one pure function, so the percentages, caps, and date edges are tested without HTTP or SQLite.
- One staff table with a `type` column matches the data: the three roles share the same fields and differ only in the formula.
- Cents in the database and basis points in the formula keep 0.3% and 0.5% stable.
- The write path rejects cycles and employees-as-supervisors inside the same transaction as the write, so two simultaneous supervisor changes cannot record a cycle.

## Drawbacks, and what production would change

- No authentication or audit log. A real system needs to know who changed a supervisor or a base salary, and from which date that change applies. Right now a base salary is a single current value, and a past date only changes tenure, not the historical base.
- SQLite is local and single-writer. Postgres (or another server database) is the production default, still behind Prisma.
- The whole company is loaded to compute one salary. That is correct and simple at this size. A large org would want a stored tree (closure table or materialized path) and a cached payroll per date.
- Deleting a company cascades to its staff. There is no soft delete and no protection against removing the last record of a payroll.
- Money with more than two decimal places is rejected. Each bonus is then rounded to the cent. The API does not carry a currency code. The stored amount is capped by a 32-bit integer.
