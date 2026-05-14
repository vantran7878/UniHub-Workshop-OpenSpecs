import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

class WorkshopDetailPage extends StatefulWidget {
  final String workshopId;

  const WorkshopDetailPage({super.key, required this.workshopId});

  @override
  State<WorkshopDetailPage> createState() => _WorkshopDetailPageState();
}

class _WorkshopDetailPageState extends State<WorkshopDetailPage> {
  Map<String, dynamic>? _workshop;
  bool _isLoading = true;
  bool _isRegistering = false;
  bool _isRegistered = false;

  @override
  void initState() {
    super.initState();
    _loadWorkshop();
  }

  Future<void> _loadWorkshop() async {
    setState(() => _isLoading = true);

    try {
      final workshop = await Supabase.instance.client
          .from('workshops')
          .select()
          .eq('id', widget.workshopId)
          .single();

      // Check if user is already registered
      final user = Supabase.instance.client.auth.currentUser;
      if (user != null) {
        final registration = await Supabase.instance.client
            .from('registrations')
            .select()
            .eq('workshop_id', widget.workshopId)
            .eq('user_id', user.id)
            .maybeSingle();

        _isRegistered = registration != null && registration['status'] != 'cancelled';
      }

      if (mounted) {
        setState(() {
          _workshop = workshop;
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

  Future<void> _handleRegister() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      context.go('/auth/login');
      return;
    }

    setState(() => _isRegistering = true);

    try {
      // Generate QR code
      final qrCode = '${widget.workshopId}_${user.id}_${DateTime.now().millisecondsSinceEpoch}';
      
      // Create registration
      await Supabase.instance.client.from('registrations').insert({
        'workshop_id': widget.workshopId,
        'user_id': user.id,
        'status': _workshop!['fee'] > 0 ? 'pending' : 'confirmed',
        'qr_code': qrCode,
      });

      if (mounted) {
        setState(() {
          _isRegistered = true;
          _isRegistering = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _workshop!['fee'] > 0
                  ? 'Đăng ký thành công! Vui lòng thanh toán để xác nhận.'
                  : 'Đăng ký thành công!',
            ),
            backgroundColor: Colors.green,
          ),
        );

        // Reload workshop to get updated count
        _loadWorkshop();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isRegistering = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi đăng ký: $e'), backgroundColor: Colors.red),
        );
      }
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

    if (_workshop == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Không tìm thấy workshop')),
      );
    }

    final date = DateTime.parse(_workshop!['start_time']);
    final endDate = DateTime.parse(_workshop!['end_time']);
    final spotsLeft = (_workshop!['capacity'] ?? 0) - (_workshop!['confirmed_count'] ?? 0);
    final fee = _workshop!['fee'] ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết Workshop'),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail
            if (_workshop!['thumbnail_url'] != null)
              Image.network(
                _workshop!['thumbnail_url'],
                height: 200,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  height: 150,
                  color: Theme.of(context).colorScheme.primaryContainer,
                  child: Icon(
                    Icons.event,
                    size: 64,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              )
            else
              Container(
                height: 150,
                width: double.infinity,
                color: Theme.of(context).colorScheme.primaryContainer,
                child: Icon(
                  Icons.event,
                  size: 64,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    _workshop!['title'] ?? '',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Info cards
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
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
                          if (_workshop!['room_name'] != null) ...[
                            const Divider(),
                            _InfoRow(
                              icon: Icons.location_on,
                              label: 'Địa điểm',
                              value: _workshop!['room_name'],
                            ),
                          ],
                          if (_workshop!['speaker'] != null) ...[
                            const Divider(),
                            _InfoRow(
                              icon: Icons.person,
                              label: 'Diễn giả',
                              value: _workshop!['speaker'],
                            ),
                          ],
                          const Divider(),
                          _InfoRow(
                            icon: Icons.people,
                            label: 'Số chỗ còn',
                            value: '$spotsLeft / ${_workshop!['capacity']}',
                            valueColor: spotsLeft <= 5 ? Colors.orange : null,
                          ),
                          const Divider(),
                          _InfoRow(
                            icon: Icons.attach_money,
                            label: 'Phí tham gia',
                            value: fee > 0
                                ? NumberFormat.currency(locale: 'vi_VN', symbol: '₫').format(fee)
                                : 'Miễn phí',
                            valueColor: Theme.of(context).colorScheme.primary,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Description
                  if (_workshop!['description'] != null) ...[
                    Text(
                      'Mô tả',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _workshop!['description'],
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Speaker bio
                  if (_workshop!['speaker_bio'] != null) ...[
                    Text(
                      'Về diễn giả',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _workshop!['speaker_bio'],
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                  ],

                  // AI Summary
                  if (_workshop!['ai_summary'] != null) ...[
                    Card(
                      color: Theme.of(context).colorScheme.secondaryContainer,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.auto_awesome,
                                  size: 20,
                                  color: Theme.of(context).colorScheme.secondary,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Tóm tắt AI',
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(_workshop!['ai_summary']),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  const SizedBox(height: 80), // Space for button
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: _isRegistered
              ? OutlinedButton.icon(
                  onPressed: () => context.go('/registrations'),
                  icon: const Icon(Icons.check_circle),
                  label: const Text('Đã đăng ký - Xem chi tiết'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52),
                  ),
                )
              : FilledButton.icon(
                  onPressed: spotsLeft > 0 && !_isRegistering ? _handleRegister : null,
                  icon: _isRegistering
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.add),
                  label: Text(
                    spotsLeft <= 0
                        ? 'Hết chỗ'
                        : _isRegistering
                            ? 'Đang đăng ký...'
                            : 'Đăng ký tham gia',
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52),
                  ),
                ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
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
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}
