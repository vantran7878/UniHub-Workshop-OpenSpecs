## 1. Database Schema

- [x] 1.1 Create migration for the `checkins` table (columns: `id`, `registration_id`, `user_id`, `workshop_id`, `checkin_time`, `device_id`, `created_at`)
- [x] 1.2 Add unique constraint on `checkins.registration_id` to prevent duplicate check-ins
- [x] 1.3 Add index on `registrations.qr_code` and `registrations.workshop_id` for fast lookup

## 2. Check-in Controller & Logic

- [x] 2.1 Implement `preload` function to fetch confirmed registrations for a workshop
- [x] 2.2 Implement `processCheckin` function with transactional logic (insert checkin + update registration status)
- [x] 2.3 Implement `syncOffline` function to handle batch records with `ON CONFLICT DO NOTHING`

## 3. Routes & Authorization

- [x] 3.1 Create `checkinRoutes.js` and define `GET /preload`, `POST /`, and `POST /sync-offline`
- [x] 3.2 Apply `verifyJWT`, `checkBlacklist`, `loadUser`, and `requireRole('staff')` middleware to all check-in routes
- [x] 3.3 Register check-in routes in the main `index.js`

## 4. Verification & Testing

- [x] 4.1 Verify online check-in returns 200 on success and 409 on duplicate
- [x] 4.2 Verify sync endpoint correctly handles partial batches where some records are already synced
- [x] 4.3 Verify that a student or admin token receives 403 Forbidden when accessing check-in endpoints
