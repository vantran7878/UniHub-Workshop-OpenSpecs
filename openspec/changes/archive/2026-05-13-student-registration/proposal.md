## Why

The UniHub Workshop system requires a secure, public endpoint to allow students to self-register. This provides the foundation for user onboarding and enables students to participate in workshops.

## What Changes

- Implement the `POST /auth/register` API endpoint.
- Validate incoming requests for proper email format and strong password policies (min 8 characters, uppercase, number, special character).
- Integrate `bcrypt` (cost factor 12) to securely hash passwords before storage.
- Enforce business logic to prevent privilege escalation: accounts are strictly created with the `student` role.
- Implement error handling for duplicate emails (`409 Conflict`) and validation failures (`400 Bad Request`).
- Integrate audit logging to record `REGISTER_SUCCESS` events.

## Non-goals

- We will not implement JWT token issuance in this endpoint. Registration and Login are kept explicitly separate.
- We will not implement an email verification step at this stage.

## Capabilities

### New Capabilities
- `student-registration`: Defines the behavior and security constraints for the public registration endpoint.

### Modified Capabilities

## Impact

- **API**: Adds one new route `POST /auth/register`.
- **Security**: Hardens registration with strict password policies and role constraints.
- **Database**: Adds new records to `users` and `audit_logs`.
