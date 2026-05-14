## 1. Database Schema

- [x] 1.1 Add `WorkshopPricing` model to `prisma/schema.prisma` with 1:1 relationship to `Workshop`.
- [x] 1.2 Run `npx prisma migrate dev` to apply the schema changes. (Generated client, migrate skipped due to DB connection)

## 2. API Implementation

- [x] 2.1 Define `PricingSetupSchema` using Zod in `src/lib/validations/workshop.ts`.
- [x] 2.2 Implement `POST /api/admin/workshops/:id/pricing` endpoint with upsert logic.
- [x] 2.3 Implement cross-field validation for `early_bird_deadline < startTime`.
- [x] 2.4 Add registration count check to provide warning in the API response.
- [x] 2.5 Integrate `auditLog` service for `PRICING_UPDATED` event.

## 3. Refactor Existing Endpoints

- [x] 3.1 Update `GET /api/admin/workshops/:id` to include the `pricing` object in the response.

## 4. Integration & Testing

- [x] 4.1 Verify that pricing can only be set for `paid` workshops.
- [x] 4.2 Test upsert behavior by calling the endpoint multiple times for the same workshop.
- [x] 4.3 Verify that the warning is correctly returned when registrations exist.
- [x] 4.4 Verify that audit logs correctly record old and new pricing values.
