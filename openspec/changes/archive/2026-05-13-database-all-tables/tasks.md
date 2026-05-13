## 1. Prisma Enums

- [x] 1.1 Add `Role` enum (`student`, `admin`, `staff`) to `schema.prisma`.
- [x] 1.2 Add `WorkshopStatus` enum (`active`, `cancelled`, `completed`) to `schema.prisma`.
- [x] 1.3 Add `RegistrationStatus` enum (`pending`, `confirmed`, `cancelled`, `no_show`, `failed`) to `schema.prisma`.
- [x] 1.4 Add `PaymentStatus` enum (`pending`, `processing`, `success`, `failed`, `refunded`) to `schema.prisma`.

## 2. Core Entities

- [x] 2.1 Add `User` model to `schema.prisma`.
- [x] 2.2 Add `AuditLog` model to `schema.prisma`.
- [x] 2.3 Add `Workshop` model to `schema.prisma`.
- [x] 2.4 Add `Registration` model to `schema.prisma` with `@@unique([userId, workshopId])`.
- [x] 2.5 Add `Payment` model to `schema.prisma` with `idempotencyKey` unique constraint.

## 3. Peripheral Entities

- [x] 3.1 Add `Checkin` model to `schema.prisma` with `@@unique([registrationId])`.
- [x] 3.2 Add `Notification` model to `schema.prisma` with JSON `channels` field.
- [x] 3.3 Add `WorkshopSummary` model to `schema.prisma`.
- [x] 3.4 Add `StudentImportLog` model to `schema.prisma`.

## 4. Migration and Validation

- [x] 4.1 Run `npx prisma format` and `npx prisma validate` to ensure schema correctness.
- [x] 4.2 Generate the comprehensive database migration using `npx prisma migrate dev --name init_complete_schema`.
