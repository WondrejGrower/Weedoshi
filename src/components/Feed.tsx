import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FeedItem } from './FeedItem';
import type { FilteredEvent } from '../lib/eventFilter';

interface FeedProps {
  events: FilteredEvent[];
  isLoading: boolean;
  error: string | null;
}

export function Feed({ events, isLoading, error }: FeedProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No events found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
      {events.map((event) => (
        <FeedItem key={event.id} event={event} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  feed: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});