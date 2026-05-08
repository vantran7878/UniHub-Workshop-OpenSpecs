import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'package:unihub_staff/providers/auth_provider.dart';
import 'package:unihub_staff/providers/checkin_provider.dart';
import 'package:unihub_staff/screens/scanner_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<dynamic> _workshops = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchWorkshops();
  }

  Future<void> _fetchWorkshops() async {
    final auth = context.read<AuthProvider>();
    try {
      final response = await http.get(
        Uri.parse('${auth.baseUrl}/workshops'),
        headers: {'Authorization': 'Bearer ${auth.token}'},
      );

      if (response.statusCode == 200) {
        setState(() {
          _workshops = json.decode(response.body);
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handlePreload(String workshopId, String title) async {
    final auth = context.read<AuthProvider>();
    final checkin = context.read<CheckinProvider>();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );

    try {
      await checkin.preloadWorkshop(workshopId, auth.token!);
      if (mounted) {
        Navigator.pop(context); // Close loading
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offline data preloaded successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preload failed. Check internet.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final checkin = context.watch<CheckinProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('UniHub Staff', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: () => checkin.syncOfflineCheckins(auth.token),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFF4F46E5).withOpacity(0.1),
                  child: const Icon(Icons.person, color: Color(0xFF4F46E5)),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      auth.user?['full_name'] ?? 'Staff',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    Text(
                      checkin.isOnline ? 'Online' : 'Offline Mode',
                      style: TextStyle(
                        color: checkin.isOnline ? Colors.green : Colors.orange,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _workshops.isEmpty
                    ? const Center(child: Text('No workshops found'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _workshops.length,
                        itemBuilder: (context, index) {
                          final workshop = _workshops[index];
                          return Card(
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(color: Colors.grey.shade200),
                            ),
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ListTile(
                              contentPadding: const EdgeInsets.all(16),
                              title: Text(
                                workshop['title'],
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Text(workshop['speaker']),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const Icon(Icons.room, size: 14, color: Colors.grey),
                                      const SizedBox(width: 4),
                                      Text(workshop['room'], style: const TextStyle(fontSize: 12)),
                                      const SizedBox(width: 12),
                                      const Icon(Icons.people, size: 14, color: Colors.grey),
                                      const SizedBox(width: 4),
                                      Text('${workshop['capacity'] - workshop['seats_available']} joined', style: const TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                ],
                              ),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.download, color: Color(0xFF4F46E5)),
                                    onPressed: () => _handlePreload(workshop['id'], workshop['title']),
                                    tooltip: 'Preload for offline',
                                  ),
                                ],
                              ),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => ScannerScreen(
                                      workshopId: workshop['id'],
                                      workshopTitle: workshop['title'],
                                    ),
                                  ),
                                );
                              },
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
