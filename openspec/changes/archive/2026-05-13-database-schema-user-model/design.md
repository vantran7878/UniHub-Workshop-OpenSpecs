## Context

The UniHub Workshop system is migrating to a PostgreSQL database managed by Prisma ORM. To support the upcoming authentication, workshop registration, and administrative features, we need to establish the foundational data tables: `users` and `audit_logs`.

## Goals / Non-Goals

**Goals:**
- Define the PostgreSQL schema for the `users` table including UUIDs, unique emails, and bcrypt hashed passwords.
- Define the `audit_logs` table schema for tracking administrative and security events.
- Implement an initial Prisma migration to create these tables.
- Create a database seed script to insert a default administrator account.

**Non-Goals:**
- Creating schemas for other domains (workshops, registrations, payments).
- Implementing the API routes for user registration or login (handled in subsequent features).

## Decisions

- **Primary Keys**: We will use UUIDs (`gen_random_uuid()`) instead of auto-incrementing integers for `id` fields. Why? UUIDs are non-guessable, which enhances security, especially for user IDs that might appear in URLs or tokens.
- **Passwords**: Stored exclusively as bcrypt hashes (cost factor 12). Plaintext passwords will never be persisted.
- **Roles**: Enforced via a `Role` enum in Prisma (`student`, `admin`, `staff`) to ensure data integrity at the database level.
- **Audit Logging Approach**: The `audit_logs` table will use a flexible `JSONB` column (`metadata`) to store varied event details without requiring strict schema migrations for new event types.

## Risks / Trade-offs

- [Risk] **Seed script exposing credentials**: The seed script might accidentally hardcode a weak or default password in version control.
  - Mitigation: The seed script should rely on environment variables for the default admin password (`ADMIN_DEFAULT_PASSWORD`), falling back to a generated password if not provided and printing it only once.
