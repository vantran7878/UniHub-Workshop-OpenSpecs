## Why

To support paid workshops, the system needs a way to configure detailed pricing information, including base prices and early bird discounts. Currently, the database schema only supports a simple price field, which is insufficient for the required feature set.

## What Changes

- **Schema Update**: Introduce the `workshop_pricing` table to store base price, currency, early bird price, and early bird deadline.
- **API Endpoint**: Implement `POST /api/admin/workshops/:id/pricing` for upserting pricing details.
- **Validation**: Enforce business rules for prices (positive) and deadlines (must be before workshop starts).
- **Audit Logging**: Track pricing changes, including old and new values.
- **Warning System**: Inform administrators if they change prices for a workshop that already has registrations.

## Capabilities

### New Capabilities
- `workshop-pricing`: Capability for managing detailed workshop pricing structures.

### Modified Capabilities
- `workshop-management`: Modify retrieval specs to include structured pricing data in the workshop detail view.

## Impact

- **Database**: New table `workshop_pricing`.
- **API**: New endpoint `/api/admin/workshops/:id/pricing`.
- **Audit**: New audit event `PRICING_UPDATED`.

## Non-goals

- Managing payment gateway integrations.
- Handling refunds (to be covered in the cancellation feature).
