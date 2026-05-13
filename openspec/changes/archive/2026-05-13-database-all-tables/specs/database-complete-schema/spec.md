## ADDED Requirements

### Requirement: Full Relational Database Schema
The system MUST include a comprehensive set of tables corresponding to the core domain entities defined in the architectural blueprint.

#### Scenario: Schema validation
- **WHEN** the Prisma migration is applied to the PostgreSQL database
- **THEN** tables for `workshops`, `registrations`, `payments`, `checkins`, `notifications`, `workshop_summaries`, and `student_import_logs` are created with correct columns, types, and constraints.

### Requirement: Relational Integrity and Constraints
The system MUST enforce business rules at the database level using relationships and constraints.

#### Scenario: Preventing duplicate workshop registrations
- **WHEN** an attempt is made to insert a `registration` record for a user and workshop that already has a registration
- **THEN** the database MUST reject the insertion due to a unique constraint violation on `[userId, workshopId]`.

#### Scenario: Cascading deletes
- **WHEN** a `user` or `workshop` is deleted from the system
- **THEN** the database MUST automatically cascade the deletion to their associated `registrations` to prevent orphaned records.
