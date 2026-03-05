import { useCallback, useEffect, useRef, useState } from 'react';
import { nostrClient, type NostrEvent } from '../../lib/nostrClient';
import { filterAndDeduplicateEvents, deduplicateAndFormatEvents, type FilteredEvent } from '../../lib/eventFilter';
import { reactionManager } from '../../lib/reactionManager';
import { threadManager } from '../../lib/threadManager';

interface UseFeedControllerParams {
  relayUrls: string[];
  hashtags: string[];
  filterEnabled: boolean;
  searchQuery?: string;
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
  searchQuery,
  onError,
}: UseFeedControllerParams): UseFeedControllerResult {
  const [events, setEvents] = useState<FilteredEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubId, setCurrentSubId] = useState<string | null>(null);
  const [initialFeedLoaded, setInitialFeedLoaded] = useState(false);
  const currentSubIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const overallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionQueueRef = useRef<Set<string>>(new Set());
  const interactionFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedTimers = useCallback(() => {
    if (overallTimeoutRef.current) {
      clearTimeout(overallTimeoutRef.current);
      overallTimeoutRef.current = null;
    }
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    if (interactionFlushTimerRef.current) {
      clearTimeout(interactionFlushTimerRef.current);
      interactionFlushTimerRef.current = null;
    }
    interactionQueueRef.current.clear();
  }, []);

  const subscribeFeed = useCallback(
    async (relayOverride?: string[]) => {
      const requestId = ++requestIdRef.current;
      try {
        clearFeedTimers();
        setIsLoading(true);

        const activeRelays = relayOverride && relayOverride.length > 0 ? relayOverride : relayUrls;
        if (activeRelays.length === 0) {
          throw new Error('No relays enabled. Please enable at least one relay.');
        }

        nostrClient.setRelays(activeRelays);
        if (currentSubIdRef.current) {
          nostrClient.unsubscribe(currentSubIdRef.current);
          currentSubIdRef.current = null;
          setCurrentSubId(null);
        }

        const normalizedHashtags = hashtags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean);
        const normalizedSearchQuery = searchQuery?.trim() || '';
        const shouldFilter = filterEnabled && normalizedHashtags.length > 0;
        const shouldSearch = normalizedSearchQuery.length > 0;
        const since = shouldFilter || shouldSearch ? 0 : Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
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

        if (shouldSearch) {
          const searchEvents = await nostrClient.fetchNotesBySearchQuery(normalizedSearchQuery, 220, 7000);
          if (searchEvents.length > 0) {
            allEvents.push(...searchEvents);
            applyDisplayEvents(allEvents);
            setIsLoading(false);
          }
        }

        const tryFallbackLoad = async () => {
          if (requestId !== requestIdRef.current) return;
          const fallbackEvents = await nostrClient.fetchRecentPublicNotes(80, 7000);
          if (requestId !== requestIdRef.current) return;
          if (fallbackEvents.length > 0) {
            applyDisplayEvents(fallbackEvents);
          }
          setIsLoading(false);
        };

        const queueInteractionFetch = (eventId: string) => {
          interactionQueueRef.current.add(eventId);
          if (interactionFlushTimerRef.current) return;

          interactionFlushTimerRef.current = setTimeout(() => {
            interactionFlushTimerRef.current = null;
            const queuedIds = Array.from(interactionQueueRef.current);
            interactionQueueRef.current.clear();
            if (queuedIds.length === 0 || activeRelays.length === 0) return;

            reactionManager.fetchInteractions(queuedIds, activeRelays).catch(() => {
              // Ignore interaction fetch failures in feed stream.
            });
          }, 350);
        };

        overallTimeoutRef.current = setTimeout(() => {
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
            if (requestId !== requestIdRef.current) return;
            clearFeedTimers();
            allEvents.push(event);
            applyDisplayEvents(allEvents);

            setIsLoading(false);
            threadManager.addEvent(event);
            queueInteractionFetch(event.id);
          },
          () => {
            if (requestId !== requestIdRef.current) return;
            if (allEvents.length === 0) {
              tryFallbackLoad().catch(() => {
                // ignore
              });
            }
          },
          normalizedSearchQuery
        );

        if (requestId !== requestIdRef.current) {
          nostrClient.unsubscribe(subId);
          return;
        }

        currentSubIdRef.current = subId;
        setCurrentSubId(subId);
        settleTimeoutRef.current = setTimeout(() => {
          if (requestId !== requestIdRef.current) return;
          if (allEvents.length === 0) {
            tryFallbackLoad().catch(() => {
              // ignore
            });
          } else {
            setIsLoading(false);
          }
        }, 3000);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        onError?.(err instanceof Error ? err.message : 'Failed to subscribe to feed');
        setIsLoading(false);
      }
    },
    [clearFeedTimers, relayUrls, hashtags, filterEnabled, onError, searchQuery]
  );

  useEffect(() => {
    currentSubIdRef.current = currentSubId;
  }, [currentSubId]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      clearFeedTimers();
      if (currentSubIdRef.current) {
        nostrClient.unsubscribe(currentSubIdRef.current);
      }
    };
  }, [clearFeedTimers]);

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
