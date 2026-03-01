import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Linking,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native';
import type { Event as NostrRawEvent } from 'nostr-tools';
import { nostrClient } from '../src/lib/nostrClient';
import { authManager } from '../src/lib/authManager';
import { relayManager } from '../src/lib/relayManager';
import { filterAndDeduplicateEvents, deduplicateAndFormatEvents } from '../src/lib/eventFilter';
import { DiagnosticsPanel } from '../src/components/DiagnosticsPanel';
import { ReactionBar } from '../src/components/ReactionBar';
import { ThreadIndicator } from '../src/components/ThreadIndicator';
import { SmartRelayPanel } from '../src/components/SmartRelayPanel';
import { PostMediaRenderer } from '../src/components/PostMediaRenderer';
import { reactionManager } from '../src/lib/reactionManager';
import { threadManager } from '../src/lib/threadManager';
import type { NostrEvent } from '../src/lib/nostrClient';
import type { NostrProfileMetadata } from '../src/lib/nostrClient';
import type { AuthState } from '../src/lib/authManager';
import type { FilteredEvent } from '../src/lib/eventFilter';
import { getRuntimeMode } from '../src/runtime/mode';
import { getFeatures } from '../src/runtime/features';
import {
  diaryManager,
  defaultDiaryId,
  fetchAuthorNotes,
  fetchEventsByIds,
  type DiaryEntry,
  type DiaryIndex,
} from '../src/lib/diaryManager';
import { diaryStore } from '../src/lib/diaryStore';
import { growmiesStore } from '../src/lib/growmiesStore';

const DEFAULT_HASHTAGS = ['weedoshi', 'growlog', 'weedstr', 'weed'];
const DEFAULT_DIARY_CHAPTERS = [
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `vegW${String(i + 1).padStart(2, '0')}`,
    label: `Veg Week ${i + 1}`,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `flowerW${String(i + 1).padStart(2, '0')}`,
    label: `Flower Week ${i + 1}`,
  })),
];

const runtimeMode = getRuntimeMode();
const features = getFeatures(runtimeMode);

type MainPage = 'feed' | 'profile' | 'growmies' | 'settings';
type ProfileTab = 'diary' | 'all';

type DiaryRunOption = {
  diaryId: string;
  title: string;
  isPublic: boolean;
  syncStatus: 'local-only' | 'syncing' | 'synced' | 'error';
  itemCount: number;
};

function getDisplayName(auth: AuthState, metadata: NostrProfileMetadata | null): string {
  if (metadata?.display_name?.trim()) return metadata.display_name.trim();
  if (metadata?.name?.trim()) return metadata.name.trim();
  if (!auth.pubkey) return 'Guest Grower';
  return `Grower ${auth.pubkey.slice(0, 6)}`;
}

function getAvatarLabel(auth: AuthState, metadata: NostrProfileMetadata | null): string {
  if (metadata?.display_name?.trim()) return metadata.display_name.trim().slice(0, 2).toUpperCase();
  if (metadata?.name?.trim()) return metadata.name.trim().slice(0, 2).toUpperCase();
  if (!auth.pubkey) return 'WG';
  return auth.pubkey.slice(0, 2).toUpperCase();
}

function shortPubkey(pubkey: string | null): string {
  if (!pubkey) return 'Not connected';
  return `${pubkey.slice(0, 10)}...${pubkey.slice(-8)}`;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [activePage, setActivePage] = useState<MainPage>('profile');
  const [profileTab, setProfileTab] = useState<ProfileTab>('diary');

  const [authState, setAuthState] = useState<AuthState>(authManager.getState());
  const [relayUrls, setRelayUrls] = useState<string[]>(relayManager.getEnabledUrls());
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS);
  const [events, setEvents] = useState<FilteredEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSubId, setCurrentSubId] = useState<string | null>(null);

  const [newRelay, setNewRelay] = useState('');
  const [newHashtag, setNewHashtag] = useState('');
  const [nsecInput, setNsecInput] = useState('');
  const [npubInput, setNpubInput] = useState('');
  const [activeAuthTab, setActiveAuthTab] = useState<'nsec' | 'npub'>(
    features.allowNsecLogin ? 'nsec' : 'npub'
  );
  const [signerAvailable, setSignerAvailable] = useState(authManager.isBrowserSignerAvailable());

  const [diaryIdInput, setDiaryIdInput] = useState(defaultDiaryId());
  const [diaryTitleInput, setDiaryTitleInput] = useState('My Grow Run #1');
  const [diaryDraft, setDiaryDraft] = useState<DiaryIndex | null>(null);
  const [diaryEvents, setDiaryEvents] = useState<Record<string, NostrRawEvent>>({});
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryPublishing, setDiaryPublishing] = useState(false);
  const [diaryEditMode, setDiaryEditMode] = useState(false);
  const [diarySnapshot, setDiarySnapshot] = useState<DiaryIndex | null>(null);
  const [chapterMenuForEntry, setChapterMenuForEntry] = useState<string | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profilePosts, setProfilePosts] = useState<NostrRawEvent[]>([]);
  const [initialFeedLoaded, setInitialFeedLoaded] = useState(false);
  const [profileMetadata, setProfileMetadata] = useState<NostrProfileMetadata | null>(null);
  const [lastSyncedPubkey, setLastSyncedPubkey] = useState<string | null>(null);

  const [runOptions, setRunOptions] = useState<DiaryRunOption[]>([]);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [addToDiaryModalOpen, setAddToDiaryModalOpen] = useState(false);
  const [addToDiaryEvent, setAddToDiaryEvent] = useState<NostrRawEvent | null>(null);
  const [newDiaryInlineTitle, setNewDiaryInlineTitle] = useState('');
  const [addToDiaryTargetId, setAddToDiaryTargetId] = useState<string | null>(null);
  const [growmies, setGrowmies] = useState<string[]>([]);
  const [onlyGrowmies, setOnlyGrowmies] = useState(false);

  useEffect(() => {
    setSignerAvailable(authManager.isBrowserSignerAvailable());
  }, []);

  const hydrateDiaryStateFromStore = async (preferredDiaryId?: string) => {
    const diaries = diaryStore.listDiaries();
    const options: DiaryRunOption[] = diaries.map((diary) => ({
      diaryId: diary.id,
      title: diary.title,
      isPublic: diary.isPublic,
      syncStatus: diary.syncStatus,
      itemCount: diary.items.length,
    }));
    setRunOptions(options);

    const selectedId =
      preferredDiaryId ||
      diaryStore.getSelectedDiaryId() ||
      options[0]?.diaryId ||
      null;

    if (!selectedId) {
      setDiaryDraft(null);
      setDiaryEvents({});
      setDiaryIdInput(defaultDiaryId());
      setDiaryTitleInput('My Grow Run #1');
      return;
    }

    await diaryStore.selectDiary(selectedId);
    const selected = diaryStore.getDiary(selectedId);
    if (!selected) return;

    const syntheticChapters = DEFAULT_DIARY_CHAPTERS;
    const nextDraft: DiaryIndex = {
      version: 1,
      diaryId: selected.id,
      title: selected.title,
      defaultRelayHints: relayUrls,
      chapters: syntheticChapters,
      entries: selected.items.map((item) => ({
        id: item.eventId,
        chapter: syntheticChapters[0].key,
        addedAt: item.addedAt,
      })),
    };

    setDiaryDraft(nextDraft);
    setDiaryIdInput(selected.id);
    setDiaryTitleInput(selected.title);

    const localEventFallbacks: Record<string, NostrRawEvent> = {};
    for (const item of selected.items) {
      localEventFallbacks[item.eventId] = {
        id: item.eventId,
        pubkey: item.authorPubkey,
        created_at: item.createdAt,
        kind: 1,
        tags: [],
        content: item.contentPreview || '',
        sig: '',
      };
    }
    setDiaryEvents(localEventFallbacks);

    const ids = selected.items.map((item) => item.eventId);
    if (ids.length > 0 && relayUrls.length > 0) {
      const byId = await fetchEventsByIds(diaryManager.getPool(), relayUrls, ids);
      if (byId.size > 0) {
        const fetched: Record<string, NostrRawEvent> = { ...localEventFallbacks };
        byId.forEach((event, id) => {
          fetched[id] = event;
        });
        setDiaryEvents(fetched);
      }
    }
  };

  const hydrateGrowmiesState = () => {
    setGrowmies(growmiesStore.list());
    setOnlyGrowmies(growmiesStore.isOnlyGrowmies());
  };

  const syncRelaysAndProfile = async (pubkey: string): Promise<string[]> => {
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
        } catch (error) {
          console.warn('Skipping invalid user relay', relayUrl, error);
        }
      }
    }

    const mergedRelays = relayManager.getEnabledUrls();
    setRelayUrls(mergedRelays);
    nostrClient.setRelays(mergedRelays);

    const metadata = await nostrClient.fetchProfileMetadata(pubkey, mergedRelays, 7000);
    setProfileMetadata(metadata);
    return mergedRelays;
  };

  const loadDiary = async (forcedDiaryId?: string) => {
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
      setError(err instanceof Error ? err.message : 'Failed to load diary');
    } finally {
      setDiaryLoading(false);
    }
  };

  const loadAuthorPosts = async (relayOverride?: string[]) => {
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
      setError(err instanceof Error ? err.message : 'Failed to load profile posts');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (!authState.isLoggedIn || !authState.pubkey) {
      setDiaryDraft(null);
      setDiaryEvents({});
      setProfilePosts([]);
      setRunOptions([]);
      setDiaryEditMode(false);
      setProfileMetadata(null);
      setLastSyncedPubkey(null);
      setGrowmies([]);
      setOnlyGrowmies(false);
      void diaryStore.setUser(null);
      void growmiesStore.setUser(null);
      return;
    }

    if (lastSyncedPubkey !== authState.pubkey) {
      setLastSyncedPubkey(authState.pubkey);
      syncRelaysAndProfile(authState.pubkey).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to sync user relays/profile');
      });
    }

    loadDiary().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load diary');
    });
    growmiesStore
      .setUser(authState.pubkey)
      .then(async () => {
        if (relayUrls.length > 0) {
          await growmiesStore.mergeFromRelays(authState.pubkey!, relayUrls);
        }
        hydrateGrowmiesState();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load Growmies');
      });
    loadAuthorPosts().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load profile posts');
    });
  }, [authState.isLoggedIn, authState.pubkey, relayUrls.join(','), lastSyncedPubkey]);

  const subscribeFeed = async (relayOverride?: string[]) => {
    try {
      setIsLoading(true);
      setError(null);

      const activeRelays = relayOverride && relayOverride.length > 0 ? relayOverride : relayUrls;
      if (activeRelays.length === 0) {
        throw new Error('No relays enabled. Please enable at least one relay.');
      }

      nostrClient.setRelays(activeRelays);
      if (currentSubId) {
        nostrClient.unsubscribe(currentSubId);
      }

      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      const allEvents: NostrEvent[] = [];

      const tryFallbackLoad = async () => {
        const fallbackEvents = await nostrClient.fetchRecentPublicNotes(80, 7000);
        if (fallbackEvents.length > 0) {
          const filtered = filterAndDeduplicateEvents(fallbackEvents, hashtags);
          if (filtered.length > 0) {
            setEvents(filtered);
          } else {
            setEvents(deduplicateAndFormatEvents(fallbackEvents));
          }
        }
        setIsLoading(false);
      };

      const overallTimeout = setTimeout(() => {
        if (allEvents.length === 0) {
          void tryFallbackLoad();
        }
      }, 10000);

      const subId = await nostrClient.subscribeFeed(
        hashtags,
        sevenDaysAgo,
        (event) => {
          clearTimeout(overallTimeout);
          allEvents.push(event);

          const filtered = filterAndDeduplicateEvents(allEvents, hashtags);
          if (filtered.length > 0) {
            setEvents(filtered);
          } else {
            setEvents(deduplicateAndFormatEvents(allEvents));
          }

          setIsLoading(false);
          threadManager.addEvent(event);

          if (activeRelays.length > 0) {
            reactionManager.fetchReactions([event.id], activeRelays).catch((err) => {
              console.warn('Failed to fetch reactions:', err);
            });
          }
        },
        () => {
          if (allEvents.length === 0) {
            void tryFallbackLoad();
          }
        }
      );

      setCurrentSubId(subId);
      setTimeout(() => {
        if (allEvents.length === 0) {
          void tryFallbackLoad();
        } else {
          setIsLoading(false);
        }
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe to feed');
      setIsLoading(false);
    }
  };

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
      setError(err instanceof Error ? err.message : 'Failed to load initial feed');
    });
  }, [relayUrls.join(','), initialFeedLoaded]);

  const openAddToDiaryModal = (event: NostrRawEvent) => {
    if (!authState.isLoggedIn || !authState.pubkey) {
      setError('Login is required to add post to diary.');
      return;
    }

    const preferred = diaryStore.getSelectedDiaryId() || runOptions[0]?.diaryId || null;
    setAddToDiaryEvent(event);
    setAddToDiaryTargetId(preferred);
    setNewDiaryInlineTitle('');
    setAddToDiaryModalOpen(true);
    setActivePage('profile');
    setProfileTab('diary');
  };

  const handleConfirmAddToDiary = async () => {
    if (!authState.pubkey || !addToDiaryEvent) return;

    try {
      let targetId = addToDiaryTargetId;
      if (!targetId && newDiaryInlineTitle.trim()) {
        const created = await diaryStore.createDiary(newDiaryInlineTitle.trim(), false);
        targetId = created.id;
      }

      if (!targetId) {
        setError('Select an existing diary or create a new one.');
        return;
      }

      await diaryStore.addItemToDiary(targetId, addToDiaryEvent);
      await hydrateDiaryStateFromStore(targetId);
      setAddToDiaryModalOpen(false);
      setAddToDiaryEvent(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add post to diary');
    }
  };

  const handleAddToGrowmies = async (authorPubkey: string) => {
    if (!authState.pubkey) {
      setError('Login required to manage Growmies');
      return;
    }
    try {
      await growmiesStore.add(authorPubkey);
      hydrateGrowmiesState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add Growmie');
    }
  };

  const moveDiaryEntry = (index: number, direction: 'up' | 'down') => {
    if (!diaryDraft) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= diaryDraft.entries.length) return;

    const nextEntries = [...diaryDraft.entries];
    const temp = nextEntries[index];
    nextEntries[index] = nextEntries[target];
    nextEntries[target] = temp;

    const nextDraft: DiaryIndex = {
      ...diaryDraft,
      entries: nextEntries,
    };
    setDiaryDraft(nextDraft);
  };

  const removeDiaryEntry = async (entryId: string) => {
    if (!diaryDraft) return;
    await diaryStore.removeItemFromDiary(diaryDraft.diaryId, entryId);
    await hydrateDiaryStateFromStore(diaryDraft.diaryId);
  };

  const updateEntryChapter = (entryId: string, nextChapter: string) => {
    if (!diaryDraft) return;

    const nextChapters = diaryDraft.chapters.some((item) => item.key === nextChapter)
      ? diaryDraft.chapters
      : [...diaryDraft.chapters, { key: nextChapter, label: nextChapter }];

    const nextDraft: DiaryIndex = {
      ...diaryDraft,
      chapters: nextChapters,
      entries: diaryDraft.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              chapter: nextChapter,
            }
          : entry
      ),
    };
    setDiaryDraft(nextDraft);
  };

  const handlePublishDiaryChanges = async () => {
    if (!diaryDraft) return;
    if (!authState.pubkey || authState.isReadOnly) {
      setError('Publishing requires signer or nsec login.');
      return;
    }
    setDiaryPublishing(true);
    try {
      await diaryStore.renameDiary(diaryDraft.diaryId, diaryTitleInput);
      await diaryStore.setDiaryPublic(diaryDraft.diaryId, true);
      await diaryStore.syncPublicDiary(diaryDraft.diaryId, authState, relayUrls);
      await hydrateDiaryStateFromStore(diaryDraft.diaryId);
      setDiarySnapshot(null);
      setDiaryEditMode(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish diary changes');
    } finally {
      setDiaryPublishing(false);
    }
  };

  const handleStartEdit = () => {
    if (!diaryDraft) return;
    setDiarySnapshot(JSON.parse(JSON.stringify(diaryDraft)) as DiaryIndex);
    setDiaryEditMode(true);
  };

  const handleCancelEdit = () => {
    if (diarySnapshot) {
      setDiaryDraft(diarySnapshot);
    }
    setDiarySnapshot(null);
    setDiaryEditMode(false);
    setChapterMenuForEntry(null);
  };

  const handleCreateDiary = async () => {
    if (!authState.pubkey) {
      setError('Login required');
      return;
    }
    const created = await diaryStore.createDiary(`My Grow Run #${runOptions.length + 1}`, false);
    await hydrateDiaryStateFromStore(created.id);
    setDiaryEditMode(true);
    const selected = diaryStore.getDiary(created.id);
    if (selected) {
      setDiarySnapshot(
        JSON.parse(
          JSON.stringify({
            version: 1,
            diaryId: selected.id,
            title: selected.title,
            defaultRelayHints: relayUrls,
            chapters: DEFAULT_DIARY_CHAPTERS,
            entries: [],
          })
        ) as DiaryIndex
      );
    }
  };

  const handleSelectRun = (run: DiaryRunOption) => {
    setRunMenuOpen(false);
    loadDiary(run.diaryId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load selected run');
    });
  };

  const handleLogin = async () => {
    try {
      setError(null);
      if (activeAuthTab === 'nsec') {
        if (!features.allowNsecLogin) {
          throw new Error('nsec login is disabled in web mode. Connect a browser signer.');
        }
        if (!nsecInput.trim()) throw new Error('nsec cannot be empty');
        await authManager.loginWithNsec(nsecInput.trim());
      } else {
        if (!npubInput.trim()) throw new Error('npub cannot be empty');
        await authManager.loginWithNpub(npubInput.trim());
      }
      const newState = authManager.getState();
      setAuthState(newState);
      setNsecInput('');
      setNpubInput('');
      setSignerAvailable(authManager.isBrowserSignerAvailable());
      if (newState.pubkey) {
        const syncedRelays = await syncRelaysAndProfile(newState.pubkey);
        await Promise.all([subscribeFeed(syncedRelays), loadAuthorPosts(syncedRelays)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleConnectSigner = async () => {
    try {
      setError(null);
      await authManager.loginWithBrowserSigner();
      const newState = authManager.getState();
      setAuthState(newState);
      setSignerAvailable(authManager.isBrowserSignerAvailable());
      if (newState.pubkey) {
        const syncedRelays = await syncRelaysAndProfile(newState.pubkey);
        await Promise.all([subscribeFeed(syncedRelays), loadAuthorPosts(syncedRelays)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect signer');
    }
  };

  const handleOpenApp = async () => {
    try {
      await Linking.openURL('weedoshi://');
    } catch {
      setError('Could not open app deep link. Install the app and try again.');
    }
  };

  const handleLogout = async () => {
    await authManager.logout();
    setAuthState(authManager.getState());
    setDiaryEditMode(false);
    setProfileMetadata(null);
    setLastSyncedPubkey(null);
  };

  const handleToggleRelay = (url: string) => {
    const enabled = relayManager.getEnabledUrls().includes(url);
    if (enabled) {
      relayManager.disableRelay(url);
    } else {
      relayManager.enableRelay(url);
    }
    setRelayUrls(relayManager.getEnabledUrls());
  };

  const handleAddRelay = () => {
    try {
      if (!newRelay.trim()) throw new Error('Relay URL cannot be empty');
      if (!newRelay.startsWith('wss://')) throw new Error('Relay URL must start with wss://');
      relayManager.addRelay(newRelay.trim());
      setRelayUrls(relayManager.getEnabledUrls());
      setNewRelay('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add relay');
    }
  };

  const handleRemoveRelay = (url: string) => {
    relayManager.removeRelay(url);
    setRelayUrls(relayManager.getEnabledUrls());
  };

  const handleAddHashtag = () => {
    try {
      if (!newHashtag.trim()) throw new Error('Hashtag cannot be empty');
      const tag = newHashtag.trim().toLowerCase().replace(/^#+/, '');
      if (!hashtags.includes(tag)) {
        setHashtags([...hashtags, tag]);
      }
      setNewHashtag('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add hashtag');
    }
  };

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter((h) => h !== tag));
  };

  const handleRefresh = () => {
    setEvents([]);
    subscribeFeed().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to refresh feed');
    });
  };

  const groupedDiary = useMemo(() => {
    if (!diaryDraft) return [] as Array<{ chapter: string; label: string; entries: DiaryEntry[] }>;

    const chapterLabelMap = new Map(diaryDraft.chapters.map((chapter) => [chapter.key, chapter.label]));
    const groups = new Map<string, DiaryEntry[]>();

    for (const entry of diaryDraft.entries) {
      if (!groups.has(entry.chapter)) {
        groups.set(entry.chapter, []);
      }
      groups.get(entry.chapter)!.push(entry);
    }

    return Array.from(groups.entries()).map(([chapter, entriesInChapter]) => ({
      chapter,
      label: chapterLabelMap.get(chapter) || chapter,
      entries: entriesInChapter,
    }));
  }, [diaryDraft]);

  const selectedRunTitle =
    runOptions.find((run) => run.diaryId === diaryIdInput)?.title ||
    runOptions[0]?.title ||
    diaryTitleInput ||
    'My Grow Run #1';

  const selectedRunSyncStatus =
    runOptions.find((run) => run.diaryId === diaryIdInput)?.syncStatus || 'local-only';

  const visibleFeedEvents = useMemo(() => {
    if (!onlyGrowmies) return events;
    if (growmies.length === 0) return [];
    const allowed = new Set(growmies);
    return events.filter((event) => allowed.has(event.author));
  }, [events, onlyGrowmies, growmies]);

  const renderTopNavigation = () => (
    <View style={styles.navRow}>
      <TouchableOpacity
        style={styles.navLink}
        onPress={() => setActivePage('feed')}
      >
        <Text style={[styles.navLinkText, activePage === 'feed' && styles.navLinkTextActive]}>Feed</Text>
        <View style={[styles.navLinkUnderline, activePage === 'feed' && styles.navLinkUnderlineActive]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navLink}
        onPress={() => setActivePage('profile')}
      >
        <Text style={[styles.navLinkText, activePage === 'profile' && styles.navLinkTextActive]}>Profile</Text>
        <View style={[styles.navLinkUnderline, activePage === 'profile' && styles.navLinkUnderlineActive]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navLink}
        onPress={() => setActivePage('settings')}
      >
        <Text style={[styles.navLinkText, activePage === 'settings' && styles.navLinkTextActive]}>Settings</Text>
        <View style={[styles.navLinkUnderline, activePage === 'settings' && styles.navLinkUnderlineActive]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navLink}
        onPress={() => setActivePage('growmies')}
      >
        <Text style={[styles.navLinkText, activePage === 'growmies' && styles.navLinkTextActive]}>Growmies</Text>
        <View style={[styles.navLinkUnderline, activePage === 'growmies' && styles.navLinkUnderlineActive]} />
      </TouchableOpacity>
    </View>
  );

  const renderFeedPage = () => (
    <View style={styles.pageContainer}>
      <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
      <View style={styles.panel}>
        <View style={styles.feedHeader}>
          <Text style={styles.panelTitle}>Weed Feed</Text>
          <TouchableOpacity style={styles.smallButton} onPress={handleRefresh}>
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Loading feed...</Text>
          </View>
        )}

        {!isLoading && visibleFeedEvents.length === 0 && relayUrls.length > 0 && (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>
              {onlyGrowmies ? 'No posts from Growmies yet.' : 'No posts yet.'}
            </Text>
          </View>
        )}

        {visibleFeedEvents.map((event) => (
          <View key={event.id} style={styles.feedItem}>
            <Text style={styles.author}>{event.author.substring(0, 12)}...</Text>
            <Text style={styles.timestamp}>{event.timestamp}</Text>
            <PostMediaRenderer content={event.content} tags={event.tags} textNumberOfLines={5} />
            <View style={styles.tagsContainer}>
              {event.hashtags.map((tag) => (
                <Text key={tag} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>

            <ReactionBar
              eventId={event.id}
              eventAuthor={event.author}
              authState={authState}
              relayUrls={relayUrls}
              onReactionAdded={() => {
                setTimeout(() => {
                  const eventIds = events.map((e) => e.id);
                  reactionManager.fetchReactions(eventIds, relayUrls).catch((err) => {
                    console.warn('Failed to refresh reactions:', err);
                  });
                }, 500);
              }}
            />

            <ThreadIndicator eventId={event.id} />

            {authState.isLoggedIn && (
              <TouchableOpacity
                style={styles.addToDiaryMini}
                onPress={() => openAddToDiaryModal(event as unknown as NostrRawEvent)}
              >
                <Text style={styles.addToDiaryMiniText}>Add to Diary</Text>
              </TouchableOpacity>
            )}
            {authState.isLoggedIn && event.author !== authState.pubkey && !growmies.includes(event.author) && (
              <TouchableOpacity style={styles.addToDiaryMini} onPress={() => handleAddToGrowmies(event.author)}>
                <Text style={styles.addToDiaryMiniText}>Add to Growmies</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
      </View>
    </View>
  );

  const renderProfilePage = () => (
    <View style={styles.pageContainer}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={diaryEditMode ? styles.scrollWithStickyPadding : undefined}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
        {!authState.isLoggedIn && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Login in Settings to manage your profile and diary.</Text>
          </View>
        )}

        <View style={styles.profileHeaderCard}>
          {profileMetadata?.banner ? (
            <Image source={{ uri: profileMetadata.banner }} style={styles.profileBannerImage} resizeMode="cover" />
          ) : (
            <View style={styles.profileBannerFallback} />
          )}
          <View style={styles.profileHeaderRow}>
            <View style={[styles.avatarCircle, isMobile && styles.avatarCircleMobile]}>
              {profileMetadata?.picture ? (
                <Image
                  source={{ uri: profileMetadata.picture }}
                  style={[styles.avatarImage, isMobile && styles.avatarImageMobile]}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarLabel}>{getAvatarLabel(authState, profileMetadata)}</Text>
              )}
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>{getDisplayName(authState, profileMetadata)}</Text>
              <Text style={styles.profilePubkey}>{shortPubkey(authState.pubkey)}</Text>
              {profileMetadata?.about ? (
                <Text style={styles.profileBio} numberOfLines={2}>
                  {profileMetadata.about}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.runSelectorRow}>
            <TouchableOpacity style={styles.runSelectorButton} onPress={() => setRunMenuOpen((prev) => !prev)}>
              <Text style={styles.runSelectorText}>
                {selectedRunTitle} ({runOptions.find((run) => run.diaryId === diaryIdInput)?.itemCount ?? 0})
              </Text>
              <Text style={styles.runSelectorChevron}>{runMenuOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={diaryEditMode ? handleCancelEdit : handleStartEdit}
              disabled={!diaryDraft}
            >
              <Text style={styles.ghostButtonText}>Edit diary</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.syncBadgeRow}>
            <Text style={styles.syncBadgeText}>Sync: {selectedRunSyncStatus}</Text>
          </View>
            {runMenuOpen && runOptions.length > 0 && (
              <View style={styles.runMenu}>
                {runOptions.map((run) => (
                  <TouchableOpacity
                    key={run.diaryId}
                    style={styles.runMenuItem}
                    onPress={() => handleSelectRun(run)}
                  >
                    <Text style={styles.runMenuText}>
                      {run.title} • {run.syncStatus} • {run.itemCount} items
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          <View style={styles.profileTabs}>
            <TouchableOpacity
              style={styles.profileTab}
              onPress={() => setProfileTab('diary')}
            >
              <Text style={[styles.profileTabText, profileTab === 'diary' && styles.profileTabTextActive]}>Diary</Text>
              <View
                style={[
                  styles.profileTabUnderline,
                  profileTab === 'diary' && styles.profileTabUnderlineActive,
                ]}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileTab}
              onPress={() => setProfileTab('all')}
            >
              <Text style={[styles.profileTabText, profileTab === 'all' && styles.profileTabTextActive]}>
                All Posts
              </Text>
              <View
                style={[
                  styles.profileTabUnderline,
                  profileTab === 'all' && styles.profileTabUnderlineActive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>

        {profileTab === 'diary' ? (
          <View>
            {diaryLoading && (
              <View style={styles.centerContent}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.loadingText}>Loading diary...</Text>
              </View>
            )}

            {!diaryLoading && (!diaryDraft || diaryDraft.entries.length === 0) && (
              <View style={styles.emptyDiaryState}>
                <Text style={styles.emptyDiaryTitle}>Start your grow diary</Text>
                <Text style={styles.emptyDiarySubtitle}>
                  Pick posts from your feed and organize them by week.
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => {
                    void handleCreateDiary();
                  }}
                  disabled={!authState.isLoggedIn || authState.isReadOnly}
                >
                  <Text style={styles.buttonText}>Create diary</Text>
                </TouchableOpacity>
              </View>
            )}

            {!!diaryDraft && diaryDraft.entries.length > 0 && (
              <View>
                {groupedDiary.map((section) => (
                  <View key={section.chapter} style={styles.chapterSection}>
                    <Text style={styles.chapterTitle}>{section.label}</Text>
                    <View style={styles.chapterDivider} />

                    {section.entries.map((entry: DiaryEntry) => {
                      const note = diaryEvents[entry.id];
                      const absoluteIndex = diaryDraft
                        ? diaryDraft.entries.findIndex((candidate) => candidate.id === entry.id)
                        : -1;

                      return (
                        <View key={entry.id} style={styles.diaryCard}>
                          <View style={styles.diaryCardHeader}>
                            <Text style={styles.diaryCardDate}>
                              {new Date((note?.created_at || entry.addedAt) * 1000).toLocaleDateString()}
                            </Text>
                            <TouchableOpacity>
                              <Text style={styles.diaryCardMenu}>⋯</Text>
                            </TouchableOpacity>
                          </View>

                          {note ? (
                            <PostMediaRenderer content={note.content} tags={note.tags} textNumberOfLines={4} />
                          ) : (
                            <Text style={styles.diaryCardText}>Post not found on current relays.</Text>
                          )}

                          {diaryEditMode && (
                            <View style={styles.diaryEditRow}>
                              <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => {
                                  if (absoluteIndex >= 0) moveDiaryEntry(absoluteIndex, 'up');
                                }}
                              >
                                <Text style={styles.iconButtonText}>↑</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => {
                                  if (absoluteIndex >= 0) moveDiaryEntry(absoluteIndex, 'down');
                                }}
                              >
                                <Text style={styles.iconButtonText}>↓</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.compactTagButton}
                                onPress={() =>
                                  setChapterMenuForEntry((prev) => (prev === entry.id ? null : entry.id))
                                }
                              >
                                <Text style={styles.compactTagButtonText}>{entry.chapter}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.iconDangerButton} onPress={() => removeDiaryEntry(entry.id)}>
                                <Text style={styles.iconDangerText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {diaryEditMode && chapterMenuForEntry === entry.id && (
                            <View style={styles.chapterMenuWrap}>
                              {diaryDraft.chapters.map((chapter) => (
                                <TouchableOpacity
                                  key={chapter.key}
                                  style={styles.chapterMenuItem}
                                  onPress={() => {
                                    updateEntryChapter(entry.id, chapter.key);
                                    setChapterMenuForEntry(null);
                                  }}
                                >
                                  <Text style={styles.chapterMenuItemText}>{chapter.label}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.panel}>
            <View style={styles.feedHeader}>
              <Text style={styles.panelTitle}>All Posts</Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => {
                  void loadAuthorPosts();
                }}
              >
                <Text style={styles.buttonText}>Reload</Text>
              </TouchableOpacity>
            </View>
            {profileLoading && (
              <View style={styles.centerContent}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.loadingText}>Loading profile posts...</Text>
              </View>
            )}
            {!profileLoading && profilePosts.length === 0 && (
              <Text style={styles.emptyText}>No profile posts found.</Text>
            )}
            {profilePosts.map((post) => (
              <View key={post.id} style={styles.diaryCard}>
                <Text style={styles.timestamp}>{new Date(post.created_at * 1000).toLocaleString()}</Text>
                <PostMediaRenderer content={post.content || ''} tags={post.tags} textNumberOfLines={5} />
                {authState.isLoggedIn && (
                  <TouchableOpacity style={styles.addToDiaryMini} onPress={() => openAddToDiaryModal(post)}>
                    <Text style={styles.addToDiaryMiniText}>Add to Diary</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
        </View>
      </ScrollView>

      {diaryEditMode && (
        <View style={styles.stickyBar}>
          <View style={[styles.stickyBarInner, isMobile && styles.stickyBarInnerMobile]}>
            <TouchableOpacity style={styles.stickySecondary} onPress={handleCancelEdit}>
              <Text style={styles.stickySecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stickyPrimary}
              onPress={handlePublishDiaryChanges}
              disabled={diaryPublishing}
            >
              <Text style={styles.buttonText}>{diaryPublishing ? 'Publishing...' : 'Publish changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderSettingsPage = () => (
    <ScrollView style={styles.pageContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
      {runtimeMode === 'web' && (
        <View style={styles.webModeBanner}>
          <View style={styles.webModeBannerTextWrap}>
            <Text style={styles.webModeBannerTitle}>Web mode</Text>
            <Text style={styles.webModeBannerSubtitle}>
              Browser-safe mode: signer-based auth and restricted native features.
            </Text>
          </View>
          <TouchableOpacity style={styles.webModeOpenAppButton} onPress={handleOpenApp}>
            <Text style={styles.buttonText}>Open App</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Authentication</Text>

        {authState.isLoggedIn ? (
          <View>
            <Text style={styles.statusText}>
              Logged in as {authState.isReadOnly ? '(read-only)' : '(full access)'}
            </Text>
            {authState.method === 'signer' && (
              <Text style={styles.signerHint}>
                Connected via browser signer (NIP-07 / Nostr Connect provider).
              </Text>
            )}
            <Text style={styles.pubkeyText}>{authState.pubkey?.substring(0, 16)}...</Text>
            <TouchableOpacity style={styles.button} onPress={handleLogout}>
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {runtimeMode === 'web' ? (
              <View>
                <Text style={styles.statusText}>Web mode prefers browser signer auth.</Text>
                <TouchableOpacity style={styles.button} onPress={handleConnectSigner}>
                  <Text style={styles.buttonText}>Connect Alby / NIP-07</Text>
                </TouchableOpacity>
                {!signerAvailable && (
                  <Text style={styles.signerHint}>
                    Signer not found. App stays in read-only mode until signer is connected.
                  </Text>
                )}
                <TextInput
                  style={styles.input}
                  placeholder="Enter npub (read-only)"
                  placeholderTextColor="#999"
                  value={npubInput}
                  onChangeText={setNpubInput}
                />
                <TouchableOpacity style={styles.buttonSecondary} onPress={handleLogin}>
                  <Text style={styles.buttonText}>Continue Read-only</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TouchableOpacity style={styles.buttonSecondary} onPress={handleConnectSigner}>
                  <Text style={styles.buttonText}>Login with Alby (NIP-07)</Text>
                </TouchableOpacity>
                <Text style={styles.signerHint}>
                  Prefer extension signer for safer login. Use nsec only if you trust this device.
                </Text>

                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, activeAuthTab === 'nsec' && styles.activeTab]}
                    onPress={() => setActiveAuthTab('nsec')}
                  >
                    <Text style={[styles.tabText, activeAuthTab === 'nsec' && styles.activeTabText]}>
                      nsec (Full)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeAuthTab === 'npub' && styles.activeTab]}
                    onPress={() => setActiveAuthTab('npub')}
                  >
                    <Text style={[styles.tabText, activeAuthTab === 'npub' && styles.activeTabText]}>
                      npub (Read-only)
                    </Text>
                  </TouchableOpacity>
                </View>

                {activeAuthTab === 'nsec' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter nsec (private key)"
                    placeholderTextColor="#999"
                    value={nsecInput}
                    onChangeText={setNsecInput}
                    secureTextEntry
                  />
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter npub (public key)"
                    placeholderTextColor="#999"
                    value={npubInput}
                    onChangeText={setNpubInput}
                  />
                )}

                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                  <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Relays</Text>

        {relayManager.getAllRelays().map((relay) => (
          <View key={relay.url} style={styles.relayItem}>
            <TouchableOpacity style={styles.checkbox} onPress={() => handleToggleRelay(relay.url)}>
              {relay.enabled && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.relayUrl}>{relay.url}</Text>
            {relay.custom && (
              <TouchableOpacity onPress={() => handleRemoveRelay(relay.url)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="Add custom relay (wss://...)"
            placeholderTextColor="#999"
            value={newRelay}
            onChangeText={setNewRelay}
          />
          <TouchableOpacity style={styles.smallButton} onPress={handleAddRelay}>
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SmartRelayPanel
        allowBackgroundProbe={authState.isLoggedIn}
        onSelectionChanged={() => {
          setRelayUrls(relayManager.getEnabledUrls());
        }}
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Hashtags</Text>

        <View style={styles.hashtagContainer}>
          {hashtags.map((tag) => (
            <View key={tag} style={styles.hashtagBadge}>
              <Text style={styles.hashtagText}>{tag}</Text>
              <TouchableOpacity onPress={() => handleRemoveHashtag(tag)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="Add hashtag (#...)"
            placeholderTextColor="#999"
            value={newHashtag}
            onChangeText={setNewHashtag}
          />
          <TouchableOpacity style={styles.smallButton} onPress={handleAddHashtag}>
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!features.allowFileSystem && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Native-only features are hidden in web mode.</Text>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Credits</Text>
        <Text style={styles.statusText}>Credits: Wondrej D. Grower & LLM's</Text>
      </View>

      <DiagnosticsPanel />
      </View>
    </ScrollView>
  );

  const renderGrowmiesPage = () => (
    <ScrollView style={styles.pageContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Growmies</Text>
          <Text style={styles.statusText}>People you follow for feed filtering and quick access.</Text>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => {
              void growmiesStore
                .setOnlyGrowmies(!onlyGrowmies)
                .then(() => {
                  hydrateGrowmiesState();
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Failed to update filter'));
            }}
          >
            <Text style={styles.buttonText}>{onlyGrowmies ? 'Disable Only Growmies' : 'Enable Only Growmies'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => {
              if (authState.isReadOnly) {
                setError('Growmies sync requires signer or nsec login.');
                return;
              }
              void growmiesStore
                .sync(authState, relayUrls)
                .then(() => hydrateGrowmiesState())
                .catch((err) => setError(err instanceof Error ? err.message : 'Growmies sync failed'));
            }}
          >
            <Text style={styles.buttonText}>Sync Growmies to Nostr</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Members ({growmies.length})</Text>
          {growmies.length === 0 && <Text style={styles.emptyText}>No Growmies yet. Add from feed cards.</Text>}
          {growmies.map((pubkey) => (
            <View key={pubkey} style={styles.relayItem}>
              <Text style={styles.relayUrl}>{pubkey}</Text>
              <TouchableOpacity
                onPress={() => {
                  void growmiesStore
                    .remove(pubkey)
                    .then(() => hydrateGrowmiesState())
                    .catch((err) => setError(err instanceof Error ? err.message : 'Failed to remove Growmie'));
                }}
              >
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weedoshi Diaries</Text>
      </View>

      {renderTopNavigation()}

      {error && (
        <View style={styles.errorBoxGlobal}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.errorDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {activePage === 'feed' && renderFeedPage()}
      {activePage === 'profile' && renderProfilePage()}
      {activePage === 'growmies' && renderGrowmiesPage()}
      {activePage === 'settings' && renderSettingsPage()}

      <Modal visible={addToDiaryModalOpen} transparent animationType="fade" onRequestClose={() => setAddToDiaryModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.panelTitle}>Add to Diary</Text>
            <Text style={styles.statusText}>Select an existing diary or create a new one.</Text>

            <ScrollView style={styles.modalList}>
              {runOptions.map((run) => (
                <TouchableOpacity
                  key={run.diaryId}
                  style={[
                    styles.runMenuItem,
                    addToDiaryTargetId === run.diaryId && styles.modalSelectedDiary,
                  ]}
                  onPress={() => setAddToDiaryTargetId(run.diaryId)}
                >
                  <Text style={styles.runMenuText}>
                    {run.title} • {run.itemCount} items • {run.syncStatus}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.input}
              placeholder="New diary name (optional)"
              placeholderTextColor="#999"
              value={newDiaryInlineTitle}
              onChangeText={setNewDiaryInlineTitle}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.stickySecondary} onPress={() => setAddToDiaryModalOpen(false)}>
                <Text style={styles.stickySecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stickyPrimary}
                onPress={() => {
                  void handleConfirmAddToDiary();
                }}
              >
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#059669',
  },
  navRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  navLink: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  navLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  navLinkTextActive: {
    color: '#065f46',
    fontWeight: '700',
  },
  navLinkUnderline: {
    marginTop: 7,
    height: 2,
    width: 54,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  navLinkUnderlineActive: {
    backgroundColor: '#059669',
  },
  pageContainer: {
    flex: 1,
  },
  pageInner: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  pageInnerMobile: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    flex: 1,
  },
  scrollWithStickyPadding: {
    paddingBottom: 88,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  feedItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ecf0ee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
    marginTop: 2,
  },
  content: {
    fontSize: 13,
    color: '#1f2937',
    marginTop: 6,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  profileHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingBottom: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  profileBannerImage: {
    width: '100%',
    height: 132,
    backgroundColor: '#d1d5db',
  },
  profileBannerFallback: {
    width: '100%',
    height: 110,
    backgroundColor: '#ecfdf5',
    borderBottomWidth: 1,
    borderBottomColor: '#d1fae5',
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: -28,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarCircleMobile: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#047857',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarImageMobile: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  profilePubkey: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  profileBio: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4b5563',
    marginTop: 6,
  },
  runSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  runSelectorButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    minWidth: 220,
    maxWidth: 360,
  },
  runSelectorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1f2937',
  },
  runSelectorChevron: {
    fontSize: 10,
    color: '#6b7280',
  },
  runMenu: {
    marginTop: 2,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  runMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  runMenuText: {
    fontSize: 13,
    color: '#1f2937',
  },
  syncBadgeRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  syncBadgeText: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '600',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  ghostButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  profileTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  profileTab: {
    paddingVertical: 10,
    marginRight: 20,
  },
  profileTabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  profileTabTextActive: {
    color: '#065f46',
    fontWeight: '700',
  },
  profileTabUnderline: {
    marginTop: 8,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  profileTabUnderlineActive: {
    backgroundColor: '#059669',
  },
  emptyDiaryState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyDiaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  emptyDiarySubtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  chapterSection: {
    marginBottom: 14,
  },
  chapterTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#4b5563',
    letterSpacing: 0.8,
  },
  chapterDivider: {
    marginTop: 6,
    marginBottom: 8,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  diaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#ecf0ee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  diaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diaryCardDate: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '400',
  },
  diaryCardMenu: {
    fontSize: 18,
    color: '#6b7280',
    lineHeight: 20,
  },
  diaryCardText: {
    marginTop: 8,
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 19,
  },
  diaryCardImage: {
    marginTop: 10,
    width: '100%',
    maxHeight: 240,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  feedImage: {
    marginTop: 8,
    width: '100%',
    height: 115,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  diaryEditRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  compactTagButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  compactTagButtonText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  iconDangerButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDangerText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  chapterMenuWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  chapterMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  chapterMenuItemText: {
    fontSize: 13,
    color: '#1f2937',
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
  },
  stickyBarInner: {
    width: '100%',
    maxWidth: 860,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyBarInnerMobile: {
    marginHorizontal: 12,
  },
  stickySecondary: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  stickySecondaryText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  stickyPrimary: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#059669',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
    color: '#1f2937',
  },
  flexInput: {
    flex: 1,
  },
  inputGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  smallButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tinyLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  buttonSecondary: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  addToDiaryMini: {
    marginTop: 9,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addToDiaryMiniText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  relayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#059669',
    fontSize: 16,
    fontWeight: 'bold',
  },
  relayUrl: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  removeBtn: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  hashtagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  hashtagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  hashtagText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  errorBoxGlobal: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    flex: 1,
  },
  errorDismiss: {
    color: '#991b1b',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoText: {
    color: '#1e3a8a',
    fontSize: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  pubkeyText: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  signerHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
  },
  webModeBanner: {
    backgroundColor: '#ecfeff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#06b6d4',
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  webModeBannerTextWrap: {
    flex: 1,
  },
  webModeBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0e7490',
  },
  webModeBannerSubtitle: {
    fontSize: 12,
    marginTop: 4,
    color: '#155e75',
  },
  webModeOpenAppButton: {
    backgroundColor: '#0e7490',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  modalList: {
    maxHeight: 220,
    marginBottom: 10,
  },
  modalSelectedDiary: {
    backgroundColor: '#ecfdf5',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
