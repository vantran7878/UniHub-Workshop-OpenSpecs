## 1. Web App Setup (Next.js)

- [ ] 1.1 Scaffold Next.js application using `create-next-app`
- [ ] 1.2 Configure Tailwind CSS and essential utility components
- [ ] 1.3 Setup API client with JWT interceptors for backend communication

## 2. Web App - Admin Features

- [ ] 2.1 Implement Admin Login page
- [ ] 2.2 Implement Admin Dashboard (Statistics and active workshops overview)
- [ ] 2.3 Implement Workshop CRUD pages (Create, Read, Update, Cancel)
- [ ] 2.4 Implement PDF Upload functionality for AI summaries

## 3. Web App - Student Features

- [ ] 3.1 Implement Student Login page
- [ ] 3.2 Implement Workshop Listing page (filtering, pagination)
- [ ] 3.3 Implement Workshop Details page (including AI summary viewer)
- [ ] 3.4 Implement Workshop Registration flow (free and paid)

## 4. Mobile App Setup (Expo)

- [ ] 4.1 Scaffold Expo/React Native application
- [ ] 4.2 Setup React Navigation (Tabs, Stack)
- [ ] 4.3 Setup SecureStore for JWT management and API client

## 5. Mobile App - Common Features

- [ ] 5.1 Implement universal Login screen (routes based on role: Staff vs Student)
- [ ] 5.2 Integrate Expo Notifications for Firebase Cloud Messaging (FCM)
- [ ] 5.3 Register FCM token to backend upon successful login

## 6. Mobile App - Student Flow

- [ ] 6.1 Implement My Registrations screen
- [ ] 6.2 Implement Workshop Details screen with Scannable QR code display
- [ ] 6.3 Implement Push Notification listener for registration updates

## 7. Mobile App - Staff Flow

- [ ] 7.1 Implement Staff Dashboard (Select workshop to monitor)
- [ ] 7.2 Implement QR Camera Scanner interface
- [ ] 7.3 Handle QR Scan API call (`POST /api/checkin`) with Success/Conflict/Error UI feedback
