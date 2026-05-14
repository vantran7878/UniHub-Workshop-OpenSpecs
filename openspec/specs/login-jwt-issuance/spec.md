### Requirement: Secure Credential Validation
The system MUST validate user credentials securely and protect against user enumeration.

#### Scenario: Valid login
- **WHEN** a client submits an existing email and the correct password
- **THEN** the system MUST authenticate the user, return `200 OK`, and record a `LOGIN_SUCCESS` audit log.

#### Scenario: Invalid credentials (wrong password)
- **WHEN** a client submits an existing email but an incorrect password
- **THEN** the system MUST return `401 Unauthorized` with the generic message `"Invalid credentials"`, and record a `LOGIN_FAILURE` audit log.

#### Scenario: Invalid credentials (email not found)
- **WHEN** a client submits a non-existent email
- **THEN** the system MUST return exactly the same `401 Unauthorized` response with `"Invalid credentials"` to prevent enumeration.

### Requirement: Access Token Issuance
The system MUST issue a secure, short-lived JWT upon successful authentication.

#### Scenario: Issuing access token
- **WHEN** authentication is successful
- **THEN** the system MUST return an `access_token` signed with RS256, containing the `sub` and `role` claims, with an expiration (`expires_in`) of 900 seconds (15 minutes).

### Requirement: Refresh Token Handling
The system MUST issue an opaque refresh token and handle it securely.

#### Scenario: Setting the refresh token cookie
- **WHEN** authentication is successful
- **THEN** the system MUST set a `Set-Cookie` header containing the opaque refresh token, marked as `HttpOnly`, `Secure`, and `SameSite=Strict`.

#### Scenario: Storing the refresh token
- **WHEN** authentication is successful
- **THEN** the system MUST hash the opaque refresh token using SHA-256 and store it in Redis with a TTL of 7 days.
