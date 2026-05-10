## ADDED Requirements

### Requirement: Receive Push Notifications
The mobile application SHALL be able to receive and display Firebase Cloud Messaging (FCM) push notifications.

#### Scenario: Registration token handling
- **WHEN** user logs into the mobile app
- **THEN** system retrieves the device FCM token and registers it with the backend

#### Scenario: Displaying notification
- **WHEN** backend sends a notification via FCM
- **THEN** system displays the notification natively on the user's device
