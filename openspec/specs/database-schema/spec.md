### Requirement: Users Table Schema
The database MUST contain a `users` table with fields for identity and access control.

#### Scenario: Creating a user record
- **WHEN** a new user is inserted into the database
- **THEN** it must have a unique `id` (UUID), a unique `email`, a `password_hash`, a `role` constraint, and timestamps.

### Requirement: Audit Logs Table Schema
The database MUST contain an `audit_logs` table capable of storing varied security event metadata.

#### Scenario: Logging a security event
- **WHEN** an event is recorded in the `audit_logs` table
- **THEN** it must capture the `event_type`, `user_id` (if applicable), `ip_address`, and flexible `metadata` via a JSONB column.
