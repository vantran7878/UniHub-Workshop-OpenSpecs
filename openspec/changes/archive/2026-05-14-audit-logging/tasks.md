## 1. Core Implementation

- [x] 1.1 Create the `auditLog(action, metadata)` utility function (e.g., in `src/lib/auth/audit.ts`).
- [x] 1.2 Implement the fire-and-forget asynchronous Prisma `auditLog.create` logic inside the utility function, ensuring it catches and logs any internal errors without rejecting.
- [x] 1.3 Add data sanitization logic to the utility function to explicitly remove passwords, hashes, and raw tokens from the metadata before saving.

## 2. Refactoring Auth Routes

- [x] 2.1 Refactor `POST /auth/login` to use the new asynchronous `auditLog` service for `LOGIN_SUCCESS` and `LOGIN_FAILURE`.
- [x] 2.2 Refactor `POST /auth/register` to use the new asynchronous `auditLog` service for `REGISTER_SUCCESS`.
- [x] 2.3 Refactor `POST /auth/refresh` to use the new asynchronous `auditLog` service for `TOKEN_REFRESH`.
- [x] 2.4 Refactor `POST /auth/logout` to use the new asynchronous `auditLog` service for `LOGOUT`.

## 3. Integration & Testing

- [x] 3.1 Verify that a successful login correctly writes a `LOGIN_SUCCESS` entry to the DB asynchronously without blocking the response.
- [x] 3.2 Verify that a failed login correctly writes a `LOGIN_FAILURE` entry with the `reason` metadata, and that the `reason` is not leaked in the 401 API response.
- [x] 3.3 Verify that sensitive information (like password changes or failed attempts with passwords in the body) are correctly stripped from the audit log metadata.
