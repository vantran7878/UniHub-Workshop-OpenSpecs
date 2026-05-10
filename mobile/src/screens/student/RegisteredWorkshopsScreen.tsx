import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import QRCode from 'react-native-qrcode-svg';

interface Registration {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'failed';
  qr_code: string | null;
  workshop_id: string;
  title: string;
  start_time: string;
  room: string;
}

export default function RegisteredWorkshopsScreen() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { accessToken } = useAuth();

  const fetchRegistrations = useCallback(async () => {
    try {
      const data = await apiFetch<{ registrations: Registration[] }>('/my-registrations', {
        token: accessToken || undefined,
      });
      setRegistrations(data.registrations);
    } catch (e: any) {
      console.error('Failed to fetch registrations', e);
      Alert.alert('Error', 'Could not load your workshops');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRegistrations();
  };

  const renderItem = ({ item }: { item: Registration }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={[styles.statusBadge, styles[`status_${item.status}`]]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.details}>
        <Text style={styles.detailText}>📅 {new Date(item.start_time).toLocaleString()}</Text>
        <Text style={styles.detailText}>📍 Room: {item.room}</Text>
      </View>

      {item.status === 'confirmed' && item.qr_code && (
        <View style={styles.qrContainer}>
          <QRCode value={item.qr_code} size={150} />
          <Text style={styles.qrHelp}>Show this to check-in</Text>
        </View>
      )}
      
      {item.status === 'pending' && (
        <View style={styles.pendingContainer}>
          <Text style={styles.pendingText}>Payment pending. Please complete in Web App.</Text>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Workshops</Text>
      <FlatList
        data={registrations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>You haven't registered for any workshops yet.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles: any = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 60,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginBottom: 20,
    color: '#1a1a1a',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  status_confirmed: { backgroundColor: '#34C759' },
  status_pending: { backgroundColor: '#FFCC00' },
  status_cancelled: { backgroundColor: '#FF3B30' },
  status_no_show: { backgroundColor: '#8E8E93' },
  status_failed: { backgroundColor: '#FF3B30' },
  details: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  qrContainer: {
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  qrHelp: {
    marginTop: 10,
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  pendingContainer: {
    backgroundColor: '#FFFBE6',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE58F',
  },
  pendingText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  empty: {
    paddingTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
