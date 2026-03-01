import { View, Text, StyleSheet } from 'react-native';
import type { FilteredEvent } from '../lib/eventFilter';

interface FeedItemProps {
  event: FilteredEvent;
}

export function FeedItem({ event }: FeedItemProps) {
  return (
    <View style={styles.item}>
      <View style={styles.header}>
        <Text style={styles.author}>{event.author.substring(0, 16)}...</Text>
        <Text style={styles.timestamp}>{event.timestamp}</Text>
      </View>

      <Text style={styles.content}>{event.content}</Text>

      {event.hashtags.length > 0 && (
        <View style={styles.tagsContainer}>
          {event.hashtags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              #{tag}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  author: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    fontFamily: 'monospace',
  },
  timestamp: {
    fontSize: 11,
    color: '#9ca3af',
  },
  content: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
});