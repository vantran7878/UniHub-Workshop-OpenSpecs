## Why

To enhance security, observability, and compliance, the UniHub platform requires a comprehensive audit logging system. Currently, some actions are logged synchronously which can impact API response times. This change introduces a dedicated, asynchronous audit logging service to reliably track critical security events without degrading user experience.

## What Changes

- Create a centralized `auditLog(event, metadata)` service for asynchronous logging to the `audit_logs` table.
- Log the following events with specific metadata:
  - `REGISTER_SUCCESS` (user_id, ip)
  - `LOGIN_SUCCESS` (user_id, role, ip)
  - `LOGIN_FAILURE` (email_attempted, ip, reason) - *reason is not returned in API response*
  - `LOGOUT` (user_id, ip)
  - `TOKEN_REFRESH` (user_id, ip)
  - `TOKEN_BLACKLISTED` (user_id, reason)
  - `ROLE_CHANGED` (target_user_id, old_role, new_role, changed_by)
  - `PASSWORD_CHANGED` (user_id, changed_by)
  - `ACCOUNT_CREATED` (new_user_id, role, created_by)
- Ensure no plaintext passwords, raw tokens, or other sensitive information is ever written to the audit log.
- Restrict application APIs from deleting audit logs (append-only from the application's perspective).
- **BREAKING**: Refactor existing synchronous `prisma.auditLog.create` calls to use the new asynchronous service.

## Capabilities

### New Capabilities
- `audit-logging`: Asynchronous audit logging service and requirements for tracking security-critical events.

### Modified Capabilities
<!-- No modified capabilities -->

## Impact

- **Performance**: Improved API response times for authentication actions due to asynchronous logging.
- **Code**: Refactoring required across multiple authentication and user management routes to utilize the new `auditLog` service.
- **Security**: Increased visibility into authentication failures and role changes for security monitoring.

## Non-goals

- Implementing an administrative UI to view audit logs (this is just the foundational logging mechanism).
- Aggregating or shipping logs to external SIEM systems like Splunk or Datadog at this stage.
