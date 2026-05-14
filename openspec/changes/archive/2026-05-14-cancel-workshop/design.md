## Context

Workshops currently do not have a cancellation flow. This is a critical requirement for handling unforeseen circumstances and ensuring user trust through proper notification and refund processes.

## Goals / Non-Goals

**Goals:**
- Implement a permanent cancellation mechanism for workshops.
- Automate the transition of registrations to a `cancelled` state.
- Integrate with notification and refund subsystems using an asynchronous pattern.
- Ensure auditability of cancellation events.

**Non-Goals:**
- Allowing reversal of a cancellation.
- Real-time synchronous delivery of emails or refund confirmations.

## Decisions

**1. Data Model Extension**
- *Decision*: Add `cancelledAt` (DateTime?) and `cancelledReason` (String?) to the `Workshop` model.
- *Rationale*: Provides a standard way to store metadata about the cancellation for reporting and display purposes.

**2. Registration State Transition**
- *Decision*: Use a single database transaction to update both the `Workshop` status and all its associated `Registration` records.
- *Rationale*: Ensures data consistency. We don't want a cancelled workshop with active registrations.

**3. Asynchronous Integration Pattern**
- *Decision*: Use a "fire-and-forget" pattern to trigger notifications and refunds after the transaction commits.
- *Rationale*: Prevents the HTTP response from being blocked by slow external service calls (Email API, Payment Gateway).

**4. Audit Logging Content**
- *Decision*: Include the `registration_count` in the `WORKSHOP_CANCELLED` audit event.
- *Rationale*: Useful for determining the scale of impact (financial and user count) directly from the audit log without joins.

## Risks / Trade-offs

- **[Risk] Failure in the async notification/refund trigger**: If the async call fails after the DB transaction, users might not be notified.
  - *Mitigation*: Ensure the async logic has robust internal error handling and logging.
