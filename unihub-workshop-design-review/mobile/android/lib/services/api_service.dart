import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:unihub_mobile/models/models.dart';

class ApiService {
  final supabase = Supabase.instance.client;

  // Workshops
  Future<List<Workshop>> getWorkshops() async {
    try {
      final response = await supabase
          .from('workshops')
          .select()
          .eq('is_published', true)
          .order('start_time');

      return (response as List)
          .map((w) => Workshop.fromJson(w as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error fetching workshops: $e');
      rethrow;
    }
  }

  Future<Workshop> getWorkshopById(String id) async {
    try {
      final response = await supabase
          .from('workshops')
          .select()
          .eq('id', id)
          .single();

      return Workshop.fromJson(response as Map<String, dynamic>);
    } catch (e) {
      print('Error fetching workshop: $e');
      rethrow;
    }
  }

  // Registrations
  Future<List<Registration>> getMyRegistrations() async {
    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) throw Exception('Not logged in');

      final response = await supabase
          .from('registrations')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      return (response as List)
          .map((r) => Registration.fromJson(r as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error fetching registrations: $e');
      rethrow;
    }
  }

  // Check-in
  Future<Map<String, dynamic>?> getRegistrationByQrCode(
    String qrCode,
    String workshopId,
  ) async {
    try {
      final response = await supabase
          .from('registrations')
          .select('*, workshops(*), users(full_name, student_id)')
          .eq('qr_code', qrCode)
          .eq('workshop_id', workshopId)
          .maybeSingle();

      return response as Map<String, dynamic>?;
    } catch (e) {
      print('Error fetching registration: $e');
      rethrow;
    }
  }

  Future<void> createCheckin({
    required String registrationId,
    required String workshopId,
  }) async {
    try {
      final userId = supabase.auth.currentUser?.id;

      await supabase.from('checkins').insert({
        'registration_id': registrationId,
        'checked_in_by': userId,
        'checked_in_at': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('Error creating checkin: $e');
      rethrow;
    }
  }

  Future<int> getCheckinCountForWorkshop(String workshopId, {int localOfflineCount = 0}) async {
    try {
      // Get count from server by joining registrations with checkins
      final response = await supabase
          .from('registrations')
          .select('id, checkins!inner(id)')
          .eq('workshop_id', workshopId);

      final serverCount = (response as List).length;
      return serverCount + localOfflineCount;
    } catch (e) {
      print('Error getting checkin count: $e');
      return localOfflineCount;
    }
  }

  // Sync offline checkins
  Future<void> syncOfflineCheckins(List<OfflineCheckin> checkins) async {
    try {
      if (checkins.isEmpty) return;

      // Batch insert all checkins at once
      await supabase.from('checkins').insert(
        checkins.map((c) => {
          'registration_id': c.registrationId,
          'checked_in_by': c.checkedInBy,
          'checked_in_at': c.checkedInAt.toIso8601String(),
        }).toList()
      );
    } catch (e) {
      print('Error syncing checkins: $e');
      rethrow;
    }
  }

  // Validate QR code exists
  Future<bool> isValidQrCode(String qrCode, String workshopId) async {
    try {
      final response = await supabase
          .from('registrations')
          .select('id')
          .eq('qr_code', qrCode)
          .eq('workshop_id', workshopId)
          .eq('status', 'confirmed')
          .maybeSingle();

      return response != null;
    } catch (e) {
      print('Error validating QR: $e');
      return false;
    }
  }

  // Registrations
  Future<List<Map<String, dynamic>>> getUpcomingRegistrations() async {
    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) return [];

      final response = await supabase
          .from('registrations')
          .select('*, workshops(*)')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .order('created_at', ascending: false)
          .limit(3);

      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      print('Error fetching upcoming registrations: $e');
      return [];
    }
  }

  Future<List<Workshop>> getUpcomingWorkshops({int limit = 5}) async {
    try {
      final response = await supabase
          .from('workshops')
          .select()
          .eq('is_published', true)
          .gte('start_time', DateTime.now().toIso8601String())
          .order('start_time')
          .limit(limit);

      return (response as List)
          .map((w) => Workshop.fromJson(w as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error fetching upcoming workshops: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>?> getUserProfile(String userId) async {
    try {
      return await supabase
          .from('users')
          .select()
          .eq('id', userId)
          .single();
    } catch (e) {
      print('Error fetching user profile: $e');
      return null;
    }
  }
}
