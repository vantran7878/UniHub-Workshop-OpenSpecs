import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

class CheckinPage extends StatefulWidget {
  const CheckinPage({super.key});

  @override
  State<CheckinPage> createState() => _CheckinPageState();
}

class _CheckinPageState extends State<CheckinPage> {
  List<Map<String, dynamic>> _workshops = [];
  String? _selectedWorkshopId;
  bool _isLoading = true;
  bool _isScanning = false;
  bool _isProcessing = false;
  String? _lastResult;
  bool? _lastSuccess;
  Map<String, dynamic>? _lastUser;
  int _checkinCount = 0;
  MobileScannerController? _scannerController;

  @override
  void initState() {
    super.initState();
    _loadWorkshops();
  }

  @override
  void dispose() {
    _scannerController?.dispose();
    super.dispose();
  }

  Future<void> _loadWorkshops() async {
    setState(() => _isLoading = true);

    try {
      final today = DateTime.now();
      final startOfDay = DateTime(today.year, today.month, today.day);

      final workshops = await Supabase.instance.client
          .from('workshops')
          .select()
          .gte('start_time', startOfDay.toIso8601String())
          .order('start_time')
          .limit(20);

      if (mounted) {
        setState(() {
          _workshops = List<Map<String, dynamic>>.from(workshops);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _loadCheckinCount() async {
    if (_selectedWorkshopId == null) return;

    final response = await Supabase.instance.client
        .from('checkins')
        .select('id', const FetchOptions(count: CountOption.exact))
        .eq('workshop_id', _selectedWorkshopId!);

    // Note: The count is returned as metadata
    // For now, we'll count from the response
    if (mounted) {
      setState(() {
        // This is a workaround - in production, use proper count
        _checkinCount = (response as List).length;
      });
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
      final registration = await Supabase.instance.client
          .from('registrations')
          .select('*, user:users(full_name, student_id)')
          .eq('qr_code', qrCode)
          .eq('workshop_id', _selectedWorkshopId!)
          .maybeSingle();

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

      // Check if already checked in
      final existingCheckin = await Supabase.instance.client
          .from('checkins')
          .select()
          .eq('registration_id', registration['id'])
          .maybeSingle();

      if (existingCheckin != null) {
        setState(() {
          _lastResult = 'Đã check-in trước đó';
          _lastSuccess = false;
          _lastUser = registration['user'];
        });
        return;
      }

      // Create checkin
      await Supabase.instance.client.from('checkins').insert({
        'registration_id': registration['id'],
        'workshop_id': _selectedWorkshopId,
        'checked_in_by': Supabase.instance.client.auth.currentUser?.id,
      });

      setState(() {
        _lastResult = 'Check-in thành công!';
        _lastSuccess = true;
        _lastUser = registration['user'];
        _checkinCount++;
      });
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
                      final date = DateTime.parse(workshop['start_time']);
                      return DropdownMenuItem(
                        value: workshop['id'] as String,
                        child: Text(
                          '${workshop['title']} (${DateFormat('HH:mm').format(date)})',
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
