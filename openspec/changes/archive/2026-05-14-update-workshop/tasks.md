## 1. Database Schema

- [x] 1.1 Add `needsNotification` (Boolean, default false) to `Workshop` model in `prisma/schema.prisma`.
- [x] 1.2 Run `npx prisma generate` to update the client.

## 2. API Implementation

- [x] 2.1 Define `UpdateWorkshopSchema` using Zod in `src/lib/validations/workshop.ts`.
- [x] 2.2 Implement `PUT /api/admin/workshops/:id` endpoint.
- [x] 2.3 Implement the capacity validation logic (`capacity >= registration_count`).
- [x] 2.4 Implement the notification trigger logic for `startTime`, `endTime`, or `room` changes.
- [x] 2.5 Integrate `auditLog` service for `WORKSHOP_UPDATED` event with diffing.

## 3. Integration & Testing

- [x] 3.1 Verify that immutable fields (`status`, `pricing_type`) are ignored during update.
- [x] 3.2 Test capacity validation with existing registrations.
- [x] 3.3 Verify `needsNotification` flag is set correctly on critical changes.
- [x] 3.4 Verify audit log contains correct `old_value` and `new_value`.
