## Why

The UniHub Workshop system requires a complete and robust relational database schema to support its core domains: Workshop Management, Registration, Payments, Check-ins, Notifications, and AI Summaries. Establishing the complete schema upfront ensures data integrity and relationships are correctly mapped before any business logic or API endpoints are developed.

## What Changes

- Implement the complete Prisma schema for all system entities based on the technical design document.
- Tables to be created/updated: `users`, `audit_logs`, `workshops`, `registrations`, `payments`, `checkins`, `notifications`, `workshop_summaries`, and `student_import_logs`.
- Define all foreign key relationships, indexes, and unique constraints (e.g., ensuring a student cannot register for the same workshop twice, tracking payment idempotency keys).
- Generate the initial Prisma migration for the entire database structure.

## Non-goals

- We will **NOT** implement any API routes, controllers, or frontend components in this change. This is strictly a database layer update as requested.

## Capabilities

### New Capabilities
- `database-complete-schema`: Defines the Prisma schema, relationships, and constraints for the entire UniHub Workshop data model.

### Modified Capabilities
- `database-schema`: Extending the foundational schema to include all business entities.

## Impact

- **Database**: Creates all necessary tables, relationships, and indexes in PostgreSQL.
- **Code**: Updates `schema.prisma` and generates a comprehensive migration file.
