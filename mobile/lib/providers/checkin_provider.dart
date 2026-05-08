import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:uuid/uuid.dart';
import 'package:unihub_staff/services/database_service.dart';

enum CheckinResult { success, alreadyCheckedIn, invalidQr, networkError, offlineSaved }

class CheckinProvider with ChangeNotifier {
  final DatabaseService _db = DatabaseService();
  final String baseUrl = 'http://localhost:4000/api';
  
  bool _isOnline = true;
  bool get isOnline => _isOnline;

  CheckinProvider() {
    _initConnectivity();
  }

  void _initConnectivity() {
    Connectivity().onConnectivityChanged.listen((ConnectivityResult result) {
      _isOnline = result != ConnectivityResult.none;
      if (_isOnline) {
        syncOfflineCheckins(null); // Trigger sync when back online
      }
      notifyListeners();
    });
  }

  Future<void> preloadWorkshop(String workshopId, String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/checkin/preload?workshop_id=$workshopId'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        await _db.saveValidQrs(List<Map<String, dynamic>>.from(data['records']), workshopId);
      }
    } catch (e) {
      debugPrint('Preload error: $e');
      rethrow;
    }
  }

  Future<CheckinResult> processCheckin({
    required String qrCode,
    required String workshopId,
    required String token,
    required String deviceId,
  }) async {
    if (_isOnline) {
      return await _processOnlineCheckin(qrCode, workshopId, token, deviceId);
    } else {
      return await _processOfflineCheckin(qrCode, workshopId, deviceId);
    }
  }

  Future<CheckinResult> _processOnlineCheckin(String qrCode, String workshopId, String token, String deviceId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/checkin'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'qr_code': qrCode,
          'workshop_id': workshopId,
          'device_id': deviceId,
        }),
      );

      if (response.statusCode == 200) return CheckinResult.success;
      if (response.statusCode == 409) return CheckinResult.alreadyCheckedIn;
      if (response.statusCode == 404) return CheckinResult.invalidQr;
      
      return CheckinResult.networkError;
    } catch (e) {
      return CheckinResult.networkError;
    }
  }

  Future<CheckinResult> _processOfflineCheckin(String qrCode, String workshopId, String deviceId) async {
    // 1. Lookup in preload cache
    final validQr = await _db.lookupQr(qrCode, workshopId);
    if (validQr == null) return CheckinResult.invalidQr;

    try {
      // 2. Save to offline queue
      await _db.saveOfflineCheckin({
        'id': const Uuid().v4(),
        'qr_code': qrCode,
        'workshop_id': workshopId,
        'checked_in_at': DateTime.now().toIso8601String(),
        'device_id': deviceId,
        'is_synced': 0,
      });
      return CheckinResult.offlineSaved;
    } catch (e) {
      // UNIQUE constraint failure
      return CheckinResult.alreadyCheckedIn;
    }
  }

  Future<void> syncOfflineCheckins(String? token) async {
    if (!_isOnline || token == null) return;

    final unsynced = await _db.getUnsyncedCheckins();
    if (unsynced.isEmpty) return;

    // Process in batches of 50 as per spec
    for (var i = 0; i < unsynced.length; i += 50) {
      final batch = unsynced.sublist(i, i + 50 > unsynced.length ? unsynced.length : i + 50);
      
      try {
        final response = await http.post(
          Uri.parse('$baseUrl/checkin/sync-offline'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: json.encode({
            'records': batch.map((r) => {
              'localId': r['id'],
              'qr_code': r['qr_code'],
              'workshop_id': r['workshop_id'],
              'checked_in_at': r['checked_in_at'],
              'device_id': r['device_id'],
            }).toList(),
          }),
        );

        if (response.statusCode == 200) {
          final result = json.decode(response.body);
          // Mark all in batch as synced initially, then update conflicts
          for (var record in batch) {
            await _db.markAsSynced(record['id']);
          }
          
          // Handle specific conflicts from response
          if (result['conflicts'] != null) {
            for (var conflict in result['conflicts']) {
              await _db.markAsSynced(conflict['localId'], error: conflict['reason']);
            }
          }
        }
      } catch (e) {
        debugPrint('Sync error: $e');
        break; // Stop sync on network error
      }
    }
    notifyListeners();
  }
}
