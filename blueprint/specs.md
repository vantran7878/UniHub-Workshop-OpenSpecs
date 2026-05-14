1. Authentication & Security (Auth Module)
User Login & Registration: Support for students and staff.
JWT-Based Authentication: Using asymmetric encryption (RS256) where the backend issues and verifies tokens independently of the gateway.
Refresh Token Management: Includes a token blacklisting mechanism using Redis to immediately revoke access upon logout.
Role-Based Access Control (RBAC): Implementation of three strict roles (student, admin, staff) with specific API access boundaries and ownership checks (e.g., students can only see/cancel their own registrations).
2. Workshop Management (Admin Portal)
CRUD Operations: Create, read, update, and cancel workshops.
Pricing Setup: Ability to mark workshops as free or paid, including configuring prices.
Analytics & Reporting: View registration statistics and lists of participants for specific workshops.
Audit Logging: Track critical administrative actions (e.g., changing capacity, deleting a workshop).
3. Booking & Registration (Registration Module)
Workshop Discovery: Display a list of upcoming workshops and their details for students.
Registration Flow: Allow students to enroll in workshops (generating a unique QR code upon confirmation) and cancel their bookings.
High-Concurrency Seat Booking: Implement strong concurrency control using database-level row locking (SELECT ... FOR UPDATE) to prevent overselling slots during traffic spikes.
Rate Limiting: Implement a Token Bucket rate-limiting algorithm via Redis (Global, Per IP, and Per User) to protect the registration endpoints from bots and surges.
4. Payment Processing (Payment Module)
Synchronous Payment Flow: Process payments immediately during the registration request before confirming a slot.
Idempotency Handling: Use Idempotency Keys stored in Redis (with a 24-hour TTL) to guarantee users are not double-charged if they retry a failed or timeout request.
Circuit Breaker Pattern: Automatically stop sending requests to the payment gateway if it fails repeatedly, utilizing a CLOSED -> OPEN -> HALF-OPEN state machine.
Graceful Degradation: Ensure that free workshops and read-only features remain fully functional even if the payment system is down.
5. Event Check-in System (Check-in Module)
QR Code Scanning: Allow staff to scan student QR codes at the door.
Preloading Data: Download confirmed registrations to the staff's mobile device before the event.
Offline Mode Support: Save scanned QR codes to a local SQLite database on the mobile device when the internet connection drops.
Automatic Offline Sync: Automatically push offline check-in records to the backend when the network connection is restored, handling duplicate scans gracefully (ON CONFLICT DO NOTHING).
6. Asynchronous Notifications (Notification Module)
Event-Driven Architecture: Use RabbitMQ to decouple notification sending from the main registration flow.
Multi-Channel Delivery: Send confirmations and updates via Email (SMTP) and Push Notifications (App).
Retry Mechanism: Automatically retry failed notification deliveries.
7. AI Workshop Summarization (AI Module)
PDF Upload: Allow admins to upload PDF documents for specific workshops.
Background Processing: Use a RabbitMQ worker to asynchronously consume uploaded PDFs, extract text, and call an external AI API (e.g., OpenAI, Claude).
Summary Display: Save the generated summary to the database to be displayed on the workshop details page.
8. Legacy Data Integration (CSV Import Batch Worker)
Nightly Cron Job: A background worker that runs nightly to fetch student data exported from a legacy system.
File Hashing & Validation: Validate the CSV schema and hash the file to prevent processing the same file twice.
Deduplication & Upsertion: Safely insert new students and update existing records using database transactions, while soft-deleting/inactivating students no longer in the file.
9. Caching & Performance
Read-Heavy Optimization: Cache workshop details and available seat counts in Redis to handle up to 120,000 concurrent students safely.