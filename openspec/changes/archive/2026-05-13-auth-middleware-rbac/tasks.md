## 1. Authentication Utilities

- [x] 1.1 Create `src/lib/auth/middleware.ts` to house the new authorization utilities.
- [x] 1.2 Implement `authenticateUser(req: NextRequest)` to extract the JWT from the `Authorization` header and verify it using the RS256 public key.
- [x] 1.3 Update `authenticateUser` to return the decoded user payload `({ sub, role })` or `null` if the token is missing/invalid.

## 2. Authorization Utilities (RBAC & Ownership)

- [x] 2.1 Implement `requireRole(user: any, allowedRoles: string[])` in `src/lib/auth/middleware.ts` to check if the user's role is in the allowed list.
- [x] 2.2 Implement `verifyOwnership(user: any, ownerId: string)` in `src/lib/auth/middleware.ts` to return `true` if `user.sub === ownerId` or `user.role === 'admin'`.

## 3. Integration & Refactoring

- [x] 3.1 Refactor `src/app/api/auth/logout/route.ts` to use the new `authenticateUser` utility instead of manually verifying the JWT, simplifying the handler logic.
