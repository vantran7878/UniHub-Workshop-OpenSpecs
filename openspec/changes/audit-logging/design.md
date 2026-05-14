## Context

The UniHub authentication and user management modules generate critical security events (login, register, token refresh, role changes). Currently, these events are logged synchronously using Prisma, which blocks the API response and impacts performance. The application requires an asynchronous logging service to ensure fast response times while maintaining a robust audit trail.

## Goals / Non-Goals

**Goals:**
- Provide an asynchronous `auditLog` service that writes to the `audit_logs` table.
- Define a clear metadata structure for various event types (e.g., `LOGIN_FAILURE`, `ROLE_CHANGED`).
- Prevent the logging of sensitive information like passwords or raw tokens.
- Ensure that audit logs cannot be modified or deleted via application APIs.

**Non-Goals:**
- Moving audit logs to an external storage system or messaging queue (like Kafka/RabbitMQ) at this time.
- Creating an administrative interface for viewing logs.

## Decisions

**1. Asynchronous Execution Mechanism**
- *Decision*: The `auditLog` service will wrap the database write operation (via Prisma) in a fire-and-forget promise (`prisma.auditLog.create().catch(console.error)`). Callers will not `await` this service.
- *Rationale*: This is the simplest and most effective way to decouple logging from the critical path of the API request without introducing heavy dependencies like a message broker.

**2. Data Sanitization**
- *Decision*: The `auditLog` service will explicitly sanitize the incoming metadata payload, stripping any fields named `password`, `token`, `hash`, or similar sensitive indicators before writing to the database.
- *Rationale*: Protects against the accidental leakage of sensitive data into the audit logs, ensuring compliance and security.

**3. Immutable Logs**
- *Decision*: Enforce immutability by strictly omitting any `update` or `delete` methods/endpoints for audit logs in the application layer.
- *Rationale*: Simple to implement and satisfies the requirement that logs cannot be deleted via the application API.

## Risks / Trade-offs

- **[Risk] Log loss in Serverless Environments**: If the Node process or serverless function terminates immediately after returning the API response, background promises (fire-and-forget) might be aborted.
  - *Mitigation*: This is an acceptable trade-off for performance in the current architecture. If strict delivery guarantees are required in the future, integration with a dedicated logging queue or using Next.js `waitUntil` mechanisms will be necessary.
