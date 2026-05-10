## Context

The UniHub Workshop system backend is fully implemented and relies on HTTP REST APIs. The frontend was originally conceived as a single Next.js monolithic web application serving all user roles (student, staff, admin). However, some user flows (e.g. staff scanning QR codes for check-in, students storing QR codes in their pocket and receiving push notifications) are heavily mobile-centric. To provide an optimal user experience, we are splitting the client architecture into a Web App (for desktop-heavy workflows like admin management) and a Mobile App (for on-the-go workflows like student viewing and staff scanning).

## Goals / Non-Goals

**Goals:**
- Provide a clear separation of concerns between web-heavy tasks (Admin CRUD) and mobile-heavy tasks (QR scanning, notifications).
- Use Next.js for the Web App and React Native (Expo) for the Mobile App.
- Both clients communicate with the existing REST APIs and rely on JWT authentication.

**Non-Goals:**
- Modifying backend APIs (the backend should remain unchanged as it already supports these operations).
- Building complex native modules (we will rely on Expo's managed workflow).

## Decisions

- **Web App Framework:** Next.js (App Router) + Tailwind CSS.
  - *Rationale:* Standard for modern React web applications, providing good SEO for public workshop listings and fast performance.
- **Mobile App Framework:** React Native via Expo.
  - *Rationale:* Expo allows rapid cross-platform mobile development (iOS/Android) without needing complex native setups. It has built-in support for Camera (QR scanning) and Notifications (Push).
- **Authentication:** Both apps will use the existing JWT `POST /api/auth/login` endpoint.
  - Web will store tokens in `localStorage` or HTTP-only cookies.
  - Mobile will store tokens in `SecureStore`.

## Risks / Trade-offs

- **Risk:** Maintaining two separate client codebases increases development overhead.
  - *Mitigation:* Focus the mobile app strictly on features that benefit from mobile capabilities (QR, Push). Keep complex management screens exclusive to the web app.
- **Risk:** Expo push notifications might require extra backend integration.
  - *Mitigation:* The backend already has a Push adapter stub. We will integrate Expo's push notification service or Firebase Cloud Messaging via Expo plugin.
