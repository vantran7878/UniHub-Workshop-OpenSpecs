## 1. Token Utilities & Infrastructure Refactoring

- [x] 1.1 Refactor `storeRefreshTokenHash` in `src/lib/auth/tokens.ts` to add the hash to a Redis Set `user:${userId}:refresh_tokens`.
- [x] 1.2 Refactor `deleteRefreshTokenHash` to remove the hash from the Redis Set as well as deleting the specific token key.
- [x] 1.3 Implement `blacklistAllTokens(userId: string)` in `src/lib/auth/tokens.ts` to fetch all token hashes from the user's Set, delete all those token keys, and finally delete the user's Set.

## 2. Logout API Implementation

- [x] 2.1 Create the API route file `src/app/api/auth/logout/route.ts`.
- [x] 2.2 Verify the `Authorization` header contains a valid access token.
- [x] 2.3 Read the `refresh_token` from the incoming HTTP-only cookies.
- [x] 2.4 Call `deleteRefreshTokenHash` to remove the token from Redis.
- [x] 2.5 Set the `refresh_token` cookie to expire immediately via `Set-Cookie`.
- [x] 2.6 Log the `LOGOUT` event in the `AuditLog`.
- [x] 2.7 Return a `204 No Content` response.
