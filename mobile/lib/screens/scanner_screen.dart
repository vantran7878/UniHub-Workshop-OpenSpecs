import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import 'package:unihub_staff/providers/auth_provider.dart';
import 'package:unihub_staff/providers/checkin_provider.dart';

class ScannerScreen extends StatefulWidget {
  final String workshopId;
  final String workshopTitle;

  const ScannerScreen({
    super.key,
    required this.workshopId,
    required this.workshopTitle,
  });

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  bool _isProcessing = false;
  MobileScannerController controller = MobileScannerController();

  void _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final String? qrCode = barcodes.first.rawValue;
    if (qrCode == null) return;

    setState(() => _isProcessing = true);

    final auth = context.read<AuthProvider>();
    final checkin = context.read<CheckinProvider>();

    try {
      final result = await checkin.processCheckin(
        qrCode: qrCode,
        workshopId: widget.workshopId,
        token: auth.token!,
        deviceId: 'MOBILE_DEVICE_01', // Should be actual device ID
      );

      if (mounted) {
        _showResult(result, qrCode);
      }
    } finally {
      Future.delayed(const Duration(seconds: 1), () {
        if (mounted) setState(() => _isProcessing = false);
      });
    }
  }

  void _showResult(CheckinResult result, String qrCode) {
    Color color;
    IconData icon;
    String message;

    switch (result) {
      case CheckinResult.success:
        color = Colors.green;
        icon = Icons.check_circle;
        message = 'Check-in Successful!';
        break;
      case CheckinResult.offlineSaved:
        color = Colors.blue;
        icon = Icons.cloud_off;
        message = 'Offline: Saved locally';
        break;
      case CheckinResult.alreadyCheckedIn:
        color = Colors.orange;
        icon = Icons.warning;
        message = 'Already Checked In';
        break;
      case CheckinResult.invalidQr:
        color = Colors.red;
        icon = Icons.error;
        message = 'Invalid QR Code';
        break;
      default:
        color = Colors.grey;
        icon = Icons.help;
        message = 'System Error';
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: color,
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Scanning...', style: TextStyle(fontSize: 16)),
            Text(widget.workshopTitle, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: controller.torchState,
              builder: (context, state, child) {
                switch (state) {
                  case TorchState.off:
                    return const Icon(Icons.flash_off, color: Colors.grey);
                  case TorchState.on:
                    return const Icon(Icons.flash_on, color: Colors.yellow);
                }
              },
            ),
            onPressed: () => controller.toggleTorch(),
          ),
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: controller.cameraFacingState,
              builder: (context, state, child) {
                switch (state) {
                  case CameraFacing.front:
                    return const Icon(Icons.camera_front);
                  case CameraFacing.back:
                    return const Icon(Icons.camera_rear);
                }
              },
            ),
            onPressed: () => controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: controller,
            onDetect: _onDetect,
          ),
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 2),
                borderRadius: BorderRadius.circular(24),
              ),
              child: _isProcessing 
                  ? const Center(child: CircularProgressIndicator(color: Colors.white))
                  : null,
            ),
          ),
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Consumer<CheckinProvider>(
              builder: (context, checkin, _) => Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: checkin.isOnline ? Colors.green.withOpacity(0.8) : Colors.orange.withOpacity(0.8),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        checkin.isOnline ? Icons.wifi : Icons.wifi_off,
                        color: Colors.white,
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        checkin.isOnline ? 'Online Mode' : 'Offline Mode',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
