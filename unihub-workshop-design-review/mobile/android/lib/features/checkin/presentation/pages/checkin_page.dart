import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import '../../../services/api_service.dart';
import '../../../services/offline_service.dart';
import '../../../models/models.dart';

class CheckinPage extends StatefulWidget {
  const CheckinPage({super.key});

  @override
  State<CheckinPage> createState() => _CheckinPageState();
}

class _CheckinPageState extends State<CheckinPage> {
  final apiService = ApiService();
  final offlineService = OfflineService();

  List<Workshop> _workshops = [];
  String? _selectedWorkshopId;
  bool _isLoading = true;
  bool _isScanning = false;
  bool _isProcessing = false;
  String? _lastResult;
  bool? _lastSuccess;
  Map<String, dynamic>? _lastUser;
  int _checkinCount = 0;
  int _pendingSyncCount = 0;
  bool _isOnline = true;
  MobileScannerController? _scannerController;

  @override
  void initState() {
    super.initState();
    _loadWorkshops();
    _checkConnectivity();
    _listenToConnectivity();
    _checkPendingSync();
  }

  @override
  void dispose() {
    _scannerController?.dispose();
    offlineService.close();
    super.dispose();
  }

  void _checkConnectivity() async {
    final isOnline = await offlineService.isOnline();
    setState(() => _isOnline = isOnline);
  }

  void _listenToConnectivity() {
    offlineService.connectivityStream().listen((isOnline) {
      setState(() => _isOnline = isOnline);
      if (isOnline) {
        _syncOfflineCheckins();
      }
    });
  }

  Future<void> _checkPendingSync() async {
    final unsyncedCheckins = await offlineService.getUnsyncedCheckins();
    setState(() => _pendingSyncCount = unsyncedCheckins.length);
  }

  Future<void> _loadWorkshops() async {
    setState(() => _isLoading = true);

    try {
      final workshops = await apiService.getWorkshops();
      await offlineService.cacheWorkshops(workshops);

      if (mounted) {
        setState(() {
          _workshops = workshops;
          _isLoading = false;
        });
      }
    } catch (e) {
      // Fallback to cached workshops
      try {
        final cachedWorkshops = await offlineService.getCachedWorkshops();
        if (mounted) {
          setState(() {
            _workshops = cachedWorkshops;
            _isLoading = false;
          });
        }
      } catch (e2) {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  Future<void> _loadCheckinCount() async {
    if (_selectedWorkshopId == null) return;

    try {
      final count = await apiService.getCheckinCountForWorkshop(_selectedWorkshopId!);
      if (mounted) {
        setState(() => _checkinCount = count);
      }
    } catch (e) {
      print('Error loading checkin count: $e');
    }
  }

  Future<void> _syncOfflineCheckins() async {
    if (!_isOnline || _pendingSyncCount == 0) return;

    try {
      final unsyncedCheckins = await offlineService.getUnsyncedCheckins();
      if (unsyncedCheckins.isEmpty) return;

      await apiService.syncOfflineCheckins(unsyncedCheckins);
      
      final checkinIds = unsyncedCheckins
          .where((c) => c.id != null)
          .map((c) => c.id!)
          .toList();
      await offlineService.markAsSynced(checkinIds);

      setState(() => _pendingSyncCount = 0);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã đồng bộ ${unsyncedCheckins.length} check-in'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      print('Error syncing checkins: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Lỗi khi đồng bộ. Sẽ thử lại khi có kết nối'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  void _startScanning() {
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );
    setState(() {
      _isScanning = true;
      _lastResult = null;
      _lastSuccess = null;
      _lastUser = null;
    });
  }

  void _stopScanning() {
    _scannerController?.dispose();
    _scannerController = null;
    setState(() => _isScanning = false);
  }

  Future<void> _processQRCode(String qrCode) async {
    if (_isProcessing || _selectedWorkshopId == null) return;

    setState(() => _isProcessing = true);

    try {
      // Find registration by QR code
      final registration = await apiService.getRegistrationByQrCode(
        qrCode,
        _selectedWorkshopId!,
      );

      if (registration == null) {
        setState(() {
          _lastResult = 'Mã QR không hợp lệ hoặc không thuộc workshop này';
          _lastSuccess = false;
          _lastUser = null;
        });
        return;
      }

      if (registration['status'] != 'confirmed') {
        setState(() {
          _lastResult = 'Đăng ký chưa được xác nhận';
          _lastSuccess = false;
          _lastUser = registration['user'];
        });
        return;
      }

      // Check if already checked in (offline check using local DB + online check)
      bool alreadyCheckedIn = false;
      if (_isOnline) {
        try {
          final existingCheckin = await Supabase.instance.client
              .from('checkins')
              .select()
              .eq('registration_id', registration['id'])
              .maybeSingle();
          alreadyCheckedIn = existingCheckin != null;
        } catch (e) {
          print('Error checking existing checkin: $e');
        }
      }

      if (alreadyCheckedIn) {
        setState(() {
          _lastResult = 'Đã check-in trước đó';
          _lastSuccess = false;
          _lastUser = registration['user'];
        });
        return;
      }

      // Create checkin (online or offline)
      try {
        if (_isOnline) {
          await apiService.createCheckin(
            registrationId: registration['id'],
            workshopId: _selectedWorkshopId!,
          );
        } else {
          // Save offline checkin
          final userId = Supabase.instance.client.auth.currentUser?.id;
          await offlineService.saveOfflineCheckin(
            OfflineCheckin(
              registrationId: registration['id'],
              workshopId: _selectedWorkshopId!,
              checkedInBy: userId,
              checkedInAt: DateTime.now(),
            ),
          );
          _checkPendingSync();
        }

        setState(() {
          _lastResult = _isOnline
              ? 'Check-in thành công!'
              : 'Check-in lưu offline. Sẽ đồng bộ khi có mạng';
          _lastSuccess = true;
          _lastUser = registration['user'];
          _checkinCount++;
        });
      } catch (e) {
        // Fallback to offline
        final userId = Supabase.instance.client.auth.currentUser?.id;
        await offlineService.saveOfflineCheckin(
          OfflineCheckin(
            registrationId: registration['id'],
            workshopId: _selectedWorkshopId!,
            checkedInBy: userId,
            checkedInAt: DateTime.now(),
          ),
        );
        _checkPendingSync();

        setState(() {
          _lastResult = 'Check-in lưu offline. Sẽ đồng bộ khi có mạng';
          _lastSuccess = true;
          _lastUser = registration['user'];
          _checkinCount++;
        });
      }
    } catch (e) {
      setState(() {
        _lastResult = 'Lỗi: $e';
        _lastSuccess = false;
      });
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Check-in'),
        actions: [
          if (_isScanning)
            IconButton(
              icon: const Icon(Icons.close),
              onPressed: _stopScanning,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _isScanning
              ? _buildScanner()
              : _buildSetup(),
    );
  }

  Widget _buildSetup() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Workshop selector
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Chọn Workshop',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _selectedWorkshopId,
                    decoration: const InputDecoration(
                      hintText: 'Chọn workshop để check-in',
                      prefixIcon: Icon(Icons.event),
                    ),
                    items: _workshops.map((workshop) {
                      final date = workshop.startTime;
                      return DropdownMenuItem(
                        value: workshop.id,
                        child: Text(
                          '${workshop.title} (${DateFormat('HH:mm').format(date)})',
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                    onChanged: (value) {
                      setState(() {
                        _selectedWorkshopId = value;
                        _checkinCount = 0;
                      });
                      _loadCheckinCount();
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Stats
          if (_selectedWorkshopId != null) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(
                      Icons.people,
                      size: 40,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$_checkinCount',
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        Text(
                          'Đã check-in',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],

          const Spacer(),

          // Offline mode indicator
          if (!_isOnline)
            Card(
              color: Colors.orange.shade50,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(Icons.cloud_off, color: Colors.orange.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Chế độ offline',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.orange.shade700,
                            ),
                          ),
                          Text(
                            'Check-in sẽ được lưu và đồng bộ khi có mạng',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.orange.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (!_isOnline) const SizedBox(height: 16),

          // Pending sync count
          if (_pendingSyncCount > 0)
            Card(
              color: Colors.blue.shade50,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(Icons.sync_outlined, color: Colors.blue.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Có $_pendingSyncCount check-in chờ đồng bộ',
                        style: TextStyle(color: Colors.blue.shade700),
                      ),
                    ),
                    if (_isOnline)
                      FilledButton(
                        onPressed: _syncOfflineCheckins,
                        child: const Text('Đồng bộ ngay'),
                      ),
                  ],
                ),
              ),
            ),
          if (_pendingSyncCount > 0) const SizedBox(height: 16),

          // Start scanning button
          FilledButton.icon(
            onPressed: _selectedWorkshopId != null ? _startScanning : null,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Bắt đầu quét mã'),
            style: FilledButton.styleFrom(
              minimumSize: const Size(double.infinity, 56),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScanner() {
    return Stack(
      children: [
        // Camera scanner
        MobileScanner(
          controller: _scannerController,
          onDetect: (capture) {
            final barcode = capture.barcodes.firstOrNull;
            if (barcode?.rawValue != null && !_isProcessing) {
              _processQRCode(barcode!.rawValue!);
            }
          },
        ),

        // Overlay
        Container(
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.3),
          ),
        ),

        // Scan area indicator
        Center(
          child: Container(
            width: 250,
            height: 250,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white, width: 2),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),

        // Result panel
        if (_lastResult != null)
          Positioned(
            left: 16,
            right: 16,
            bottom: 100,
            child: Card(
              color: _lastSuccess == true ? Colors.green : Colors.red,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(
                      _lastSuccess == true ? Icons.check_circle : Icons.error,
                      color: Colors.white,
                      size: 48,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _lastResult!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    if (_lastUser != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '${_lastUser!['full_name']}${_lastUser!['student_id'] != null ? ' (${_lastUser!['student_id']})' : ''}',
                        style: const TextStyle(color: Colors.white70),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),

        // Stats
        Positioned(
          left: 16,
          right: 16,
          top: 16,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.people),
                  const SizedBox(width: 8),
                  Text(
                    'Đã check-in: $_checkinCount',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
