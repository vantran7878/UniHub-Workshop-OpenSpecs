## 1. Database Schema Initialization

- [x] 1.1 Add Prisma ORM dependencies if not already present.
- [x] 1.2 Define `Role` enum in `schema.prisma` with values `student`, `admin`, `staff`.
- [x] 1.3 Define `User` model in `schema.prisma` (id as UUID, email, password_hash, role, is_active, etc.).
- [x] 1.4 Define `AuditLog` model in `schema.prisma` (id as UUID, event_type, metadata as JSONB, etc.).
- [x] 1.5 Generate the Prisma migration file (`npx prisma migrate dev --name init_users_audit_logs`).

## 2. Seed Script Configuration

- [x] 2.1 Add `bcrypt` dependency for hashing passwords.
- [x] 2.2 Create `prisma/seed.ts` script.
- [x] 2.3 Implement logic in `seed.ts` to read `ADMIN_DEFAULT_PASSWORD` from environment variables, hash it with bcrypt, and upsert the initial admin user.
- [x] 2.4 Update `package.json` with the Prisma seed command configuration.
