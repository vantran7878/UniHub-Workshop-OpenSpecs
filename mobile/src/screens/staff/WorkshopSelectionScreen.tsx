import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface Workshop {
  id: string;
  title: string;
  start_time: string;
  room: string;
}

export default function WorkshopSelectionScreen({ navigation }: any) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const { accessToken } = useAuth();

  useEffect(() => {
    const fetchWorkshops = async () => {
      try {
        // Staff can view all workshops to choose one for check-in
        const data = await apiFetch<Workshop[]>('/workshops', {
          token: accessToken || undefined,
        });
        setWorkshops(data);
      } catch (e: any) {
        Alert.alert('Error', 'Failed to load workshops');
      } finally {
        setLoading(loading);
        setLoading(false);
      }
    };
    fetchWorkshops();
  }, [accessToken]);

  const renderItem = ({ item }: { item: Workshop }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('QRScanner', { workshopId: item.id, title: item.title })}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.details}>📍 {item.room} | 🕒 {new Date(item.start_time).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Workshop</Text>
      <FlatList
        data={workshops}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  list: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: '#666',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
