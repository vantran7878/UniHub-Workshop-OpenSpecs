import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/models.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

class OfflineService {
  static const String _dbName = 'unihub.db';
  static const String _checkinsTable = 'offline_checkins';
  static const String _workshopsTable = 'workshops_cache';

  static Database? _db;

  Future<Database> get db async {
    _db ??= await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    // Offline checkins table
    await db.execute('''
      CREATE TABLE $_checkinsTable (
        id TEXT PRIMARY KEY,
        registration_id TEXT NOT NULL,
        workshop_id TEXT NOT NULL,
        checked_in_by TEXT,
        checked_in_at TEXT NOT NULL,
        synced INTEGER DEFAULT 0
      )
    ''');

    // Workshop cache table
    await db.execute('''
      CREATE TABLE $_workshopsTable (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        room_name TEXT,
        capacity INTEGER,
        confirmed_count INTEGER,
        fee INTEGER DEFAULT 0,
        ai_summary TEXT
      )
    ''');
  }

  // Save offline checkin
  Future<void> saveOfflineCheckin(OfflineCheckin checkin) async {
    final database = await db;
    final id = DateTime.now().millisecondsSinceEpoch.toString();

    await database.insert(
      _checkinsTable,
      {
        'id': id,
        'registration_id': checkin.registrationId,
        'workshop_id': checkin.workshopId,
        'checked_in_by': checkin.checkedInBy,
        'checked_in_at': checkin.checkedInAt.toIso8601String(),
        'synced': 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );

    print('[Offline] Saved checkin: $id');
  }

  // Get all unsynced checkins
  Future<List<OfflineCheckin>> getUnsyncedCheckins() async {
    final database = await db;
    final result = await database.query(
      _checkinsTable,
      where: 'synced = ?',
      whereArgs: [0],
    );

    return result
        .map((map) => OfflineCheckin.fromJson(Map.from(map)))
        .toList();
  }

  // Mark checkins as synced
  Future<void> markAsSynced(List<String> checkinIds) async {
    final database = await db;

    for (final id in checkinIds) {
      await database.update(
        _checkinsTable,
        {'synced': 1},
        where: 'id = ?',
        whereArgs: [id],
      );
    }

    print('[Offline] Marked ${checkinIds.length} checkins as synced');
  }

  // Clear all offline checkins
  Future<void> clearCheckins() async {
    final database = await db;
    await database.delete(_checkinsTable);
  }

  // Cache workshops
  Future<void> cacheWorkshops(List<Workshop> workshops) async {
    final database = await db;

    for (final workshop in workshops) {
      await database.insert(
        _workshopsTable,
        {
          'id': workshop.id,
          'title': workshop.title,
          'description': workshop.description,
          'start_time': workshop.startTime.toIso8601String(),
          'room_name': workshop.roomName,
          'capacity': workshop.capacity,
          'confirmed_count': workshop.confirmedCount,
          'fee': workshop.fee,
          'ai_summary': workshop.aiSummary,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }

    print('[Offline] Cached ${workshops.length} workshops');
  }

  // Get cached workshops
  Future<List<Workshop>> getCachedWorkshops() async {
    final database = await db;
    final result = await database.query(_workshopsTable);

    return result
        .map((map) => Workshop.fromJson(Map<String, dynamic>.from(map)))
        .toList();
  }

  // Check if online
  Future<bool> isOnline() async {
    final connectivityResult = await Connectivity().checkConnectivity();
    return connectivityResult != ConnectivityResult.none;
  }

  // Listen to connectivity changes
  Stream<bool> connectivityStream() {
    return Connectivity().onConnectivityChanged.map(
      (result) => result != ConnectivityResult.none,
    );
  }

  // Close database
  Future<void> close() async {
    if (_db != null) {
      await _db!.close();
      _db = null;
    }
  }
}
