import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/signup_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/workshops/presentation/pages/workshops_page.dart';
import '../../features/workshops/presentation/pages/workshop_detail_page.dart';
import '../../features/registrations/presentation/pages/registrations_page.dart';
import '../../features/registrations/presentation/pages/registration_detail_page.dart';
import '../../features/checkin/presentation/pages/checkin_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../widgets/main_scaffold.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/home',
    redirect: (context, state) {
      final session = Supabase.instance.client.auth.currentSession;
      final isLoggedIn = session != null;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      if (!isLoggedIn && !isAuthRoute) {
        return '/auth/login';
      }
      if (isLoggedIn && isAuthRoute) {
        return '/home';
      }
      return null;
    },
    routes: [
      // Auth routes
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/auth/signup',
        builder: (context, state) => const SignupPage(),
      ),
      
      // Main shell with bottom navigation
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: HomePage(),
            ),
          ),
          GoRoute(
            path: '/workshops',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: WorkshopsPage(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                builder: (context, state) => WorkshopDetailPage(
                  workshopId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/registrations',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: RegistrationsPage(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                builder: (context, state) => RegistrationDetailPage(
                  registrationId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/checkin',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: CheckinPage(),
            ),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfilePage(),
            ),
          ),
        ],
      ),
    ],
  );
});
