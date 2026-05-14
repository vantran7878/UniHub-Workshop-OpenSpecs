## Context

The system requires a centralized audit trail for all workshop-related administrative actions. This design focuses on mapping the `auditLog` service to specific workshop events and defining the standardized API for log retrieval as requested by the user.

## Goals / Non-Goals

**Goals:**
- Finalize the `auditLog` integration across all workshop management endpoints.
- Implement the `GET /api/admin/audit-logs` endpoint with the specific query parameter and response schema requested.
- Ensure sensitive data is sanitized before logging.

**Non-Goals:**
- Implementation of complex log analytics or alerting.
- Frontend UI implementation (API focus).

## Decisions

**1. Query Parameter Mapping**
- *Decision*: Map the user's requested parameters to the internal `AuditLog` model:
  - `entity_type` -> `resourceType`
  - `entity_id` -> `resourceId`
  - `event_type` -> `action`
  - `admin_id` -> `actorId`
- *Rationale*: Maintains consistency with the established database schema while exposing the API in the format required by the requirements.

**2. Response Schema Standardization**
- *Decision*: Transform the internal `AuditLog` records to match the requested response format exactly, including field names like `event_type`, `entity_type`, and `entity_id`.
- *Rationale*: Ensures compatibility with the intended frontend/external consumer.

**3. Metadata Sanitization**
- *Decision*: Leverage the existing `sanitizeMetadata` helper to strip sensitive keys (password, token, secret, etc.) before persistence.
- *Rationale*: Prevents the accidental storage of sensitive credentials or tokens in the audit logs.

## Risks / Trade-offs

- **[Risk] High Volume Performance**: Querying a large audit log table with multiple filters can become slow.
  - *Mitigation*: Ensure appropriate indexing on `action`, `actorId`, `resourceId`, and `createdAt`. Enforce mandatory pagination with a maximum limit of 100 entries per request.
