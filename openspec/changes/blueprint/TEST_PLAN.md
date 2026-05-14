# UniHub Workshop — Test Plan

> This document specifies all test cases for the UniHub Workshop system.
> It covers unit tests, integration tests, and end-to-end (E2E) scenarios.
> Each section maps to a module in TASKS.md.

---

## Table of Contents

1. [Testing Strategy](#1-testing-strategy)
2. [Test: Auth Module](#2-test-auth-module)
3. [Test: Workshop Manager](#3-test-workshop-manager)
4. [Test: Booking / Registration](#4-test-booking--registration)
5. [Test: Payment (Sandbox)](#5-test-payment-sandbox)
6. [Test: Notification](#6-test-notification)
7. [Test: Check-in](#7-test-check-in)
8. [Test: AI PDF Summary](#8-test-ai-pdf-summary)
9. [Test: CSV Import](#9-test-csv-import)
10. [Test: Rate Limiting](#10-test-rate-limiting)
11. [Test: RBAC Middleware](#11-test-rbac-middleware)
12. [Integration & E2E Scenarios](#12-integration--e2e-scenarios)

---

## 1. Testing Strategy

### Test Levels

| Level | Description | Tools |
|-------|-------------|-------|
| Unit | Individual functions and service methods in isolation | Jest, mock Redis/DB |
| Integration | API endpoints with a real test database and Redis | Jest + Supertest, Docker Compose |
| E2E | Full user journeys through the UI | Playwright (web), Flutter integration tests (mobile) |

### Test Database

- Use a separate PostgreSQL database for tests (`unihub_test`).
- Run migrations before the test suite.
- Truncate all tables and reset Redis before each test.

### Test Data Conventions

```typescript
// Seeded users (available in all tests)
STUDENT  = { email: 'student@test.edu', password: 'Test1234!', role: 'student' }
ADMIN    = { email: 'admin@test.edu', password: 'Admin1234!', role: 'admin' }
STAFF    = { email: 'staff@test.edu', password: 'Staff1234!', role: 'staff' }

// Seeded workshop
FREE_WORKSHOP  = { is_paid: false, capacity: 30, status: 'active' }
PAID_WORKSHOP  = { is_paid: true, price: 50000, capacity: 10, status: 'active' }
FULL_WORKSHOP  = { capacity: 1, and 1 confirmed registration already exists }
```

---

## 2. Test: Auth Module

### TC-AUTH-01 — Successful student login

**Given:** Active student account exists in DB.
**When:** `POST /api/auth/login` with valid credentials.
**Then:**
- Status `200`.
- Response contains `accessToken` (JWT, RS256).
- Response contains `refreshToken` (32-byte hex string).
- Response contains `user.role = 'student'`.
- `accessToken` TTL ≤ 15 minutes.
- Redis key `refresh:{refreshToken}` exists with 7-day TTL.

---

### TC-AUTH-02 — Successful staff login — extended token TTL

**When:** `POST /api/auth/login` with valid `staff` credentials.
**Then:**
- Status `200`.
- `accessToken` TTL ≤ 8 hours (28800 seconds).

---

### TC-AUTH-03 — Login with wrong password

**When:** `POST /api/auth/login` with correct email but wrong password.
**Then:** Status `401`, no tokens returned.

---

### TC-AUTH-04 — Login with non-existent email

**When:** `POST /api/auth/login` with unknown email.
**Then:** Status `401`.

---

### TC-AUTH-05 — Login with inactive account

**Given:** `users.is_active = false` for the user.
**When:** `POST /api/auth/login` with correct credentials.
**Then:** Status `401`.

---

### TC-AUTH-06 — Refresh access token

**Given:** Valid `refreshToken` in Redis.
**When:** `POST /api/auth/refresh` with that token.
**Then:**
- Status `200`.
- New `accessToken` returned.
- The new access token is valid (can authenticate a protected endpoint).
- Refresh token is **not rotated** (same token still works after refresh).

---

### TC-AUTH-07 — Refresh with invalid token

**When:** `POST /api/auth/refresh` with a token not in Redis.
**Then:** Status `401`.

---

### TC-AUTH-08 — Logout invalidates tokens

**Given:** Authenticated student with valid access + refresh tokens.
**When:** `POST /api/auth/logout` with both tokens.
**Then:**
- Status `204`.
- Redis key `refresh:{token}` is deleted.
- Redis key `jwt:blacklist:{jti}` is set.
- Immediately calling a protected endpoint with the old access token returns `401`.
- Calling `/api/auth/refresh` with the old refresh token returns `401`.

---

### TC-AUTH-09 — Login rate limiting

**When:** `POST /api/auth/login` called 6 times within 1 minute from the same IP with wrong credentials.
**Then:**
- First 5 calls return `401`.
- 6th call returns `429` with `Retry-After` header.

---

### TC-AUTH-10 — Protected endpoint without token

**When:** `GET /api/my-registrations` with no `Authorization` header.
**Then:** Status `401`.

---

### TC-AUTH-11 — Protected endpoint with expired token

**Given:** An `accessToken` whose `exp` is in the past.
**When:** Call any protected endpoint.
**Then:** Status `401`.

---

## 3. Test: Workshop Manager

### TC-WS-01 — Admin creates a free workshop

**When:** `POST /api/workshops` as admin with valid data.
**Then:**
- Status `201`.
- Workshop record exists in DB.
- Redis key `workshop:seats:{id}` = `capacity`.
- `audit_logs` contains a `CREATE_WORKSHOP` entry.

---

### TC-WS-02 — Admin creates a paid workshop

**When:** `POST /api/workshops` with `is_paid=true, price=50000`.
**Then:** Status `201`, `price` stored correctly.

---

### TC-WS-03 — Admin tries to create paid workshop without price

**When:** `POST /api/workshops` with `is_paid=true, price=0` (or price omitted).
**Then:** Status `400`.

---

### TC-WS-04 — Invalid date ranges rejected

**When:** `POST /api/workshops` with `end_time < start_time`.
**Then:** Status `400`.

---

### TC-WS-05 — Student cannot create workshop

**When:** `POST /api/workshops` as student.
**Then:** Status `403`.

---

### TC-WS-06 — Admin updates workshop room and time

**When:** `PUT /api/workshops/:id` changing `room` and `start_time`.
**Then:**
- Status `200`.
- `WORKSHOP_UPDATED` event published to RabbitMQ.
- `audit_logs` records old and new values.

---

### TC-WS-07 — Capacity cannot be reduced below confirmed count

**Given:** Workshop with 5 confirmed registrations.
**When:** `PUT /api/workshops/:id` setting `capacity=4`.
**Then:** Status `400` with meaningful error message.

---

### TC-WS-08 — Admin cancels workshop

**When:** `DELETE /api/workshops/:id`.
**Then:**
- Status `200`.
- `workshops.status = 'cancelled'`.
- `WORKSHOP_CANCELLED` event published for each confirmed registrant.
- `audit_logs` contains `CANCEL_WORKSHOP`.

---

### TC-WS-09 — List workshops with pagination

**When:** `GET /api/workshops?page=1&limit=5`.
**Then:** Returns at most 5 workshops, `total` field is accurate.

---

### TC-WS-10 — Workshop detail includes seat count and AI summary status

**Given:** Workshop with 3 confirmed registrations and capacity 10, with AI summary `status='done'`.
**When:** `GET /api/workshops/:id`.
**Then:**
- `seats_available = 7`.
- `ai_summary.status = 'done'`.
- `ai_summary.summary` is non-null.

---

## 4. Test: Booking / Registration

### TC-REG-01 — Student registers for a free workshop

**When:** `POST /api/registrations` with `workshop_id` of FREE_WORKSHOP.
**Then:**
- Status `200`.
- `registrations.status = 'confirmed'`.
- `registrations.qr_code` is a non-null UUID.
- `REGISTRATION_CONFIRMED_FREE` event published to RabbitMQ.
- Redis seat counter decremented by 1.

---

### TC-REG-02 — Duplicate registration rejected

**Given:** Student has already confirmed registration for FREE_WORKSHOP.
**When:** `POST /api/registrations` with same `workshop_id` again.
**Then:** Status `409` with error "Already registered".

---

### TC-REG-03 — Registration to full workshop rejected

**Given:** FULL_WORKSHOP (capacity=1, 1 confirmed registration).
**When:** `POST /api/registrations` for that workshop.
**Then:** Status `409` with error "Workshop is full".

---

### TC-REG-04 — Concurrent last-seat registrations (race condition)

**Setup:** Workshop with capacity=1, 0 current registrations.
**When:** 10 concurrent `POST /api/registrations` requests sent simultaneously for the same workshop from 10 different student accounts.
**Then:**
- Exactly **1** registration is `confirmed`.
- The other 9 receive `409`.
- `registrations` table has exactly 1 confirmed record.
- No negative seat count in Redis.

---

### TC-REG-05 — Student registers for paid workshop — success

**When:** `POST /api/registrations` with `workshop_id` of PAID_WORKSHOP and a valid `idempotency_key`, sandbox scenario defaults to `success`.
**Then:**
- Status `200`.
- `registrations.status = 'confirmed'`.
- `registrations.qr_code` is non-null.
- `payments.status = 'success'`.
- `REGISTRATION_CONFIRMED_PAID` event published.

---

### TC-REG-06 — Paid registration — payment declined

**When:** `POST /api/registrations` with amount triggering `declined` scenario.
**Then:**
- Status `402`.
- `registrations.status = 'failed'`.
- Seat counter incremented back (slot released).
- No QR code generated.

---

### TC-REG-07 — Paid registration — gateway timeout

**When:** `POST /api/registrations` with `timeout` scenario.
**Then:**
- Status `202`.
- `registrations.status = 'pending'`.
- `payments.status = 'pending'`.

---

### TC-REG-08 — Paid registration — circuit breaker open

**Given:** Circuit Breaker is in OPEN state (set in Redis).
**When:** `POST /api/registrations` for paid workshop.
**Then:**
- Status `503`.
- No pending registration record created.

---

### TC-REG-09 — Registration before open time rejected

**Given:** Workshop with `registration_open_at = NOW() + 1 hour`.
**When:** `POST /api/registrations`.
**Then:** Status `400` "Registration not open yet".

---

### TC-REG-10 — Student cancels own registration

**Given:** Student has a confirmed registration.
**When:** `POST /api/registrations/:id/cancel` as that student.
**Then:**
- Status `200`.
- `registrations.status = 'cancelled'`.
- Seat counter incremented.
- `REGISTRATION_CANCELLED` event published.

---

### TC-REG-11 — Student cannot cancel another student's registration

**Given:** Student A has a confirmed registration.
**When:** `POST /api/registrations/:id/cancel` authenticated as Student B.
**Then:** Status `403`.

---

### TC-REG-12 — Admin can cancel any registration

**Given:** Student has a confirmed registration.
**When:** `POST /api/registrations/:id/cancel` as admin.
**Then:** Status `200`.

---

## 5. Test: Payment (Sandbox)

### TC-PAY-01 — Idempotency prevents double charge

**Setup:** Client sends payment request with `idempotency_key = "key-abc"`. Request succeeds. 
**When:** Same request sent again with the same `idempotency_key`.
**Then:**
- Gateway is called **exactly once** (verify via call count mock).
- Second call returns the cached success response from Redis.
- `payments` table has exactly 1 record for that key.

---

### TC-PAY-02 — Concurrent requests with same idempotency key

**Setup:** Two simultaneous requests with the same `idempotency_key` arrive at the same millisecond.
**Then:**
- Redis `SET NX` ensures only one proceeds to call the gateway.
- The other gets `processing` status.
- No duplicate charge occurs.

---

### TC-PAY-03 — Circuit Breaker opens after 5 failures

**Setup:** Mock gateway to return HTTP 500 for all requests.
**When:** 5 payment requests are made (each fails).
**Then:**
- After the 5th failure, `circuit:payment_gateway.state = 'open'` in Redis.
- 6th payment request returns `circuit_open` status without calling the gateway.

---

### TC-PAY-04 — Circuit Breaker transitions OPEN → HALF-OPEN → CLOSED

**Setup:** Force Circuit Breaker to OPEN with `opened_at = NOW() - 61 seconds`.
**When:** A new payment request arrives.
**Then:**
- Circuit Breaker transitions to HALF-OPEN.
- One test request is sent to the gateway.
- If it succeeds: `state = 'closed'`, `failure_count = 0`.

---

### TC-PAY-05 — Circuit Breaker OPEN does not affect free workshop registration

**Given:** Circuit Breaker is OPEN.
**When:** Student registers for a free workshop.
**Then:** Registration succeeds with status `confirmed`.

---

### TC-PAY-06 — Reconcile Worker resolves pending payment

**Given:** A payment record with `status='processing'` and `attempted_at = 20 minutes ago`.
**When:** Reconcile Worker runs.
**Then:**
- Gateway's `/status/{transaction_id}` endpoint is queried.
- `payments.status` updated to `success` or `failed`.
- `registrations.status` updated accordingly.
- Notification event published.

---

## 6. Test: Notification

### TC-NOTIF-01 — Email sent on free workshop confirmation

**Given:** Registration confirmed (free workshop).
**When:** `REGISTRATION_CONFIRMED_FREE` event consumed by Notification Worker.
**Then:**
- `EmailAdapter.send()` called with correct recipient, subject, and workshop details.
- `notifications` record created with `status='sent'` and `channels='["app","email"]'`.

---

### TC-NOTIF-02 — Push notification sent on check-in confirmation

**When:** `CHECKIN_CONFIRMED` event consumed.
**Then:**
- `PushAdapter.send()` called with correct FCM token and message.
- Email adapter **not** called (push only for this event type).

---

### TC-NOTIF-03 — Event published after DB commit, not inside transaction

**Setup:** Spy on RabbitMQ publish method.
**When:** Free registration is confirmed.
**Then:**
- RabbitMQ publish occurs **after** the transaction commit.
- If the publish call is placed before commit in code, this test catches the bug by simulating a transaction rollback and verifying no spurious event is fired.

---

### TC-NOTIF-04 — Worker retries on adapter failure (up to 3 times)

**Setup:** Mock `EmailAdapter.send()` to always throw an error.
**When:** `REGISTRATION_CONFIRMED_FREE` event consumed.
**Then:**
- Email send attempted exactly 3 times.
- After 3 failures, `notifications.status = 'failed'`.
- `notifications.retry_count = 3`.
- RabbitMQ message is **acked** (not requeued).

---

### TC-NOTIF-05 — Missing FCM token skips push silently

**Given:** User has `fcm_token = NULL`.
**When:** Any event that includes push notification is consumed.
**Then:** No error thrown; notification marked `sent` for email channel only.

---

### TC-NOTIF-06 — New adapter can be added without changing business modules

**Conceptual test (code review):** Confirm that adding a `TelegramAdapter` only requires:
1. A new class implementing the adapter interface.
2. An entry in `EVENT_CHANNEL_MAP`.
- No changes to Registration, Workshop, or Check-in module code.

---

## 7. Test: Check-in

### TC-CI-01 — Preload returns confirmed QR codes

**Given:** Workshop with 3 confirmed registrations.
**When:** `GET /api/checkin/preload?workshop_id={id}` as staff.
**Then:**
- Status `200`.
- `records` array has exactly 3 items.
- Each item has `qr_code`, `studentName`, `studentId`.

---

### TC-CI-02 — Online check-in success

**Given:** Student has confirmed registration with QR code `abc-123`.
**When:** `POST /api/checkin { qr_code: "abc-123", workshop_id, device_id }` as staff.
**Then:**
- Status `200` with `student_name`, `student_id`, `checked_in_at`.
- `checkins` record created in DB.
- `CHECKIN_CONFIRMED` event published.

---

### TC-CI-03 — Online check-in rejects invalid QR

**When:** `POST /api/checkin` with a non-existent `qr_code`.
**Then:** Status `404`.

---

### TC-CI-04 — Online check-in rejects unconfirmed registration

**Given:** Registration with `status='pending'`.
**When:** `POST /api/checkin` with that registration's QR code.
**Then:** Status `422`.

---

### TC-CI-05 — Online check-in rejects duplicate

**Given:** Student already has a `checkins` record.
**When:** `POST /api/checkin` for the same QR code again.
**Then:**
- Status `409`.
- Response includes `checked_in_at` from the original check-in.

---

### TC-CI-06 — Student role cannot call check-in endpoint

**When:** `POST /api/checkin` authenticated as a student.
**Then:** Status `403`.

---

### TC-CI-07 — Offline sync — new records inserted

**Given:** 3 valid offline check-in records (QR codes exist in DB as confirmed registrations, not yet checked in).
**When:** `POST /api/checkin/sync-offline` with those 3 records.
**Then:**
- Status `200`.
- `synced: 3, skipped: 0, duplicates: 0`.
- 3 `checkins` records inserted in DB.

---

### TC-CI-08 — Offline sync — duplicate records handled

**Given:** One of the 3 records was already inserted by an online check-in (concurrent device).
**When:** `POST /api/checkin/sync-offline` with all 3 records.
**Then:**
- `synced: 2, duplicates: 1`.
- No error thrown; DB not modified for the duplicate.

---

### TC-CI-09 — Offline sync — invalid QR code skipped

**Given:** One record with a QR code that does not exist in `registrations`.
**When:** `POST /api/checkin/sync-offline`.
**Then:**
- That record has `status: 'invalid'` in the response.
- No `checkins` record inserted for it.

---

### TC-CI-10 — Mobile: offline duplicate scan rejected locally (SQLite)

**Given:** SQLite has `offline_checkins` record with `qr_code=X, is_synced=0`.
**When:** Staff scans the same QR code again.
**Then:** App shows "Already checked in at {time}" and does NOT insert a new record.

*(Flutter integration test)*

---

## 8. Test: AI PDF Summary

### TC-AI-01 — Admin uploads valid PDF

**When:** `POST /api/workshops/:id/pdf` with a valid PDF file (< 10MB) as admin.
**Then:**
- Status `202`.
- `workshop_summaries.status = 'pending'`.
- Event published to RabbitMQ `ai_summary.generate`.
- File saved to `/uploads/pdf/{workshopId}/{uuid}.pdf`.

---

### TC-AI-02 — Upload rejected for non-PDF file type

**When:** `POST /api/workshops/:id/pdf` with a `.docx` file.
**Then:** Status `400` "Only PDF files are allowed".

---

### TC-AI-03 — Upload rejected for file exceeding size limit

**When:** `POST /api/workshops/:id/pdf` with a 12MB PDF.
**Then:** Status `400` "File too large".

---

### TC-AI-04 — Student cannot upload PDF

**When:** `POST /api/workshops/:id/pdf` as student.
**Then:** Status `403`.

---

### TC-AI-05 — AI Worker processes PDF successfully

**Setup:** Mock AI API to return a summary string.
**When:** Worker consumes event `{ workshopId, filePath, summaryId }`.
**Then:**
- `workshop_summaries.status = 'done'`.
- `workshop_summaries.summary` is non-empty.
- `workshop_summaries.ai_model_used` is set.
- `workshop_summaries.completed_at` is set.

---

### TC-AI-06 — Worker handles missing PDF file

**Setup:** Event references a file path that does not exist on disk.
**When:** Worker consumes event.
**Then:**
- `workshop_summaries.status = 'failed'`.
- `error_message = 'file_not_found'`.
- Message is **acked** (not requeued to prevent infinite retry).

---

### TC-AI-07 — Worker handles unreadable/encrypted PDF

**Setup:** Provide an encrypted PDF with no text layer.
**When:** Worker processes it.
**Then:**
- `status = 'failed'`.
- `error_message = 'unreadable_pdf'`.

---

### TC-AI-08 — Worker handles AI API timeout (60s)

**Setup:** Mock AI API to never respond within 60s.
**When:** Worker calls AI API.
**Then:**
- Worker times out after 60s.
- `status = 'failed'`, `error_message = 'ai_api_timeout'`.
- Message acked.

---

### TC-AI-09 — Poll endpoint returns correct status

**Given:** `workshop_summaries.status = 'processing'`.
**When:** `GET /api/workshops/:id/summary`.
**Then:** Status `200` with `{ status: "processing", summary: null }`.

---

### TC-AI-10 — Re-upload replaces existing summary record

**Given:** `workshop_summaries.status = 'done'` for workshop.
**When:** Admin uploads a new PDF for the same workshop.
**Then:**
- `workshop_summaries.status` reset to `'pending'`.
- New event published to RabbitMQ.
- Previous summary overwritten after AI Worker completes.

---

## 9. Test: CSV Import

### TC-CSV-01 — Successful nightly import

**Setup:** Valid CSV file at `CSV_IMPORT_PATH` with 500 rows.
**When:** Job is triggered.
**Then:**
- All valid rows upserted into `users`.
- `student_import_logs.status = 'success'`.
- `rows_processed = 500`.
- Redis lock released after completion.
- File hash recorded in `student_import_logs.file_hash`.

---

### TC-CSV-02 — Duplicate file skipped (same hash)

**Given:** A log record with the same MD5 hash exists in `student_import_logs`.
**When:** Job runs with the same file again.
**Then:**
- No DB modifications to `users`.
- New `student_import_logs` record with `status = 'skipped'`.
- Job finishes quickly.

---

### TC-CSV-03 — File not found → alert sent

**Given:** `CSV_IMPORT_PATH` points to a non-existent file.
**When:** Job runs.
**Then:**
- `student_import_logs.status = 'failed'`.
- Admin alert email triggered (verify mock email adapter called).
- Redis lock released.

---

### TC-CSV-04 — Missing required column stops job

**Setup:** CSV with header `student_id,name` (missing `email` and `full_name`).
**When:** Job runs.
**Then:**
- `student_import_logs.status = 'failed'`.
- `error_log` contains information about missing columns.
- No rows upserted.

---

### TC-CSV-05 — Invalid rows skipped; valid rows imported

**Setup:** 10-row CSV where 2 rows have an invalid email format.
**When:** Job runs.
**Then:**
- 8 rows upserted to `users`.
- `rows_inserted + rows_updated = 8`.
- `rows_skipped = 2`.
- `error_details` JSONB array has 2 entries with row number and error.
- `status = 'partial'`.

---

### TC-CSV-06 — Admin and staff accounts NOT overwritten

**Given:** `users` table has an admin account with `student_id = 'A001'`.
**Setup:** CSV contains a row with `student_id = 'A001'` and different name/email.
**When:** Job runs.
**Then:**
- Admin account's `full_name` and `email` are **unchanged**.
- `WHERE users.role = 'student'` clause in UPSERT prevents overwrite.

---

### TC-CSV-07 — Students not in new CSV are soft-deleted

**Given:** DB has student with `student_id = 'S999', is_active = TRUE`.
**Setup:** CSV does not contain `student_id = 'S999'`.
**When:** Job runs.
**Then:**
- `users WHERE student_id='S999' AND is_active = FALSE`.
- User record still exists (not deleted).
- Their existing registrations/payments are preserved.

---

### TC-CSV-08 — Concurrent job execution prevented by Redis lock

**Setup:** Redis key `lock:csv_import` already exists.
**When:** Job is triggered.
**Then:**
- Job logs `status = 'skipped_lock'` and exits without processing.
- No changes to `users` or `student_import_logs`.

---

### TC-CSV-09 — Lock auto-expires if worker crashes

**Given:** Lock TTL is 300s.
**When:** Worker crashes mid-run (simulated by process.kill).
**Then:**
- After 300s, the lock key no longer exists in Redis.
- Next job run can acquire the lock and process normally.

---

### TC-CSV-10 — DB batch failure retried with exponential back-off

**Setup:** Mock DB to fail on the first INSERT, succeed on the retry.
**When:** Job processes a batch.
**Then:**
- Retry is attempted with back-off.
- After retry succeeds, batch is committed.
- `status = 'success'` (or `'partial'` if max retries exceeded).

---

## 10. Test: Rate Limiting

### TC-RATE-01 — Per-user limit on registration endpoint

**Setup:** Create a student token.
**When:** Send 6 `POST /api/registrations` requests within 1 minute.
**Then:**
- First 5 succeed (or fail with business logic errors, not 429).
- 6th request returns `429` with `Retry-After` header.

---

### TC-RATE-02 — Per-IP limit on login endpoint

**When:** 6 login requests from the same IP within 1 minute.
**Then:**
- 6th request returns `429`.

---

### TC-RATE-03 — Rate limit resets after time window

**Setup:** Exhaust the rate limit. Wait for refill interval.
**When:** Send another request.
**Then:** Request succeeds (not `429`).

---

### TC-RATE-04 — Rate limits are independent per user

**Setup:** 2 different student tokens.
**When:** User A sends 5 registration requests (hitting their limit). User B sends 1 registration request.
**Then:** User B's request is not rate-limited.

---

### TC-RATE-05 — Redis unavailable → fail open

**Setup:** Mock Redis to throw on all calls.
**When:** Send a request.
**Then:**
- Request is **allowed through** (fail-open).
- Warning logged.
- No `500` error returned to client.

---

## 11. Test: RBAC Middleware

### TC-RBAC-01 — Student blocked from admin endpoints

| Endpoint | Expected |
|----------|----------|
| `POST /api/workshops` | `403` |
| `PUT /api/workshops/:id` | `403` |
| `DELETE /api/workshops/:id` | `403` |
| `GET /api/workshops/statistics` | `403` |
| `GET /api/registrations` (admin list) | `403` |

### TC-RBAC-02 — Staff blocked from non-check-in endpoints

| Endpoint | Expected |
|----------|----------|
| `POST /api/workshops` | `403` |
| `POST /api/registrations` | `403` |
| `GET /api/my-registrations` | `403` |

### TC-RBAC-03 — Admin blocked from student/staff-only endpoints

| Endpoint | Expected |
|----------|----------|
| `POST /api/registrations` | `403` |
| `POST /api/checkin` | `403` |
| `GET /api/checkin/preload` | `403` |

### TC-RBAC-04 — Ownership check: student cannot access another student's data

**When:** Student A calls `GET /api/registrations/{B's registration id}` (or cancel B's registration).
**Then:** `403`.

### TC-RBAC-05 — Backend re-verifies JWT (does not trust X-User-Role header)

**When:** Request arrives with a valid JWT (role=student) but with `X-User-Role: admin` header injected.
**Then:**
- Backend reads role from JWT payload only.
- Admin-only endpoint returns `403`.

---

## 12. Integration & E2E Scenarios

### E2E-01 — Full free workshop registration flow

**Steps:**
1. Login as student → receive access token.
2. List workshops → find free workshop with available seats.
3. Register → receive QR code.
4. List my registrations → see confirmed registration with QR code.
5. Check notification record created in DB with `status='sent'`.
6. Login as staff → preload QR codes for that workshop.
7. Submit online check-in with the student's QR code.
8. Verify `checkins` record in DB.
9. Verify `CHECKIN_CONFIRMED` push notification dispatched.

---

### E2E-02 — Full paid workshop registration flow

**Steps:**
1. Login as student.
2. Register for paid workshop with `idempotency_key = uuid()`, sandbox default (success).
3. Verify `registrations.status = 'confirmed'`, `payments.status = 'success'`.
4. Retry same request with same `idempotency_key`.
5. Verify second request returns the **same** successful response without duplicate charge.

---

### E2E-03 — Race condition: last seat

**Steps:**
1. Create workshop with capacity=1.
2. Fire 20 concurrent registration requests from 20 different student accounts.
3. Assert exactly 1 `confirmed` registration.
4. Assert 19 responses were `409`.
5. Assert Redis seat counter is 0.

---

### E2E-04 — Offline check-in and sync

**Steps:**
1. Admin creates workshop, students register → confirmed.
2. Staff preloads QR codes → stored in Flutter SQLite.
3. Simulate network offline (no API connectivity).
4. Staff scans 3 QR codes → 3 records in `offline_checkins` (is_synced=0).
5. Restore network.
6. App auto-triggers sync → `POST /api/checkin/sync-offline`.
7. Verify all 3 `checkins` records in DB.
8. Verify SQLite records marked `is_synced=1`.

---

### E2E-05 — AI PDF summary end-to-end

**Steps:**
1. Admin creates workshop.
2. Admin uploads PDF → receives `202 { status: 'pending' }`.
3. Poll `GET /api/workshops/:id/summary` every second.
4. After AI Worker processes → poll returns `{ status: 'done', summary: '...' }`.
5. Student views workshop detail → AI summary displayed.

---

### E2E-06 — CSV import end-to-end

**Steps:**
1. Place test CSV at `CSV_IMPORT_PATH` with 100 students.
2. Trigger cron job manually.
3. Verify 100 `users` records in DB with `role='student'`.
4. Place updated CSV (same students but 2 removed, 3 new).
5. Trigger job again.
6. Verify 3 new students inserted.
7. Verify 2 removed students have `is_active=FALSE`.
8. Verify `student_import_logs` has 2 successful entries.

---

### E2E-07 — Circuit Breaker end-to-end with graceful degradation

**Steps:**
1. Configure sandbox gateway to return HTTP 500 for all requests.
2. Make 5 paid workshop registration attempts.
3. Verify Circuit Breaker state = OPEN in Redis.
4. Attempt a 6th paid registration → receives `503` immediately (no gateway call).
5. Attempt a free workshop registration → receives `200` (unaffected).
6. Wait 61 seconds (OPEN → HALF-OPEN timeout).
7. Configure sandbox to return success.
8. Make one more paid registration → HALF-OPEN test succeeds → Circuit Breaker closes.
9. Subsequent paid registrations succeed normally.

---

### E2E-08 — Workshop cancellation notifies all registrants

**Steps:**
1. 5 students register and confirm for a workshop.
2. Admin cancels workshop.
3. Verify `workshops.status = 'cancelled'`.
4. Verify 5 `WORKSHOP_CANCELLED` events published.
5. Verify Notification Worker sends email + push to all 5 students.
6. Verify 5 `notifications` records with `type='workshop_cancelled'` and `status='sent'`.

---

## Test Coverage Targets

| Module | Unit | Integration | E2E |
|--------|------|-------------|-----|
| Auth | 90% | ✅ | ✅ |
| Workshop Manager | 80% | ✅ | ✅ |
| Registration / Booking | 90% | ✅ | ✅ |
| Payment / Idempotency | 95% | ✅ | ✅ |
| Circuit Breaker | 95% | ✅ | ✅ |
| Notification | 85% | ✅ | — |
| Check-in (server) | 90% | ✅ | ✅ |
| Check-in (Flutter offline) | — | — | ✅ |
| AI Summary | 85% | ✅ | ✅ |
| CSV Import | 90% | ✅ | ✅ |
| Rate Limiting | 85% | ✅ | — |
| RBAC Middleware | 95% | ✅ | — |

---

## Test Infrastructure Notes

- **Docker Compose** should spin up: PostgreSQL, Redis, RabbitMQ, and the Sandbox Gateway for integration tests.
- **Test database** is reset between test suites using `TRUNCATE ... CASCADE`.
- **Redis** is flushed with `FLUSHDB` before each test file.
- **RabbitMQ** exchanges and queues are declared once at startup; messages are purged between test runs.
- **Mocks:**
  - SMTP / email: use `nodemailer-mock` or intercept the adapter.
  - Firebase FCM: mock the HTTP call.
  - AI API: mock the HTTP endpoint with `nock` or `msw`.
  - Sandbox Gateway: use the real sandbox gateway running locally (it's deterministic by design).
- **Flutter tests:** Use `flutter_test` + `mockito` for unit tests; use `integration_test` package for E2E device tests with a mocked API server (WireMock or similar).
