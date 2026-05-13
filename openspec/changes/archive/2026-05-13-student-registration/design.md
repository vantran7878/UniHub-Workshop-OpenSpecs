## Context

The UniHub system must allow students to register for an account using a public endpoint (`POST /auth/register`). This requires secure password handling, robust validation, and strict role assignment to prevent privilege escalation.

## Goals / Non-Goals

**Goals:**
- Implement `POST /auth/register` to accept `email`, `password`, and `full_name`.
- Enforce email format validation and uniqueness checks.
- Enforce password strength policies (min 8 chars, 1 uppercase, 1 number, 1 special char).
- Hash passwords securely using bcrypt (cost factor 12) prior to storage.
- Log registration success via the audit logs system.

**Non-Goals:**
- Automatic login/JWT issuance upon registration.
- Email verification logic.
- Supporting staff/admin registration through this endpoint.

## Decisions

- **Validation Library**: We will use `zod` for request body validation. It provides strong typing and declarative schema validation, allowing us to cleanly enforce the password regex and email format.
- **Database Querying**: We will use Prisma's `findUnique` to check if the email exists, returning a `409 Conflict` if found.
- **Audit Logging**: We will write to the `AuditLog` table immediately after user creation to track the `REGISTER_SUCCESS` action.
- **Role Assignment**: The `role` field in the Prisma creation query will be hardcoded to `Role.student` to completely ignore any `role` field passed by a malicious client.

## Risks / Trade-offs

- [Risk] **Brute-force attacks or script spam**: Public registration endpoints are targets for automated account creation.
  - Mitigation: Future implementation of rate limiting (e.g., via Redis) or CAPTCHA. For this specific iteration, we accept the risk.
- [Risk] **Password exposure in logs**: Improper error handling might log the raw request body.
  - Mitigation: Ensure any logging middleware sanitizes or ignores the `password` field from the request body.
