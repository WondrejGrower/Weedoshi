import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Event as NostrRawEvent } from 'nostr-tools';
import type { AuthState } from '../../../lib/authManager';
import { nostrClient, type NostrProfileMetadata } from '../../../lib/nostrClient';
import { relayManager } from '../../../lib/relayManager';
import { diaryManager, defaultDiaryId, type DiaryIndex, fetchAuthorNotes } from '../../../lib/diaryManager';
import { diaryStore } from '../../../lib/diaryStore';
import { growmiesStore } from '../../../lib/growmiesStore';
import { logger } from '../../../lib/logger';
import { toErrorMessage } from '../../../lib/errorUtils';

type DiaryRunOption = {
  diaryId: string;
  title: string;
  isPublic: boolean;
  syncStatus: 'local-only' | 'syncing' | 'synced' | 'error';
  itemCount: number;
};

type UseHomeDataSyncParams = {
  authState: AuthState;
  relayUrls: string[];
  setRelayUrls: (value: string[]) => void;
  setError: (value: string | null) => void;
  setDiaryDraft: (value: DiaryIndex | null) => void;
  setDiaryIdInput: (value: string) => void;
  setDiaryTitleInput: (value: string) => void;
  setDiaryPlantInput: (value: string) => void;
  setDiaryPlantSlug: (value: string) => void;
  setDiarySpeciesInput: (value: string) => void;
  setDiaryCultivarInput: (value: string) => void;
  setDiaryBreederInput: (value: string) => void;
  setDiaryPlantWikiAPointer: (value: string) => void;
  setDiaryPhaseInput: (value: string) => void;
  setDiaryMoreOpen: (value: boolean) => void;
  setRunOptions: (value: DiaryRunOption[]) => void;
  setDiaryLoading: (value: boolean) => void;
  setProfileLoading: (value: boolean) => void;
  setProfilePosts: Dispatch<SetStateAction<NostrRawEvent[]>>;
  setProfileMetadata: Dispatch<SetStateAction<NostrProfileMetadata | null>>;
  setLastSyncedPubkey: (value: string | null) => void;
  lastSyncedPubkey: string | null;
  setDiaryEditMode: (value: boolean) => void;
  setGrowmies: (value: string[]) => void;
  setOnlyGrowmies: (value: boolean) => void;
  subscribeFeed: (relayOverride?: string[]) => Promise<void>;
};

export function useHomeDataSync({
  authState,
  relayUrls,
  setRelayUrls,
  setError,
  setDiaryDraft,
  setDiaryIdInput,
  setDiaryTitleInput,
  setDiaryPlantInput,
  setDiaryPlantSlug,
  setDiarySpeciesInput,
  setDiaryCultivarInput,
  setDiaryBreederInput,
  setDiaryPlantWikiAPointer,
  setDiaryPhaseInput,
  setDiaryMoreOpen,
  setRunOptions,
  setDiaryLoading,
  setProfileLoading,
  setProfilePosts,
  setProfileMetadata,
  setLastSyncedPubkey,
  lastSyncedPubkey,
  setDiaryEditMode,
  setGrowmies,
  setOnlyGrowmies,
  subscribeFeed,
}: UseHomeDataSyncParams) {
  const bootstrappedPubkeyRef = useRef<string | null>(null);
  const bootstrappedAtRef = useRef(0);
  const setErrorFromUnknown = useCallback(
    (err: unknown, fallback: string) => {
      setError(toErrorMessage(err, fallback));
    },
    [setError]
  );

  const hydrateDiaryStateFromStore = useCallback(
    async (preferredDiaryId?: string) => {
      const diaries = diaryStore.listDiaries();
      const options: DiaryRunOption[] = diaries.map((diary) => ({
        diaryId: diary.id,
        title: diary.title,
        isPublic: diary.isPublic,
        syncStatus: diary.syncStatus,
        itemCount: diary.items.length,
      }));
      setRunOptions(options);

      const selectedId = preferredDiaryId || diaryStore.getSelectedDiaryId() || options[0]?.diaryId || null;

      if (!selectedId) {
        setDiaryDraft(null);
        setDiaryIdInput(defaultDiaryId());
        setDiaryTitleInput('My Grow Run #1');
        setDiaryPlantInput('');
        setDiaryPlantSlug('');
        setDiarySpeciesInput('');
        setDiaryCultivarInput('');
        setDiaryBreederInput('');
        setDiaryPlantWikiAPointer('');
        setDiaryPhaseInput('');
        return;
      }

      await diaryStore.selectDiary(selectedId);
      const selected = diaryStore.getDiary(selectedId);
      if (!selected) return;

      const nextDraft: DiaryIndex = {
        version: 1,
        diaryId: selected.id,
        title: selected.title,
        defaultRelayHints: relayUrls,
        chapters: [],
        entries: selected.items.map((item) => ({
          id: item.eventId,
          chapter: item.phaseLabel || selected.phase || 'General',
          addedAt: item.addedAt,
        })),
      };

      setDiaryDraft(nextDraft);
      setDiaryIdInput(selected.id);
      setDiaryTitleInput(selected.title);
      setDiaryPlantInput(selected.plant || '');
      setDiaryPlantSlug(selected.plantSlug || '');
      setDiarySpeciesInput(selected.species || '');
      setDiaryCultivarInput(selected.cultivar || '');
      setDiaryBreederInput(selected.breeder || '');
      setDiaryPlantWikiAPointer(selected.plantWikiAPointer || '');
      setDiaryPhaseInput(selected.phase || '');
      setDiaryMoreOpen(false);
    },
    [
      relayUrls,
      setDiaryBreederInput,
      setDiaryCultivarInput,
      setDiaryDraft,
      setDiaryIdInput,
      setDiaryMoreOpen,
      setDiaryPhaseInput,
      setDiaryPlantInput,
      setDiaryPlantSlug,
      setDiaryPlantWikiAPointer,
      setDiarySpeciesInput,
      setDiaryTitleInput,
      setRunOptions,
    ]
  );

  const hydrateGrowmiesState = useCallback(() => {
    setGrowmies(growmiesStore.list());
    setOnlyGrowmies(growmiesStore.isOnlyGrowmies());
  }, [setGrowmies, setOnlyGrowmies]);

  const syncRelaysAndProfile = useCallback(
    async (pubkey: string): Promise<string[]> => {
      const currentRelays = relayManager.getEnabledUrls();
      const allKnownRelays = relayManager.getAllRelays().map((relay) => relay.url);
      const seedRelays = Array.from(new Set([...currentRelays, ...allKnownRelays])).slice(0, 12);

      const userRelays = await nostrClient.fetchUserRelayPreferences(pubkey, seedRelays, 7000);
      const prioritizedUserRelays = userRelays.slice(0, 10);

      if (prioritizedUserRelays.length > 0) {
        for (const relayUrl of prioritizedUserRelays) {
          try {
            relayManager.addRelay(relayUrl);
            relayManager.enableRelay(relayUrl);
          } catch (relayError) {
            logger.warn('Skipping invalid user relay', relayUrl, relayError);
          }
        }
      }

      const mergedRelays = relayManager.getEnabledUrls();
      setRelayUrls(mergedRelays);
      nostrClient.setRelays(mergedRelays);

      const metadata = await nostrClient.fetchProfileMetadata(pubkey, mergedRelays, 7000);
      setProfileMetadata(metadata);
      return mergedRelays;
    },
    [setProfileMetadata, setRelayUrls]
  );

  const loadDiary = useCallback(
    async (forcedDiaryId?: string) => {
      if (!authState.pubkey) return;
      setDiaryLoading(true);
      try {
        await diaryStore.setUser(authState.pubkey);
        await hydrateDiaryStateFromStore(forcedDiaryId);

        if (relayUrls.length > 0) {
          await diaryStore.mergePublicDiariesFromRelays(authState.pubkey, relayUrls);
          await hydrateDiaryStateFromStore(forcedDiaryId);
        }
      } catch (err) {
        setErrorFromUnknown(err, 'Failed to load diary');
      } finally {
        setDiaryLoading(false);
      }
    },
    [authState.pubkey, hydrateDiaryStateFromStore, relayUrls, setDiaryLoading, setErrorFromUnknown]
  );

  const loadAuthorPosts = useCallback(
    async (relayOverride?: string[]) => {
      if (!authState.pubkey) return;
      const activeRelays = relayOverride && relayOverride.length > 0 ? relayOverride : relayUrls;
      if (activeRelays.length === 0) return;

      setProfileLoading(true);
      try {
        let notes = await fetchAuthorNotes(diaryManager.getPool(), activeRelays, authState.pubkey, 180);

        if (notes.length === 0) {
          const fallbackRelays = Array.from(
            new Set([...activeRelays, ...relayManager.getAllRelays().map((relay) => relay.url)])
          );
          notes = await fetchAuthorNotes(diaryManager.getPool(), fallbackRelays, authState.pubkey, 180);
        }

        setProfilePosts(notes);
      } catch (err) {
        setErrorFromUnknown(err, 'Failed to load profile posts');
      } finally {
        setProfileLoading(false);
      }
    },
    [authState.pubkey, relayUrls, setErrorFromUnknown, setProfileLoading, setProfilePosts]
  );

  const bootstrapLoggedInSession = useCallback(
    async (pubkey: string) => {
      const syncedRelays = await syncRelaysAndProfile(pubkey);
      await Promise.all([subscribeFeed(syncedRelays), loadAuthorPosts(syncedRelays)]);
      bootstrappedPubkeyRef.current = pubkey;
      bootstrappedAtRef.current = Date.now();
      setLastSyncedPubkey(pubkey);
    },
    [loadAuthorPosts, setLastSyncedPubkey, subscribeFeed, syncRelaysAndProfile]
  );

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.pubkey) {
      setDiaryDraft(null);
      setProfilePosts([]);
      setRunOptions([]);
      setDiaryEditMode(false);
      setProfileMetadata(null);
      setLastSyncedPubkey(null);
      setGrowmies([]);
      setOnlyGrowmies(false);
      diaryStore.setUser(null).catch(() => {
        // ignore
      });
      growmiesStore.setUser(null).catch(() => {
        // ignore
      });
      return;
    }
    const pubkey = authState.pubkey;
    const recentlyBootstrapped =
      bootstrappedPubkeyRef.current === pubkey && Date.now() - bootstrappedAtRef.current < 8000;

    if (lastSyncedPubkey !== pubkey && !recentlyBootstrapped) {
      setLastSyncedPubkey(pubkey);
      syncRelaysAndProfile(pubkey).catch((err) => {
        setErrorFromUnknown(err, 'Failed to sync user relays/profile');
      });
    }

    loadDiary().catch((err) => {
      setErrorFromUnknown(err, 'Failed to load diary');
    });
    growmiesStore
      .setUser(pubkey)
      .then(async () => {
        if (relayUrls.length > 0) {
          await growmiesStore.mergeFromRelays(pubkey, relayUrls);
        }
        hydrateGrowmiesState();
      })
      .catch((err) => {
        setErrorFromUnknown(err, 'Failed to load Growmies');
      });
    if (!recentlyBootstrapped) {
      loadAuthorPosts().catch((err) => {
        setErrorFromUnknown(err, 'Failed to load profile posts');
      });
    }
  }, [
    authState.isLoggedIn,
    authState.pubkey,
    hydrateGrowmiesState,
    lastSyncedPubkey,
    loadAuthorPosts,
    loadDiary,
    relayUrls,
    setDiaryDraft,
    setDiaryEditMode,
    setErrorFromUnknown,
    setGrowmies,
    setLastSyncedPubkey,
    setOnlyGrowmies,
    setProfileMetadata,
    setProfilePosts,
    setRunOptions,
    syncRelaysAndProfile,
  ]);

  return {
    setErrorFromUnknown,
    hydrateDiaryStateFromStore,
    hydrateGrowmiesState,
    loadDiary,
    loadAuthorPosts,
    bootstrapLoggedInSession,
  };
}
