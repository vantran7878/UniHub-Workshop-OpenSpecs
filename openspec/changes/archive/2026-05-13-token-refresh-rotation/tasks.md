## 1. Token Utilities & Infrastructure

- [x] 1.1 Implement `deleteRefreshTokenHash` in `src/lib/auth/tokens.ts` to remove the old token from Redis during rotation.
- [x] 1.2 Implement `verifyRefreshTokenHash` in `src/lib/auth/tokens.ts` to check if a token exists in Redis and return the associated `userId`.

## 2. API Route Implementation

- [x] 2.1 Create the API route file `src/app/api/auth/refresh/route.ts`.
- [x] 2.2 Read the `refresh_token` from the incoming HTTP-only cookies.
- [x] 2.3 Verify the token using `verifyRefreshTokenHash`. Return `401 Unauthorized` if invalid or missing.
- [x] 2.4 Gracefully handle Redis connection errors by catching exceptions and returning `503 Service Unavailable`.

## 3. Token Rotation & State Updates

- [x] 3.1 Fetch the user associated with the valid refresh token from the database.
- [x] 3.2 Delete the old refresh token hash from Redis using `deleteRefreshTokenHash`.
- [x] 3.3 Generate a new access token (15m TTL) and a new refresh token using existing utilities.
- [x] 3.4 Store the new refresh token hash in Redis.
- [x] 3.5 Set the new refresh token in the response `Set-Cookie` header (`HttpOnly`, `Secure`, `SameSite=Strict`).
- [x] 3.6 Log `TOKEN_REFRESH` in `AuditLog`.
- [x] 3.7 Return the new access token in the `200 OK` response.
