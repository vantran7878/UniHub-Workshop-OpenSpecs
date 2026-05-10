## Why

The monolithic web application originally planned is not optimal for all users. Admin users manage complex data (CRUD, PDF upload, statistics) which is best suited for desktop web browsers. Students need to view and register for workshops, which is feasible on both web and mobile. However, Staff users need an efficient QR scanner for check-ins, and students benefit from push notifications and a convenient place to store QR codes, which are inherently mobile-first use cases. Splitting the UI into a Web App and a Mobile App provides the best user experience for each role.

## What Changes

- Create a Next.js Web Application tailored for Admin users and Student web access.
- Create a React Native / Expo Mobile Application tailored for Staff check-ins and Student on-the-go access.
- Add QR code scanner interface for staff on mobile.
- Add push notification receiver and QR code wallet for students on mobile.
- Integrate both clients with the existing UniHub Workshop Backend APIs.

## Capabilities

### New Capabilities
- `web-app-client`: Next.js frontend application serving the admin portal (CRUD, statistics) and student workshop catalog.
- `mobile-app-client`: React Native/Expo mobile application serving the staff QR scanner and student mobile hub.
- `push-notifications-client`: Mobile-specific capability to receive FCM push notifications sent from the backend.
- `qr-scanner-client`: Mobile-specific capability to scan QR codes and call the backend check-in API.

### Modified Capabilities
- `<existing-name>`: None. The backend APIs already support these clients.

## Impact

- **Web App**: Requires setup of Next.js, Tailwind CSS, and API client utilities.
- **Mobile App**: Requires setup of Expo, React Native Navigation, Camera permissions (for QR scanning), and FCM push notification handlers.
- **Backend**: No changes required. The backend already exposes REST APIs and FCM push notification stubs.
