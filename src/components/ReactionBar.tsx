import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { reactionManager } from '../lib/reactionManager';
import type { AuthState } from '../lib/authManager';

const AVAILABLE_REACTIONS = ['❤️', '🔥', '😂', '👍', '🌿', '💚'];

interface ReactionBarProps {
  eventId: string;
  eventAuthor: string;
  authState: AuthState;
  relayUrls: string[];
}

export function ReactionBar({ 
  eventId, 
  eventAuthor, 
  authState, 
  relayUrls
}: ReactionBarProps) {
  const [isReacting, setIsReacting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const reactions = reactionManager.getReactions(eventId);
  const repostCount = reactionManager.getRepostCount(eventId);
  const zapCount = reactionManager.getZapCount(eventId);
  const canUseBrowserSigner =
    authState.method === 'signer' &&
    typeof window !== 'undefined' &&
    typeof (window as any).nostr?.signEvent === 'function';
  const canWriteReaction = authState.isLoggedIn && (!authState.isReadOnly || canUseBrowserSigner);

  const handleReact = async (emoji: string) => {
    if (!authState.isLoggedIn) {
      Alert.alert('Login Required', 'You need to login to react to posts');
      return;
    }

    try {
      setIsReacting(true);
      setShowPicker(false);

      if (canUseBrowserSigner) {
        await reactionManager.publishReactionWithSigner(
          emoji,
          eventId,
          eventAuthor,
          relayUrls
        );
      } else {
        if (authState.isReadOnly || !authState.privkey) {
          Alert.alert('Login Required', 'Use nsec login or browser signer with signing permission');
          return;
        }

        await reactionManager.publishReaction(
          emoji,
          eventId,
          eventAuthor,
          authState.privkey,
          relayUrls
        );
      }

      reactionManager.fetchInteractions([eventId], relayUrls).catch(() => {
        // best-effort refresh
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add reaction');
    } finally {
      setIsReacting(false);
    }
  };

  const userHasReacted = (emoji: string) => {
    if (!authState.pubkey) return false;
    return reactionManager.hasUserReacted(eventId, authState.pubkey, emoji);
  };

  const userHasReposted = authState.pubkey
    ? reactionManager.hasUserReposted(eventId, authState.pubkey)
    : false;

  const handleRepost = async () => {
    if (!authState.isLoggedIn) {
      Alert.alert('Login Required', 'You need to login to repost');
      return;
    }

    try {
      setIsReacting(true);
      if (canUseBrowserSigner) {
        await reactionManager.publishRepostWithSigner(eventId, eventAuthor, relayUrls);
      } else {
        if (authState.isReadOnly || !authState.privkey) {
          Alert.alert('Login Required', 'Use nsec login or browser signer with signing permission');
          return;
        }
        await reactionManager.publishRepost(eventId, eventAuthor, authState.privkey, relayUrls);
      }

      reactionManager.fetchInteractions([eventId], relayUrls).catch(() => {
        // best-effort refresh
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to repost');
    } finally {
      setIsReacting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Display existing reactions */}
      <View style={styles.reactionsRow}>
        {reactions.map((group) => (
          <TouchableOpacity
            key={group.emoji}
            style={[
              styles.reactionBadge,
              userHasReacted(group.emoji) && styles.reactionBadgeActive
            ]}
            onPress={() => handleReact(group.emoji)}
            disabled={isReacting || !canWriteReaction}
          >
            <Text style={styles.reactionEmoji}>{group.emoji}</Text>
            <Text style={styles.reactionCount}>{group.count}</Text>
          </TouchableOpacity>
        ))}

        {/* Add reaction button */}
        {canWriteReaction && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowPicker(!showPicker)}
            disabled={isReacting}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionsRow}>
        <View style={[styles.metricBadge, userHasReposted && styles.metricBadgeActive]}>
          <Text style={styles.metricText}>🔁 {repostCount}</Text>
        </View>
        <View style={styles.metricBadge}>
          <Text style={styles.metricText}>⚡ {zapCount}</Text>
        </View>
        {canWriteReaction && (
          <TouchableOpacity
            style={[styles.repostButton, userHasReposted && styles.repostButtonActive]}
            onPress={handleRepost}
            disabled={isReacting}
          >
            <Text style={[styles.repostButtonText, userHasReposted && styles.repostButtonTextActive]}>
              Repost
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reaction picker */}
      {showPicker && (
        <View style={styles.picker}>
          {AVAILABLE_REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.pickerButton}
              onPress={() => handleReact(emoji)}
              disabled={isReacting}
            >
              <Text style={styles.pickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionBadgeActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#059669',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  addButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  pickerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickerEmoji: {
    fontSize: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  metricBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metricBadgeActive: {
    backgroundColor: '#dbeafe',
  },
  metricText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  repostButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#ffffff',
  },
  repostButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  repostButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  repostButtonTextActive: {
    color: '#1d4ed8',
  },
});
