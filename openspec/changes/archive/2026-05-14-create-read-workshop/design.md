## Context

The system needs to manage workshops, which are the core entities of the UniHub platform. The implementation must handle creation (by admins), listing with filters, and detailed retrieval.

## Goals / Non-Goals

**Goals:**
- Implement secure, validated workshop creation for admins.
- Support efficient listing with pagination and common filters (status, date, pricing).
- Provide detailed workshop views including associated data like pricing and registration counts.
- Ensure all creation actions are audit-logged.

**Non-Goals:**
- Updating or deleting workshops.
- Public-facing API for workshop discovery (restricted to admin for now).

## Decisions

**1. Data Validation Strategy**
- *Decision*: Use `zod` for request body validation.
- *Rationale*: Consistent with existing auth patterns in the codebase. Ensures type safety and clear error messages.

**2. Audit Logging Integration**
- *Decision*: Use the newly created asynchronous `auditLog` service.
- *Rationale*: Provides non-blocking audit trails as per the recently implemented security standards.

**3. Pagination and Filtering**
- *Decision*: Use standard Prisma query options for pagination (`skip`, `take`) and filtering (`where`).
- *Rationale*: Efficient and leverages the power of the existing ORM.

**4. Registration Counts**
- *Decision*: Compute registration counts on-the-fly using Prisma's `_count` aggregation or subqueries.
- *Rationale*: Ensures data accuracy without the complexity of managing cached counters for now.

## Risks / Trade-offs

- **[Risk] Performance of Registration Counts**: As the number of registrations grows, joining or counting in every list item might slow down the query.
  - *Mitigation*: Use Prisma's optimized aggregation features. Implement database indexes on foreign keys.
