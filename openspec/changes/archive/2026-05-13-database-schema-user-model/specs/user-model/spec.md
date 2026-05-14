## ADDED Requirements

### Requirement: Admin Seeding
The system MUST provide a script to securely seed an initial administrator account.

#### Scenario: Running the database seed command
- **WHEN** the seed command is executed on a fresh database
- **THEN** it creates exactly one admin user with a properly hashed password, enabling initial system access.

### Requirement: Password Security
The system MUST NOT store passwords in plaintext under any circumstances.

#### Scenario: Database inspection
- **WHEN** inspecting the `users` table directly
- **THEN** the password column exclusively contains bcrypt-formatted hash strings.
