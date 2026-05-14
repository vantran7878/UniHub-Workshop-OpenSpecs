## Why

To protect our API routes, we need a robust authorization mechanism that verifies incoming JWT access tokens, enforces Role-Based Access Control (RBAC), and ensures resource ownership. This prevents unauthorized access, limits administrative endpoints to staff/admins, and secures personal data like workshop registrations.

## What Changes

- Implement utilities for extracting and verifying JWT access tokens from the `Authorization: Bearer <token>` header (`authenticateUser`).
- Implement RBAC utility functions (`requireRole`) to restrict access based on user roles (`student`, `staff`, `admin`).
- Implement ownership checking utilities (`requireOwnership`) to verify if the requesting user owns the resource or is an admin.
- Return standardized HTTP error codes: `401 Unauthorized` for missing/expired/invalid tokens, and `403 Forbidden` for insufficient roles or lack of ownership.

## Non-goals

- Implementing full API routes for workshops, registrations, etc. We are only building the middleware/utilities to protect them.
- Implementing rate limiting or audit logging in this specific change.

## Capabilities

### New Capabilities
- `auth-middleware-rbac`: Defines access control rules, token verification, and ownership checks for protecting API routes.

### Modified Capabilities

## Impact

- **API Security**: Standardizes how Next.js API route handlers authenticate requests and authorize actions.
- **Codebase**: Adds reusable authorization utilities in `src/lib/auth/`.
