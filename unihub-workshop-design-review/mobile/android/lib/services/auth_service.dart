import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';

class AuthService {
  final supabase = Supabase.instance.client;
  final secureStorage = const FlutterSecureStorage();

  Future<User?> getCurrentUser() async {
    try {
      final session = supabase.auth.currentSession;
      if (session == null) return null;

      final response = await supabase
          .from('users')
          .select()
          .eq('id', session.user.id)
          .single();

      return User.fromJson(response as Map<String, dynamic>);
    } catch (e) {
      print('Error getting current user: $e');
      return null;
    }
  }

  Future<User> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );

      if (response.session == null) {
        throw Exception('Login failed');
      }

      // Get user data from database
      final userData = await supabase
          .from('users')
          .select()
          .eq('id', response.user!.id)
          .single();

      return User.fromJson(userData as Map<String, dynamic>);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await supabase.auth.signOut();
      await secureStorage.delete(key: 'current_user');
    } catch (e) {
      print('Error logging out: $e');
    }
  }

  Future<bool> isLoggedIn() async {
    return supabase.auth.currentSession != null;
  }

  Stream<AuthState> authStateChanges() {
    return supabase.auth.onAuthStateChange;
  }
}
