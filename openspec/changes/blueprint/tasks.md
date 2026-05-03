## 1. Repository + local dev infrastructure

- [x] 1.1 Add root `README.md` with local dev instructions (Docker compose, env)
- [x] 1.2 Create `docker-compose.yml` for `postgres`, `redis`, `rabbitmq`, and `mailhog` (dev SMTP)
- [x] 1.3 Add `.env.example` files for backend/workers/web and gitignore secrets

## 2. Backend scaffold (modular monolith)

- [x] 2.1 Scaffold backend app (Node.js) with routing, validation, error format, and health endpoint
- [x] 2.2 Add database access layer and migrations (PostgreSQL) + seed runner
- [x] 2.3 Add Redis client wrapper (timeouts, namespaces) and basic rate-limit helper
- [x] 2.4 Add RabbitMQ client wrapper with publish/consume helpers and DLQ-ready configs

## 3. Data model (PostgreSQL)

- [x] 3.1 Create migrations for core tables: `users`, `workshops`, `registrations`, `payments`
- [x] 3.2 Create migrations for support tables: `audit_logs`, `checkins`, `notification_logs`, `student_import_logs`, `workshop_summaries`
- [x] 3.3 Add constraints & indexes required by specs (unique keys, FK, check-in uniqueness, etc.)
- [x] 3.4 Add seed data for `admin` and `staff` users (students created via CSV import)

## 4. Auth module (RS256 JWT + refresh tokens)

- [x] 4.1 Implement `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- [x] 4.2 Implement JWT verification middleware (RS256 public key) + blacklist check (fail-open on Redis)
- [x] 4.3 Implement RBAC middleware `requireRole` + ownership helper for student resources
- [x] 4.4 Implement login rate limiting (Token Bucket in Redis, 5 req/min/IP) for `/api/auth/login`

## 5. Workshop Manager module (admin CRUD + audit + cache invalidation)

- [x] 5.1 Implement `GET /api/workshops` and `GET /api/workshops/:id` with Redis caching (TTL per spec)
- [x] 5.2 Implement `POST /api/workshops` (admin-only) with validation, audit log, and cache invalidation
- [x] 5.3 Implement `PUT /api/workshops/:id` (admin-only) with `FOR UPDATE` checks, audit log, and cache invalidation
- [x] 5.4 Implement `DELETE /api/workshops/:id` hard-delete vs cancel logic + notification events
- [x] 5.5 Implement `GET /api/workshops/:id/participants` and `GET /api/workshops/statistics` (admin-only)

## 6. Booking module (student register, cancel, my-registrations)

- [x] 6.1 Implement `POST /api/register` for free workshops (row lock + guards + QR generation + notify)
- [x] 6.2 Implement `POST /api/register` for paid workshops (pending → payment → confirmed, idempotency behavior)
- [x] 6.3 Implement `GET /api/my-registrations` and `POST /api/registrations/:id/cancel` with rules from spec
- [x] 6.4 Implement booking rate limiting for `/api/register` (per-user/IP/global per spec) at app layer (dev)

## 7. Payment module (sandbox gateway + circuit breaker + reconcile)

- [x] 7.1 Implement payment idempotency cache in Redis (processing/success/failed/pending, TTL 24h)
- [x] 7.2 Implement sandbox payment gateway HTTP client + scenario simulation support
- [x] 7.3 Implement circuit breaker state in Redis (CLOSED/OPEN/HALF-OPEN thresholds per spec)
- [x] 7.4 Implement reconcile worker for `payments.status='pending'` to finalize registrations and notifications

## 8. Notification module (RabbitMQ worker + adapters)

- [ ] 8.1 Define event types + centralized channel map and message schema
- [ ] 8.2 Implement notification worker consumer for `notification.queue` (at-least-once, log to DB)
- [ ] 8.3 Implement Email adapter (Nodemailer + MailHog for dev) + Handlebars templates
- [ ] 8.4 Implement Push adapter stub (FCM placeholder) with correct skip/failure behavior
- [ ] 8.5 Implement retry flow via `notification.retry` queue (DLX/TTL) per spec

## 9. Check-in module (staff-only + offline sync endpoint)

- [ ] 9.1 Implement `GET /api/checkin/preload` (staff-only) returning confirmed QR records for a workshop
- [ ] 9.2 Implement `POST /api/checkin` online scan (idempotent, prevents duplicate checkins)
- [ ] 9.3 Implement `POST /api/checkin/sync-offline` batch sync (max 50), conflict reporting, idempotency

## 10. AI PDF Summary module (admin upload + async worker)

- [ ] 10.1 Implement `POST /api/workshops/:id/pdf` (admin-only) to store PDF and enqueue `ai_summary.generate`
- [ ] 10.2 Implement `GET /api/workshops/:id/summary` for all roles
- [ ] 10.3 Implement AI worker consumer to extract text and call summarization provider (stubbed by default)

## 11. CSV import worker (nightly sync)

- [ ] 11.1 Implement CSV import worker with Redis distributed lock + MD5 hash skip
- [ ] 11.2 Implement streaming parse, batch upsert (500 rows) and soft-deactivate missing students
- [ ] 11.3 Implement `student_import_logs` persistence and error details capture

## 12. Web app (minimal Next.js UI for student + admin)

- [ ] 12.1 Scaffold Next.js app with login, workshop list/detail, and “register” action
- [ ] 12.2 Add admin portal pages for workshop CRUD + PDF upload + statistics
- [ ] 12.3 Add staff check-in web page (optional fallback to mobile) to test check-in flows

