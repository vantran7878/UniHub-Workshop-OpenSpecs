## ADDED Requirements

### Requirement: QR Code Scanning
The mobile application SHALL allow staff users to scan QR codes using the device camera.

#### Scenario: Scan QR code
- **WHEN** staff user opens the QR scanner screen and points it at a valid QR code
- **THEN** system decodes the UUID and calls the `POST /api/checkin` endpoint

#### Scenario: Handle duplicate check-in
- **WHEN** backend responds with 409 ALREADY_CHECKED_IN
- **THEN** system displays a warning message to the staff user indicating the QR was already scanned
