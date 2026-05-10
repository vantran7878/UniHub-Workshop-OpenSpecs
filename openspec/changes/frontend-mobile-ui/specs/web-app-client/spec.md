## ADDED Requirements

### Requirement: Web App Setup
The system SHALL provide a Next.js web application for students and admins.

#### Scenario: App initialization
- **WHEN** user visits the web app root URL
- **THEN** system serves the Next.js frontend

### Requirement: Admin Authentication
Admin users SHALL be able to log in to the web app.

#### Scenario: Admin login
- **WHEN** admin submits valid credentials
- **THEN** system authenticates the user and provides a JWT token for subsequent API requests

### Requirement: Student Workshop Registration
Students SHALL be able to browse and register for workshops via the web interface.

#### Scenario: Workshop registration
- **WHEN** student clicks "Register" on a workshop detail page
- **THEN** system calls the registration API and displays success state
