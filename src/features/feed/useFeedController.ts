import { useCallback, useEffect, useState } from 'react';
import { nostrClient, type NostrEvent } from '../../lib/nostrClient';
import { filterAndDeduplicateEvents, deduplicateAndFormatEvents, type FilteredEvent } from '../../lib/eventFilter';
import { reactionManager } from '../../lib/reactionManager';
import { threadManager } from '../../lib/threadManager';

interface UseFeedControllerParams {
  relayUrls: string[];
  hashtags: string[];
  filterEnabled: boolean;
  onError?: (message: string) => void;
}

interface UseFeedControllerResult {
  events: FilteredEvent[];
  isLoading: boolean;
  subscribeFeed: (relayOverride?: string[]) => Promise<void>;
  refresh: () => void;
}

export function useFeedController({
  relayUrls,
  hashtags,
  filterEnabled,
  onError,
}: UseFeedControllerParams): UseFeedControllerResult {
  const [events, setEvents] = useState<FilteredEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubId, setCurrentSubId] = useState<string | null>(null);
  const [initialFeedLoaded, setInitialFeedLoaded] = useState(false);

  const subscribeFeed = useCallback(
    async (relayOverride?: string[]) => {
      try {
        setIsLoading(true);

        const activeRelays = relayOverride && relayOverride.length > 0 ? relayOverride : relayUrls;
        if (activeRelays.length === 0) {
          throw new Error('No relays enabled. Please enable at least one relay.');
        }

        nostrClient.setRelays(activeRelays);
        if (currentSubId) {
          nostrClient.unsubscribe(currentSubId);
        }

        const normalizedHashtags = hashtags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean);
        const shouldFilter = filterEnabled && normalizedHashtags.length > 0;
        const since = shouldFilter ? 0 : Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
        const allEvents: NostrEvent[] = [];
        const applyDisplayEvents = (source: NostrEvent[]) => {
          if (shouldFilter) {
            setEvents(filterAndDeduplicateEvents(source, normalizedHashtags));
            return;
          }
          setEvents(deduplicateAndFormatEvents(source));
        };

        if (shouldFilter) {
          const backfillEvents = await nostrClient.fetchNotesByTagHashtags(normalizedHashtags, 350, 7000);
          if (backfillEvents.length > 0) {
            allEvents.push(...backfillEvents);
            applyDisplayEvents(allEvents);
            setIsLoading(false);
          }
        }

        const tryFallbackLoad = async () => {
          const fallbackEvents = await nostrClient.fetchRecentPublicNotes(80, 7000);
          if (fallbackEvents.length > 0) {
            applyDisplayEvents(fallbackEvents);
          }
          setIsLoading(false);
        };

        const overallTimeout = setTimeout(() => {
          if (allEvents.length === 0) {
            tryFallbackLoad().catch(() => {
              // ignore
            });
          }
        }, 10000);

        const subId = await nostrClient.subscribeFeed(
          normalizedHashtags,
          since,
          (event) => {
            clearTimeout(overallTimeout);
            allEvents.push(event);
            applyDisplayEvents(allEvents);

            setIsLoading(false);
            threadManager.addEvent(event);

            if (activeRelays.length > 0) {
              reactionManager.fetchReactions([event.id], activeRelays).catch(() => {
                // Ignore reaction fetch failures in feed stream.
              });
            }
          },
          () => {
            if (allEvents.length === 0) {
              tryFallbackLoad().catch(() => {
                // ignore
              });
            }
          }
        );

        setCurrentSubId(subId);
        setTimeout(() => {
          if (allEvents.length === 0) {
            tryFallbackLoad().catch(() => {
              // ignore
            });
          } else {
            setIsLoading(false);
          }
        }, 3000);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Failed to subscribe to feed');
        setIsLoading(false);
      }
    },
    [relayUrls, hashtags, filterEnabled, currentSubId, onError]
  );

  useEffect(() => {
    return () => {
      if (currentSubId) {
        nostrClient.unsubscribe(currentSubId);
      }
    };
  }, [currentSubId]);

  useEffect(() => {
    if (initialFeedLoaded) return;
    if (relayUrls.length === 0) return;

    setInitialFeedLoaded(true);
    subscribeFeed().catch((err) => {
      onError?.(err instanceof Error ? err.message : 'Failed to load initial feed');
    });
  }, [relayUrls, initialFeedLoaded, subscribeFeed, onError]);

  const refresh = useCallback(() => {
    subscribeFeed().catch((err) => {
      onError?.(err instanceof Error ? err.message : 'Failed to refresh feed');
    });
  }, [subscribeFeed, onError]);

  return {
    events,
    isLoading,
    subscribeFeed,
    refresh,
  };
}
