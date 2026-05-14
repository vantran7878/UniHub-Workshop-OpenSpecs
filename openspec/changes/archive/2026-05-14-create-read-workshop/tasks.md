## 1. Setup & Validations

- [x] 1.1 Define `CreateWorkshopSchema` using Zod in `src/lib/validations/workshop.ts`.
- [x] 1.2 Implement the validation logic for `ends_at > starts_at` and `capacity > 0`.

## 2. API Implementation

- [x] 2.1 Implement `POST /api/admin/workshops` handler with role checking and default status.
- [x] 2.2 Integrate the `auditLog` service for `WORKSHOP_CREATED` event.
- [x] 2.3 Implement `GET /api/admin/workshops` handler with pagination and filtering logic.
- [x] 2.4 Implement `GET /api/admin/workshops/:id` handler including pricing and registration count retrieval.

## 3. Integration & Testing

- [x] 3.1 Verify that only admins can access the new workshop endpoints.
- [x] 3.2 Test workshop creation with valid and invalid data, checking status codes and audit log entries.
- [x] 3.3 Verify that the workshop list correctly applies filters and pagination.
- [x] 3.4 Verify that workshop details return the expected structure and data accuracy.
