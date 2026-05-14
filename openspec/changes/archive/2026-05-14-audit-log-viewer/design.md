## Context

The `auditLog` service already records critical workshop events. This design focuses on exposing those logs to administrators and ensuring a highly sensitive action (`CAPACITY_CHANGED`) is explicitly recorded for easier searching.

## Goals / Non-Goals

**Goals:**
- Provide a paginated API to fetch audit logs with flexible filtering.
- Implement explicit logging for capacity changes within the existing workshop update handler.
- Ensure the API is restricted to users with the `admin` role.

**Non-Goals:**
- Implementation of a frontend UI for the audit log viewer (API only).
- Implementation of audit log archiving or cleanup policies in this phase.

## Decisions

**1. Explicit Capacity Change Logging**
- *Decision*: In the workshop update handler, if the `capacity` field is modified, trigger a separate `CAPACITY_CHANGED` audit log event.
- *Rationale*: Facilitates targeted monitoring of capacity adjustments, which are sensitive operations impacting potential revenue and attendance.

**2. Query Parameter Strategy**
- *Decision*: Support filtering by `action`, `actor_id`, `resource_id`, and date ranges (`from`/`to`). Standard pagination (`page`/`limit`) will be enforced.
- *Rationale*: Balances search flexibility with database performance.

**3. Information Enrichment**
- *Decision*: Include actor (User) information in the returned log entries.
- *Rationale*: Improves the utility of the logs by providing human-readable names alongside UUIDs.

## Risks / Trade-offs

- **[Risk] Database Performance**: Large audit log tables can become slow to query.
  - *Mitigation*: Enforce indices on frequently filtered columns (`action`, `actorId`, `resourceId`, `createdAt`) and require pagination on all requests.
