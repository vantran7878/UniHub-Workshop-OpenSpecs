## ADDED Requirements

### Requirement: Mobile App Setup
The system SHALL provide a React Native mobile application for students and staff.

#### Scenario: App initialization
- **WHEN** user opens the mobile application
- **THEN** system presents a login screen or restores previous session

### Requirement: Staff Authentication
Staff users SHALL be able to log in to the mobile app.

#### Scenario: Staff login
- **WHEN** staff submits valid credentials
- **THEN** system authenticates the user and provides a JWT token stored securely

### Requirement: Student Workshop Wallet
Students SHALL be able to view their confirmed workshop registrations and QR codes.

#### Scenario: View QR Code
- **WHEN** student navigates to their registrations
- **THEN** system displays the workshop details and the scannable QR code
