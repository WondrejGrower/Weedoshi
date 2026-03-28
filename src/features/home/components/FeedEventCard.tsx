import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Event as NostrRawEvent } from 'nostr-tools';
import type { FilteredEvent } from '../../../lib/eventFilter';
import type { AuthState } from '../../../lib/authManager';
import { PostMediaRenderer } from '../../../components/PostMediaRenderer';
import { ReactionBar } from '../../../components/ReactionBar';
import { ThreadIndicator } from '../../../components/ThreadIndicator';
import { shortPubkey } from '../profileHelpers';

type FeedEventCardProps = {
  event: FilteredEvent;
  allowAddToGrowmies: boolean;
  isNight: boolean;
  authState: AuthState;
  relayUrls: string[];
  feedAuthorNames: Record<string, string>;
  growmies: string[];
  onOpenProfile: (pubkey: string) => void;
  onOpenAddToDiary: (event: NostrRawEvent) => void;
  onAddToGrowmies: (pubkey: string) => void;
};

function FeedEventCardInner({
  event,
  allowAddToGrowmies,
  isNight,
  authState,
  relayUrls,
  feedAuthorNames,
  growmies,
  onOpenProfile,
  onOpenAddToDiary,
  onAddToGrowmies,
}: FeedEventCardProps) {
  return (
    <View key={event.id} style={[localStyles.feedItem, isNight && localStyles.feedItemNight]}>
      <View style={localStyles.feedItemHeader}>
        <TouchableOpacity style={[localStyles.feedAuthorAvatar, isNight && localStyles.feedAuthorAvatarNight]} onPress={() => onOpenProfile(event.author)}>
          <Text style={[localStyles.feedAuthorAvatarText, isNight && localStyles.feedAuthorAvatarTextNight]}>
            {(feedAuthorNames[event.author] || shortPubkey(event.author)).slice(0, 1).toUpperCase()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={localStyles.feedAuthorMeta} onPress={() => onOpenProfile(event.author)}>
          <Text style={[localStyles.author, isNight && localStyles.authorNight]}>{feedAuthorNames[event.author] || shortPubkey(event.author)}</Text>
          <Text style={[localStyles.timestamp, isNight && localStyles.timestampNight]}>{event.timestamp}</Text>
        </TouchableOpacity>
      </View>

      <PostMediaRenderer content={event.content} tags={event.tags} textNumberOfLines={5} isNight={isNight} />

      <View style={localStyles.tagsContainer}>
        {event.hashtags.map((tag) => (
          <Text key={tag} style={[localStyles.tag, isNight && localStyles.tagNight]}>
            #{tag}
          </Text>
        ))}
      </View>

      <ReactionBar
        eventId={event.id}
        eventAuthor={event.author}
        authState={authState}
        relayUrls={relayUrls}
      />

      <ThreadIndicator eventId={event.id} />

      {authState.isLoggedIn && (
        <TouchableOpacity style={[localStyles.actionMini, isNight && localStyles.actionMiniNight]} onPress={() => onOpenAddToDiary(event as unknown as NostrRawEvent)}>
          <Text style={[localStyles.actionMiniText, isNight && localStyles.actionMiniTextNight]}>Add to Diary</Text>
        </TouchableOpacity>
      )}

      {allowAddToGrowmies && authState.isLoggedIn && event.author !== authState.pubkey && !growmies.includes(event.author) && (
        <TouchableOpacity style={[localStyles.actionMini, isNight && localStyles.actionMiniNight]} onPress={() => onAddToGrowmies(event.author)}>
          <Text style={[localStyles.actionMiniText, isNight && localStyles.actionMiniTextNight]}>Add to Growmies</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export const FeedEventCard = memo(FeedEventCardInner, (prev, next) => {
  if (prev.event.id !== next.event.id) return false;
  if (prev.event.content !== next.event.content) return false;
  if (prev.event.created_at !== next.event.created_at) return false;
  if (prev.event.timestamp !== next.event.timestamp) return false;
  if (prev.isNight !== next.isNight) return false;
  if (prev.authState.isLoggedIn !== next.authState.isLoggedIn) return false;
  if (prev.authState.pubkey !== next.authState.pubkey) return false;
  if (prev.authState.isReadOnly !== next.authState.isReadOnly) return false;
  if (prev.allowAddToGrowmies !== next.allowAddToGrowmies) return false;

  const prevAuthorLabel = prev.feedAuthorNames[prev.event.author] || '';
  const nextAuthorLabel = next.feedAuthorNames[next.event.author] || '';
  if (prevAuthorLabel !== nextAuthorLabel) return false;

  const prevIsGrowmie = prev.growmies.includes(prev.event.author);
  const nextIsGrowmie = next.growmies.includes(next.event.author);
  if (prevIsGrowmie !== nextIsGrowmie) return false;

  return true;
});
FeedEventCard.displayName = 'FeedEventCard';

const localStyles = StyleSheet.create({
  feedItem: {
    backgroundColor: '#fffefb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2d7c0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  feedItemNight: {
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderColor: 'rgba(71,85,105,0.8)',
  },
  feedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  feedAuthorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2f0df',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAuthorAvatarNight: {
    backgroundColor: '#1f2937',
  },
  feedAuthorAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f5d35',
  },
  feedAuthorAvatarTextNight: {
    color: '#e5e7eb',
  },
  feedAuthorMeta: {
    flex: 1,
    minWidth: 0,
  },
  author: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f5d35',
    lineHeight: 16,
  },
  authorNight: {
    color: '#e5e7eb',
  },
  timestamp: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 3,
  },
  timestampNight: {
    color: '#94a3b8',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    fontSize: 12,
    color: '#1f5d35',
    fontWeight: '600',
    backgroundColor: '#ecf2e6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagNight: {
    color: '#d1fae5',
    backgroundColor: '#1f2937',
  },
  actionMini: {
    marginTop: 9,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d5bf8f',
    backgroundColor: '#f7f2e7',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionMiniNight: {
    borderColor: '#475569',
    backgroundColor: '#111827',
  },
  actionMiniText: {
    color: '#2f6b3f',
    fontSize: 12,
    fontWeight: '600',
  },
  actionMiniTextNight: {
    color: '#d1fae5',
  },
});
