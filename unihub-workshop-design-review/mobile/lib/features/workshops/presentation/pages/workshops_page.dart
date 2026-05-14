import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

class WorkshopsPage extends StatefulWidget {
  const WorkshopsPage({super.key});

  @override
  State<WorkshopsPage> createState() => _WorkshopsPageState();
}

class _WorkshopsPageState extends State<WorkshopsPage> {
  List<Map<String, dynamic>> _workshops = [];
  bool _isLoading = true;
  String _searchQuery = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadWorkshops();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadWorkshops() async {
    setState(() => _isLoading = true);

    try {
      final workshops = await Supabase.instance.client
          .from('workshops')
          .select()
          .eq('is_published', true)
          .gte('start_time', DateTime.now().toIso8601String())
          .order('start_time');

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

  List<Map<String, dynamic>> get _filteredWorkshops {
    if (_searchQuery.isEmpty) return _workshops;
    
    return _workshops.where((w) {
      final title = w['title']?.toString().toLowerCase() ?? '';
      final speaker = w['speaker']?.toString().toLowerCase() ?? '';
      final query = _searchQuery.toLowerCase();
      return title.contains(query) || speaker.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Workshop'),
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Tìm kiếm workshop...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
              ),
              onChanged: (value) => setState(() => _searchQuery = value),
            ),
          ),

          // Workshop list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _loadWorkshops,
                    child: _filteredWorkshops.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.event_busy, size: 64, color: Colors.grey[400]),
                                const SizedBox(height: 16),
                                Text(
                                  _searchQuery.isEmpty
                                      ? 'Không có workshop nào'
                                      : 'Không tìm thấy kết quả',
                                  style: TextStyle(color: Colors.grey[600]),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: _filteredWorkshops.length,
                            itemBuilder: (context, index) {
                              final workshop = _filteredWorkshops[index];
                              return _WorkshopListItem(
                                workshop: workshop,
                                onTap: () => context.go('/workshops/${workshop['id']}'),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _WorkshopListItem extends StatelessWidget {
  final Map<String, dynamic> workshop;
  final VoidCallback onTap;

  const _WorkshopListItem({required this.workshop, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final date = DateTime.parse(workshop['start_time']);
    final spotsLeft = (workshop['capacity'] ?? 0) - (workshop['confirmed_count'] ?? 0);
    final fee = workshop['fee'] ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail
            if (workshop['thumbnail_url'] != null)
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                child: Image.network(
                  workshop['thumbnail_url'],
                  height: 150,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    height: 100,
                    color: Theme.of(context).colorScheme.primaryContainer,
                    child: Icon(
                      Icons.event,
                      size: 48,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ),
              ),
            
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    workshop['title'] ?? '',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),

                  // Speaker
                  if (workshop['speaker'] != null) ...[
                    Row(
                      children: [
                        Icon(Icons.person, size: 16, color: Colors.grey[600]),
                        const SizedBox(width: 4),
                        Text(
                          workshop['speaker'],
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                  ],

                  // Date and time
                  Row(
                    children: [
                      Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
                      const SizedBox(width: 4),
                      Text(
                        DateFormat('dd/MM/yyyy - HH:mm').format(date),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),

                  // Room
                  if (workshop['room_name'] != null) ...[
                    Row(
                      children: [
                        Icon(Icons.location_on, size: 16, color: Colors.grey[600]),
                        const SizedBox(width: 4),
                        Text(
                          workshop['room_name'],
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],

                  // Footer: spots and fee
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: spotsLeft > 0
                              ? Colors.green.shade100
                              : Colors.red.shade100,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          spotsLeft > 0 ? 'Còn $spotsLeft chỗ' : 'Hết chỗ',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: spotsLeft > 0 ? Colors.green.shade700 : Colors.red.shade700,
                          ),
                        ),
                      ),
                      Text(
                        fee > 0
                            ? NumberFormat.currency(locale: 'vi_VN', symbol: '₫').format(fee)
                            : 'Miễn phí',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
