## Why

The UniHub Workshop system requires a foundational database schema to support its authentication and logging features. Establishing the `users` and `audit_logs` tables is the prerequisite for all subsequent features (like student registration, login, and token management).

## What Changes

- Create the `users` table to store core identity information (ID, email, hashed password, role, etc.).
- Create the `audit_logs` table to provide an immutable trail of security and administrative events.
- Set up Prisma migration scripts to initialize these tables.
- Create a seed script to generate an initial admin account for system bootstrapping.

## Non-goals

- We will not implement tables for workshops, registrations, or payments in this specific change.
- We will not implement the actual authentication API endpoints (login/register) yet—this is strictly the data layer foundation.

## Capabilities

### New Capabilities
- `database-schema`: Defines the foundational schema structure for users and audit logs.
- `user-model`: Defines the core user entity, role constraints, and seeding mechanisms.

### Modified Capabilities

## Impact

- **Database**: Adds two new core tables (`users`, `audit_logs`) to PostgreSQL.
- **Code**: Adds Prisma models, migrations, and a database seed script.
