import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { threadManager } from '../lib/threadManager';

interface ThreadIndicatorProps {
  eventId: string;
  onViewThread?: () => void;
}

export function ThreadIndicator({ eventId, onViewThread }: ThreadIndicatorProps) {
  const replyCount = threadManager.getReplyCount(eventId);
  const isReply = threadManager.isReply(eventId);
  const relations = threadManager.getRelationships(eventId);

  // Don't show anything if no thread info
  if (replyCount === 0 && !isReply) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Reply indicator */}
      {isReply && (
        <View style={styles.replyBadge}>
          <Text style={styles.replyIcon}>↪️</Text>
          <Text style={styles.replyText}>Reply</Text>
        </View>
      )}

      {/* Reply count */}
      {replyCount > 0 && (
        <TouchableOpacity
          style={styles.threadBadge}
          onPress={onViewThread}
          disabled={!onViewThread}
        >
          <Text style={styles.threadIcon}>💬</Text>
          <Text style={styles.threadText}>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Root reference (if reply) */}
      {isReply && relations?.rootId && (
        <View style={styles.rootBadge}>
          <Text style={styles.rootText}>
            → {relations.rootId.substring(0, 8)}...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  replyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  replyIcon: {
    fontSize: 12,
  },
  replyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
  },
  threadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  threadIcon: {
    fontSize: 12,
  },
  threadText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  rootBadge: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rootText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#9ca3af',
  },
});
