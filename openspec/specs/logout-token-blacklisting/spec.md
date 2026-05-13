### Requirement: User Logout
The system MUST provide a way for users to terminate their active session.

#### Scenario: Successful logout
- **WHEN** an authenticated client calls the logout endpoint with a valid refresh token cookie
- **THEN** the API MUST delete the specific refresh token from Redis, clear the client's `refresh_token` cookie, return `204 No Content`, and record a `LOGOUT` audit log.

### Requirement: Token Blacklisting
The system MUST provide an internal mechanism to invalidate all active sessions for a given user.

#### Scenario: Bulk invalidation
- **WHEN** the internal `blacklistAllTokens` utility is invoked for a user ID
- **THEN** the system MUST delete all refresh tokens associated with that user from Redis, preventing any further access token issuance.
