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
  onReactionAdded?: () => void;
}

export function ReactionBar({ 
  eventId, 
  eventAuthor, 
  authState, 
  relayUrls,
  onReactionAdded 
}: ReactionBarProps) {
  const [isReacting, setIsReacting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const reactions = reactionManager.getReactions(eventId);

  const handleReact = async (emoji: string) => {
    if (!authState.isLoggedIn || authState.isReadOnly || !authState.privkey) {
      Alert.alert('Login Required', 'You need to login with nsec to react to posts');
      return;
    }

    try {
      setIsReacting(true);
      setShowPicker(false);

      await reactionManager.publishReaction(
        emoji,
        eventId,
        eventAuthor,
        authState.privkey,
        relayUrls
      );

      // Trigger refresh
      if (onReactionAdded) {
        onReactionAdded();
      }
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
            disabled={isReacting}
          >
            <Text style={styles.reactionEmoji}>{group.emoji}</Text>
            <Text style={styles.reactionCount}>{group.count}</Text>
          </TouchableOpacity>
        ))}

        {/* Add reaction button */}
        {authState.isLoggedIn && !authState.isReadOnly && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowPicker(!showPicker)}
            disabled={isReacting}
          >
            <Text style={styles.addButtonText}>+</Text>
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
});
