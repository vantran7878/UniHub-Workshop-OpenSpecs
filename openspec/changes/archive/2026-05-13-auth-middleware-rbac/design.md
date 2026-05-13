## Context

To secure the UniHub API, we need a consistent way to verify the identity of the requester (Authentication) and ensure they have the right privileges to perform an action (Authorization). The current API endpoints (like `POST /auth/logout`) manually extract and verify tokens, which leads to duplicated code and potential security vulnerabilities if implemented inconsistently.

## Goals / Non-Goals

**Goals:**
- Provide a set of reusable authorization utilities for Next.js App Router API handlers.
- `authenticateUser(req: NextRequest)`: Extracts and verifies the JWT from the `Authorization: Bearer <token>` header and returns the user payload. Throws or returns an error response if invalid.
- `requireRole(user, allowedRoles: Role[])`: Checks if the authenticated user's role is in the allowed list.
- `verifyOwnership(user, ownerId: string)`: Checks if the authenticated user owns the resource (i.e., `user.id === ownerId`) or has the `admin` role.
- Establish the standard HTTP response codes (`401 Unauthorized` for token issues, `403 Forbidden` for role/ownership issues).

**Non-Goals:**
- Implementing these checks inside Next.js Edge Middleware (`src/middleware.ts`). Edge middleware does not support standard Node.js crypto used by `jsonwebtoken`. We will implement these as utility functions to be called inside the route handlers (`src/app/api/.../route.ts`).

## Decisions

- **Utility Functions vs Edge Middleware**: 
  - *Decision*: We will use utility functions that are invoked at the beginning of each API route handler instead of Edge Middleware.
  - *Rationale*: Next.js Edge Middleware requires `jose` or Web Crypto API for JWT verification because Node's `crypto` and `jsonwebtoken` are not available at the edge. Since we already use `jsonwebtoken` for RS256 signing and verification in our auth logic, using utility functions inside the Node.js API handlers keeps the stack simpler and consistent.
- **Error Handling**:
  - *Decision*: Utility functions will return the user object (for authentication) or a boolean (for authorization), leaving the `NextResponse.json(...)` generation to the route handler. 
  - *Rationale*: Simple helper functions (`const user = authenticateUser(req); if (!user) return unauthorized();`) provide maximum flexibility for route handlers to fetch data and verify ownership without complex Higher-Order Function wrappers.

## Risks / Trade-offs

- [Risk] **Developer Forgets to Call Utility**: Developers might create a new API route and forget to call `authenticateUser()`, leaving the endpoint exposed.
  - Mitigation: Establish clear coding guidelines and enforce through code review.
