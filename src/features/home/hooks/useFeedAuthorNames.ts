import { useEffect, useRef, useState } from 'react';
import type { FilteredEvent } from '../../../lib/eventFilter';
import { nostrClient } from '../../../lib/nostrClient';

type FeedAuthorNamesMap = Record<string, string>;
const AUTHOR_MISS_TTL_MS = 3 * 60 * 1000;
const AUTHOR_FETCH_CONCURRENCY = 4;

export function useFeedAuthorNames(visibleFeedEvents: FilteredEvent[], relayUrls: string[]) {
  const [feedAuthorNames, setFeedAuthorNames] = useState<FeedAuthorNamesMap>({});
  const labelCacheRef = useRef<Map<string, string>>(new Map());
  const missUntilRef = useRef<Map<string, number>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (relayUrls.length === 0 || visibleFeedEvents.length === 0) return;
    const now = Date.now();
    const authors = Array.from(new Set(visibleFeedEvents.map((event) => event.author)));

    const cachedLabels: FeedAuthorNamesMap = {};
    for (const author of authors) {
      const cached = labelCacheRef.current.get(author);
      if (cached) {
        cachedLabels[author] = cached;
      }
    }
    if (Object.keys(cachedLabels).length > 0) {
      setFeedAuthorNames((prev) => ({ ...cachedLabels, ...prev }));
    }

    const missingAuthors = Array.from(
      new Set(
        authors.filter((author) => {
          if (feedAuthorNames[author]) return false;
          if (labelCacheRef.current.has(author)) return false;
          if (inFlightRef.current.has(author)) return false;
          const missUntil = missUntilRef.current.get(author);
          return !missUntil || missUntil <= now;
        })
      )
    ).slice(0, 12);

    if (missingAuthors.length === 0) return;

    let canceled = false;

    for (const author of missingAuthors) {
      inFlightRef.current.add(author);
    }

    const workers = Array.from({ length: Math.min(AUTHOR_FETCH_CONCURRENCY, missingAuthors.length) }).map(async (_, workerIndex) => {
      for (let i = workerIndex; i < missingAuthors.length; i += AUTHOR_FETCH_CONCURRENCY) {
        const author = missingAuthors[i];
        try {
          const metadata = await nostrClient.fetchProfileMetadata(author, relayUrls, 2500);
          const label = metadata?.display_name?.trim() || metadata?.name?.trim() || '';
          if (!label) {
            missUntilRef.current.set(author, Date.now() + AUTHOR_MISS_TTL_MS);
            continue;
          }
          labelCacheRef.current.set(author, label);
          if (!canceled) {
            setFeedAuthorNames((prev) => ({
              ...prev,
              [author]: label,
            }));
          }
        } catch {
          missUntilRef.current.set(author, Date.now() + AUTHOR_MISS_TTL_MS);
        } finally {
          inFlightRef.current.delete(author);
        }
      }
    });

    Promise.all(workers).catch(() => {
      // best effort only
    });

    return () => {
      canceled = true;
    };
  }, [visibleFeedEvents, relayUrls, feedAuthorNames]);

  return feedAuthorNames;
}
