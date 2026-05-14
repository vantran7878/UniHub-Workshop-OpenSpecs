## 1. Setup & Utilities

- [x] 1.1 Add `zod` dependency to `package.json`.
- [x] 1.2 Create `src/lib/validations/auth.ts` and define the `RegisterSchema` using Zod (email format, password strength regex: min 8, upper, number, special char).

## 2. API Implementation

- [x] 2.1 Create the API route file `src/app/api/auth/register/route.ts`.
- [x] 2.2 Implement request parsing and validation using `RegisterSchema`.
- [x] 2.3 Implement database query to check if the email already exists using Prisma. If yes, return `409 Conflict`.
- [x] 2.4 Implement password hashing using `bcrypt` with cost factor 12.

## 3. Account Creation & Logging

- [x] 3.1 Implement Prisma transaction to create the new `User` (with `role: student`) and the corresponding `AuditLog` (`action: 'REGISTER_SUCCESS'`).
- [x] 3.2 Return `201 Created` with a success message (excluding the password).
