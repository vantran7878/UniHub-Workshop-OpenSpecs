## Context

The UniHub Workshop system's database schema needs to be fully modeled in Prisma to support the application's core domains. While the `users` and `audit_logs` tables have been scaffolded, the remaining tables (`workshops`, `registrations`, `payments`, `checkins`, `notifications`, `workshop_summaries`, `student_import_logs`) must be created to establish the relational integrity of the system before API development begins.

## Goals / Non-Goals

**Goals:**
- Translate the SQL schema design from `4_database_design.md` into Prisma schema syntax (`schema.prisma`).
- Establish correct relations (1:N, 1:1) between `users`, `workshops`, `registrations`, `payments`, etc.
- Define proper cascading behaviors for deletions (e.g., deleting a workshop deletes its registrations).
- Implement database-level constraints (e.g., unique constraints on `[user_id, workshop_id]` in `registrations`).

**Non-Goals:**
- Implementing ANY API endpoints or backend logic to interact with these tables.
- Building frontend views.

## Decisions

- **Prisma Schema approach**: We will use Prisma's strict typing to enforce relationships. For example, `Registration` will have an explicit unique constraint `@@unique([userId, workshopId])` to prevent double booking at the database level.
- **Enums**: We will use PostgreSQL native enums via Prisma for status fields like `WorkshopStatus` (`active`, `cancelled`, `completed`), `RegistrationStatus` (`pending`, `confirmed`, `cancelled`, `no_show`, `failed`), and `PaymentStatus` to ensure data consistency.
- **JSONB vs Relational**: The `channels` field in `notifications` and `error_details` in `student_import_logs` will use `Json` type (JSONB in PostgreSQL) as their schema is flexible and doesn't require complex relational querying.

## Risks / Trade-offs

- [Risk] **Migration Conflicts**: Modifying the Prisma schema comprehensively might conflict with existing migrations if not applied correctly.
  - Mitigation: Ensure `prisma format` and `prisma validate` are run, and generate a single comprehensive migration script (`prisma migrate dev`) for these tables.
