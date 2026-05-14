# audit-logging Specification

## Purpose
TBD - created by archiving change audit-logging. Update Purpose after archive.
## Requirements
### Requirement: Asynchronous Audit Logging
The system SHALL log all specified security events asynchronously without blocking the main API response.

#### Scenario: Logging does not block response
- **WHEN** a security event occurs (e.g., successful login)
- **THEN** the system initiates the log write operation in the background
- **AND** immediately proceeds to return the API response to the client

### Requirement: Event Metadata Logging
The system SHALL log specific metadata for each event type as follows:
- `REGISTER_SUCCESS`: `user_id`, `ip`
- `LOGIN_SUCCESS`: `user_id`, `role`, `ip`
- `LOGIN_FAILURE`: `email_attempted`, `ip`, `reason`
- `LOGOUT`: `user_id`, `ip`
- `TOKEN_REFRESH`: `user_id`, `ip`
- `TOKEN_BLACKLISTED`: `user_id`, `reason`
- `ROLE_CHANGED`: `target_user_id`, `old_role`, `new_role`, `changed_by`
- `PASSWORD_CHANGED`: `user_id`, `changed_by`
- `ACCOUNT_CREATED`: `new_user_id`, `role`, `created_by`

#### Scenario: Successful login logging
- **WHEN** a user successfully logs in
- **THEN** an audit log is created with the action `LOGIN_SUCCESS`
- **AND** the metadata includes the `user_id`, `role`, and `ip` address

#### Scenario: Failed login logging
- **WHEN** a login attempt fails
- **THEN** an audit log is created with the action `LOGIN_FAILURE`
- **AND** the metadata includes `email_attempted`, `ip`, and `reason`
- **AND** the `reason` is not returned in the API response payload to the client

### Requirement: Sensitive Data Sanitization
The system SHALL NOT include plaintext passwords, raw tokens, or any explicitly sensitive information in the audit logs.

#### Scenario: Sanitizing password changes
- **WHEN** a user changes their password
- **THEN** the audit log is created for `PASSWORD_CHANGED`
- **AND** the new or old password string is completely excluded from the log metadata

### Requirement: Immutable Audit Logs
The system SHALL enforce append-only semantics for audit logs from the application's perspective. No API endpoint shall be provided to update or delete audit log entries.

#### Scenario: Attempting to delete a log
- **WHEN** an administrator or user attempts to delete an audit log via the application API
- **THEN** the system denies the request (as no such endpoint exists)

