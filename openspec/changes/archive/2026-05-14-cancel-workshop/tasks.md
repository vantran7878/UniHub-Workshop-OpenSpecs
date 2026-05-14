## 1. Database Schema

- [x] 1.1 Add `cancelledAt` (DateTime?) and `cancelledReason` (String?) to `Workshop` model in `prisma/schema.prisma`.
- [x] 1.2 Run `npx prisma generate` to update the client.

## 2. API Implementation

- [x] 2.1 Define `CancelWorkshopSchema` using Zod in `src/lib/validations/workshop.ts`.
- [x] 2.2 Implement `PATCH /api/admin/workshops/:id/cancel` endpoint.
- [x] 2.3 Implement the transaction logic to cancel workshop and all associated registrations.
- [x] 2.4 Implement the asynchronous notification trigger logic.
- [x] 2.5 Implement the asynchronous refund trigger logic for `paid` workshops.
- [x] 2.6 Integrate `auditLog` service for `WORKSHOP_CANCELLED` event.

## 3. Integration & Testing

- [x] 3.1 Verify that duplicate cancellation calls return `409 Conflict`.
- [x] 3.2 Verify that all registrations are correctly marked as `cancelled`.
- [x] 3.3 Verify notification and refund triggers are fired (mocked in tests).
- [x] 3.4 Verify audit log contains reason and registration count.
