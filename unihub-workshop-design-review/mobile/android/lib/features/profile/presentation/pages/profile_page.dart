import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../services/auth_service.dart';
import '../../../models/models.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final authService = AuthService();
  User? _user;
  int _registrationCount = 0;
  bool _isLoading = true;
  bool _isLogoutLoading = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    setState(() => _isLoading = true);

    try {
      final user = await authService.getCurrentUser();
      
      if (user != null) {
        // Get registration count
        try {
          final registrations = await Supabase.instance.client
              .from('registrations')
              .select()
              .eq('user_id', user.id)
              .eq('status', 'confirmed');

          if (mounted) {
            setState(() {
              _user = user;
              _registrationCount = (registrations as List).length;
              _isLoading = false;
            });
          }
        } catch (e) {
          if (mounted) {
            setState(() {
              _user = user;
              _isLoading = false;
            });
          }
        }
      } else {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _getRoleLabel(String role) {
    switch (role) {
      case 'admin':
        return 'Quản trị viên';
      case 'staff':
        return 'Nhân viên';
      case 'student':
      default:
        return 'Sinh viên';
    }
  }

  Color _getRoleColor(String role) {
    switch (role) {
      case 'admin':
        return Colors.red;
      case 'staff':
        return Colors.blue;
      case 'student':
      default:
        return Colors.green;
    }
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Đăng xuất'),
        content: const Text('Bạn có chắc chắn muốn đăng xuất?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      setState(() => _isLogoutLoading = true);
      try {
        await authService.logout();
        if (mounted) {
          context.go('/auth/login');
        }
      } catch (e) {
        setState(() => _isLogoutLoading = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Lỗi: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Hồ sơ')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Hồ sơ')),
        body: const Center(child: Text('Không thể tải thông tin')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hồ sơ'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Profile header
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        child: Center(
                          child: Text(
                            _user!.fullName.isEmpty
                                ? '?'
                                : _user!.fullName[0].toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _user!.fullName,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _user!.email,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey[600],
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Info section
            Card(
              child: Column(
                children: [
                  // Role
                  ListTile(
                    leading: Icon(
                      Icons.person,
                      color: _getRoleColor(_user!.role),
                    ),
                    title: const Text('Vai trò'),
                    trailing: Chip(
                      label: Text(_getRoleLabel(_user!.role)),
                      backgroundColor: _getRoleColor(_user!.role).withOpacity(0.2),
                      labelStyle: TextStyle(
                        color: _getRoleColor(_user!.role),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (_user!.studentId != null) ...[
                    const Divider(height: 0),
                    ListTile(
                      leading: const Icon(Icons.badge),
                      title: const Text('Mã sinh viên'),
                      subtitle: Text(_user!.studentId!),
                    ),
                  ],
                  if (_user!.role == 'student' && _registrationCount > 0) ...[
                    const Divider(height: 0),
                    ListTile(
                      leading: const Icon(Icons.event_available),
                      title: const Text('Đã đăng ký'),
                      subtitle: Text('$_registrationCount workshop'),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),

            // App info
            Card(
              child: const ListTile(
                leading: Icon(Icons.info_outline),
                title: Text('Phiên bản ứng dụng'),
                subtitle: Text('1.0.0'),
              ),
            ),
            const SizedBox(height: 24),

            // Logout button
            FilledButton(
              onPressed: _isLogoutLoading ? null : _handleLogout,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.red,
                minimumSize: const Size(double.infinity, 48),
              ),
              child: _isLogoutLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text('Đăng xuất'),
            ),
          ],
        ),
      ),
    );
  }
}

