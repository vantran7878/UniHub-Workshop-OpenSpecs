import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  DatabaseService._internal();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    String path = join(await getDatabasesPath(), 'unihub_staff.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        // Preloaded valid QR codes
        await db.execute('''
          CREATE TABLE valid_qr_codes (
            qr_code TEXT NOT NULL,
            student_name TEXT NOT NULL,
            student_id TEXT NOT NULL,
            workshop_id TEXT NOT NULL,
            preloaded_at TEXT NOT NULL,
            PRIMARY KEY (qr_code, workshop_id)
          )
        ''');

        // Offline check-ins queue
        await db.execute('''
          CREATE TABLE offline_checkins (
            id TEXT PRIMARY KEY,
            qr_code TEXT NOT NULL,
            workshop_id TEXT NOT NULL,
            checked_in_at TEXT NOT NULL,
            device_id TEXT NOT NULL,
            is_synced INTEGER NOT NULL DEFAULT 0,
            sync_error TEXT,
            UNIQUE (qr_code, workshop_id)
          )
        ''');
      },
    );
  }

  // Valid QR Codes operations
  Future<void> saveValidQrs(List<Map<String, dynamic>> records, String workshopId) async {
    final db = await database;
    await db.transaction((txn) async {
      // Clear old data for this workshop
      await txn.delete('valid_qr_codes', where: 'workshop_id = ?', whereArgs: [workshopId]);
      
      for (var record in records) {
        await txn.insert('valid_qr_codes', {
          'qr_code': record['qr_code'],
          'student_name': record['studentName'],
          'student_id': record['studentId'],
          'workshop_id': workshopId,
          'preloaded_at': DateTime.now().toIso8601String(),
        });
      }
    });
  }

  Future<Map<String, dynamic>?> lookupQr(String qrCode, String workshopId) async {
    final db = await database;
    final results = await db.query(
      'valid_qr_codes',
      where: 'qr_code = ? AND workshop_id = ?',
      whereArgs: [qrCode, workshopId],
    );
    return results.isNotEmpty ? results.first : null;
  }

  // Offline Check-ins operations
  Future<void> saveOfflineCheckin(Map<String, dynamic> checkin) async {
    final db = await database;
    await db.insert('offline_checkins', checkin, conflictAlgorithm: ConflictAlgorithm.fail);
  }

  Future<List<Map<String, dynamic>>> getUnsyncedCheckins() async {
    final db = await database;
    return await db.query('offline_checkins', where: 'is_synced = 0');
  }

  Future<void> markAsSynced(String id, {String? error}) async {
    final db = await database;
    await db.update(
      'offline_checkins',
      {
        'is_synced': error == null ? 1 : 2,
        'sync_error': error,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> deleteSyncedRecords() async {
    final db = await database;
    await db.delete('offline_checkins', where: 'is_synced = 1');
  }
}
