import { useCallback, useEffect, useRef, useState } from 'react';
import { nostrClient, type NostrEvent } from '../../lib/nostrClient';
import { filterAndDeduplicateEvents, deduplicateAndFormatEvents, type FilteredEvent } from '../../lib/eventFilter';
import { reactionManager } from '../../lib/reactionManager';
import { threadManager } from '../../lib/threadManager';
import { perfMonitor, type FeedLoadReason } from '../../lib/perfMonitor';

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
  isFetchingMore: boolean;
  subscribeFeed: (relayOverride?: string[], reason?: FeedLoadReason) => Promise<void>;
  refresh: () => void;
  loadMore: () => Promise<void>;
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
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [currentSubId, setCurrentSubId] = useState<string | null>(null);
  const [initialFeedLoaded, setInitialFeedLoaded] = useState(false);
  const oldestEventTimestampRef = useRef<number | null>(null);
  const currentSubIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const overallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRenderFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionQueueRef = useRef<Set<string>>(new Set());
  const interactionFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSubscriptionTimers = useCallback(() => {
    if (overallTimeoutRef.current) {
      clearTimeout(overallTimeoutRef.current);
      overallTimeoutRef.current = null;
    }
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    if (streamRenderFlushRef.current) {
      clearTimeout(streamRenderFlushRef.current);
      streamRenderFlushRef.current = null;
    }
  }, []);
  const clearInteractionQueue = useCallback(() => {
    if (interactionFlushTimerRef.current) {
      clearTimeout(interactionFlushTimerRef.current);
      interactionFlushTimerRef.current = null;
    }
    interactionQueueRef.current.clear();
  }, []);

  const updateOldestTimestamp = useCallback((source: NostrEvent[]) => {
    if (source.length === 0) return;
    const oldest = Math.min(...source.map((ev) => ev.created_at));
    if (oldestEventTimestampRef.current === null || oldest < oldestEventTimestampRef.current) {
      oldestEventTimestampRef.current = oldest;
    }
  }, []);

  const subscribeFeed = useCallback(
    async (relayOverride?: string[], reason: FeedLoadReason = 'manual') => {
      const requestId = ++requestIdRef.current;
      try {
        perfMonitor.startFeedLoad(reason);
        clearSubscriptionTimers();
        clearInteractionQueue();
        setIsLoading(true);
        oldestEventTimestampRef.current = null;

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
          updateOldestTimestamp(source);
          if (shouldFilter) {
            setEvents(filterAndDeduplicateEvents(source, normalizedHashtags));
            return;
          }
          setEvents(deduplicateAndFormatEvents(source));
        };
        const scheduleDisplayRefresh = () => {
          if (streamRenderFlushRef.current) return;
          streamRenderFlushRef.current = setTimeout(() => {
            streamRenderFlushRef.current = null;
            applyDisplayEvents(allEvents);
          }, 120);
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
          perfMonitor.finishFeedLoad();
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
          }, 180);
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
            clearSubscriptionTimers();
            allEvents.push(event);
            scheduleDisplayRefresh();

            setIsLoading(false);
            perfMonitor.markFeedEventReceived();
            perfMonitor.finishFeedLoad();
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
            perfMonitor.finishFeedLoad();
            setIsLoading(false);
          }
        }, 3000);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        onError?.(err instanceof Error ? err.message : 'Failed to subscribe to feed');
        perfMonitor.finishFeedLoad();
        setIsLoading(false);
      }
    },
    [clearInteractionQueue, clearSubscriptionTimers, relayUrls, hashtags, filterEnabled, onError, searchQuery, updateOldestTimestamp]
  );

  useEffect(() => {
    currentSubIdRef.current = currentSubId;
  }, [currentSubId]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      clearSubscriptionTimers();
      clearInteractionQueue();
      if (currentSubIdRef.current) {
        nostrClient.unsubscribe(currentSubIdRef.current);
      }
    };
  }, [clearInteractionQueue, clearSubscriptionTimers]);

  useEffect(() => {
    if (initialFeedLoaded) return;
    if (relayUrls.length === 0) return;

    setInitialFeedLoaded(true);
    subscribeFeed(undefined, 'initial').catch((err) => {
      onError?.(err instanceof Error ? err.message : 'Failed to load initial feed');
    });
  }, [relayUrls, initialFeedLoaded, subscribeFeed, onError]);

  const refresh = useCallback(() => {
    subscribeFeed(undefined, 'refresh').catch((err) => {
      onError?.(err instanceof Error ? err.message : 'Failed to refresh feed');
    });
  }, [subscribeFeed, onError]);

  const loadMore = useCallback(async () => {
    if (isFetchingMore || isLoading || !oldestEventTimestampRef.current) return;

    setIsFetchingMore(true);
    try {
      const until = oldestEventTimestampRef.current - 1;
      const normalizedHashtags = filterEnabled
        ? hashtags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)
        : [];
      const normalizedSearchQuery = searchQuery?.trim();

      const pageEvents = await nostrClient.fetchFeedPage(
        normalizedHashtags,
        50,
        until,
        normalizedSearchQuery
      );

      if (pageEvents.length > 0) {
        updateOldestTimestamp(pageEvents);
        
        let newFiltered: FilteredEvent[];
        if (filterEnabled && normalizedHashtags.length > 0) {
          newFiltered = filterAndDeduplicateEvents(pageEvents, normalizedHashtags);
        } else {
          newFiltered = deduplicateAndFormatEvents(pageEvents);
        }

        setEvents((prev) => {
          const existingIds = new Set(prev.map((ev) => ev.id));
          const uniqueNew = newFiltered.filter((ev) => !existingIds.has(ev.id));
          return [...prev, ...uniqueNew];
        });
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to load more events');
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, isLoading, hashtags, filterEnabled, searchQuery, onError, updateOldestTimestamp]);

  return {
    events,
    isLoading,
    isFetchingMore,
    subscribeFeed,
    refresh,
    loadMore,
  };
}
