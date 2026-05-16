import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/models.dart';

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
          .select('*, user:users(full_name, student_id)')
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
        'workshop_id': workshopId,
        'checked_in_by': userId,
        'checked_in_at': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('Error creating checkin: $e');
      rethrow;
    }
  }

  Future<int> getCheckinCountForWorkshop(String workshopId) async {
    try {
      final response = await supabase
          .from('checkins')
          .select('id')
          .eq('workshop_id', workshopId);

      return (response as List).length;
    } catch (e) {
      print('Error getting checkin count: $e');
      return 0;
    }
  }

  // Sync offline checkins
  Future<void> syncOfflineCheckins(List<OfflineCheckin> checkins) async {
    try {
      for (final checkin in checkins) {
        await supabase.from('checkins').insert({
          'registration_id': checkin.registrationId,
          'workshop_id': checkin.workshopId,
          'checked_in_by': checkin.checkedInBy,
          'checked_in_at': checkin.checkedInAt.toIso8601String(),
        });
      }
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
}
