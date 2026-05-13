## 1. Environment & Dependencies

- [x] 1.1 Add JWT dependencies (`jsonwebtoken`, `@types/jsonwebtoken`).
- [x] 1.2 Add Redis dependencies (`ioredis`).
- [x] 1.3 Add validation schema `LoginSchema` to `src/lib/validations/auth.ts`.
- [x] 1.4 Setup Redis client instance at `src/lib/redis.ts`.
- [x] 1.5 Ensure RS256 key pair environment variables and Redis URL are added to `.env.example`.

## 2. Token Utilities

- [x] 2.1 Create `src/lib/auth/tokens.ts` for token generation logic.
- [x] 2.2 Implement `generateAccessToken` using `jsonwebtoken` and the RS256 private key (15m TTL).
- [x] 2.3 Implement `generateRefreshToken` (using `crypto.randomBytes`).
- [x] 2.4 Implement `storeRefreshTokenHash` to hash the refresh token and save it to Redis with a 7-day TTL.

## 3. Login API Implementation

- [x] 3.1 Create `src/app/api/auth/login/route.ts`.
- [x] 3.2 Validate request body using `LoginSchema`.
- [x] 3.3 Fetch user by email and verify password using `bcrypt.compare`.
- [x] 3.4 Handle invalid credentials by returning `401 Unauthorized` ("Invalid credentials").
- [x] 3.5 Generate access and refresh tokens upon successful verification.
- [x] 3.6 Set the refresh token as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie in the response.
- [x] 3.7 Return the access token and expiration in the `200 OK` JSON response.

## 4. Audit Logging

- [x] 4.1 Log `LOGIN_FAILURE` when credentials do not match or user is not found.
- [x] 4.2 Log `LOGIN_SUCCESS` upon successful authentication.
