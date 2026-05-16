import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import 'package:unihub_mobile/models/models.dart';

class RegistrationDetailPage extends StatefulWidget {
  final String registrationId;

  const RegistrationDetailPage({super.key, required this.registrationId});

  @override
  State<RegistrationDetailPage> createState() => _RegistrationDetailPageState();
}

class _RegistrationDetailPageState extends State<RegistrationDetailPage> {
  Map<String, dynamic>? _registration;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRegistration();
  }

  Future<void> _loadRegistration() async {
    setState(() => _isLoading = true);

    try {
      final registration = await Supabase.instance.client
          .from('registrations')
          .select('*, workshops(*)')
          .eq('id', widget.registrationId)
          .single();

      if (mounted) {
        setState(() {
          _registration = registration;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'confirmed':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'confirmed':
        return 'Đã xác nhận';
      case 'pending':
        return 'Chờ thanh toán';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_registration == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Không tìm thấy đăng ký')),
      );
    }

    final workshopData = _registration!['workshops'];
    final workshop = (workshopData is List && workshopData.isNotEmpty) 
        ? workshopData.first 
        : workshopData;

    final status = _registration!['status'] ?? 'pending';
    final qrCode = _registration!['qr_code'];
    final date = workshop?['start_time'] != null 
        ? DateTime.parse(workshop['start_time']) 
        : DateTime.now();
    final endDate = workshop?['end_time'] != null 
        ? DateTime.parse(workshop['end_time']) 
        : date.add(const Duration(hours: 2));

    final createdAtStr = _registration!['created_at'] as String?;
    final confirmedAtStr = _registration!['confirmed_at'] as String?;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết đăng ký'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // QR Code Section
            if (qrCode != null && status == 'confirmed') ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Text(
                        'Mã QR Check-in',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: QrImageView(
                          data: qrCode,
                          version: QrVersions.auto,
                          size: 200.0,
                          backgroundColor: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Đưa mã này cho nhân viên để check-in',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.grey[600],
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ] else if (status == 'pending') ...[
              Card(
                color: Colors.orange.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(Icons.qr_code_2, size: 64, color: Colors.orange.shade300),
                      const SizedBox(height: 16),
                      Text(
                        'Mã QR chưa sẵn sàng',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.orange.shade800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Vui lòng hoàn tất thanh toán để nhận mã QR check-in.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.orange.shade800),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Status
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: _getStatusColor(status).withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _getStatusColor(status)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    status == 'confirmed'
                        ? Icons.check_circle
                        : status == 'pending'
                            ? Icons.access_time
                            : Icons.cancel,
                    size: 20,
                    color: _getStatusColor(status),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _getStatusText(status),
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: _getStatusColor(status),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Workshop info
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      workshop['title'] ?? '',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _InfoRow(
                      icon: Icons.calendar_today,
                      label: 'Ngày',
                      value: DateFormat('EEEE, dd/MM/yyyy', 'vi_VN').format(date),
                    ),
                    const Divider(),
                    _InfoRow(
                      icon: Icons.access_time,
                      label: 'Thời gian',
                      value: '${DateFormat('HH:mm').format(date)} - ${DateFormat('HH:mm').format(endDate)}',
                    ),
                    if (workshop['room_name'] != null) ...[
                      const Divider(),
                      _InfoRow(
                        icon: Icons.location_on,
                        label: 'Địa điểm',
                        value: workshop['room_name'],
                      ),
                    ],
                    if (workshop['speaker'] != null) ...[
                      const Divider(),
                      _InfoRow(
                        icon: Icons.person,
                        label: 'Diễn giả',
                        value: workshop['speaker'],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Registration info
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Thông tin đăng ký',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _InfoRow(
                      icon: Icons.confirmation_number,
                      label: 'Mã đăng ký',
                      value: widget.registrationId.length >= 8 
                          ? widget.registrationId.substring(0, 8).toUpperCase()
                          : widget.registrationId.toUpperCase(),
                    ),
                    if (createdAtStr != null) ...[
                      const Divider(),
                      _InfoRow(
                        icon: Icons.event_available,
                        label: 'Ngày đăng ký',
                        value: DateFormat('dd/MM/yyyy HH:mm').format(
                          DateTime.parse(createdAtStr),
                        ),
                      ),
                    ],
                    if (confirmedAtStr != null) ...[
                      const Divider(),
                      _InfoRow(
                        icon: Icons.verified,
                        label: 'Ngày xác nhận',
                        value: DateFormat('dd/MM/yyyy HH:mm').format(
                          DateTime.parse(confirmedAtStr),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // Pending payment notice
            if (status == 'pending') ...[
              const SizedBox(height: 16),
              Card(
                color: Colors.orange.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.payment, color: Colors.orange.shade700),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Vui lòng thanh toán để hoàn tất đăng ký',
                          style: TextStyle(color: Colors.orange.shade700),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 12),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.grey[600],
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
