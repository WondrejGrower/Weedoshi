import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, type Href } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Linking,
  Image,
  Modal,
  useWindowDimensions,
  Animated,
} from 'react-native';
import type { Event as NostrRawEvent } from 'nostr-tools';
import { nostrClient } from '../src/lib/nostrClient';
import { authManager } from '../src/lib/authManager';
import { relayManager } from '../src/lib/relayManager';
import { DiagnosticsPanel } from '../src/components/DiagnosticsPanel';
import { ReactionBar } from '../src/components/ReactionBar';
import { ThreadIndicator } from '../src/components/ThreadIndicator';
import { SmartRelayPanel } from '../src/components/SmartRelayPanel';
import { PostMediaRenderer } from '../src/components/PostMediaRenderer';
import { PlantPicker } from '../src/components/PlantPicker';
import { reactionManager } from '../src/lib/reactionManager';
import type { NostrProfileMetadata } from '../src/lib/nostrClient';
import type { AuthState, Nip46PairingState } from '../src/lib/authManager';
import { getRuntimeMode } from '../src/runtime/mode';
import { getFeatures } from '../src/runtime/features';
import {
  diaryManager,
  defaultDiaryId,
  fetchAuthorNotes,
  type DiaryIndex,
} from '../src/lib/diaryManager';
import { diaryStore, type Diary } from '../src/lib/diaryStore';
import { growmiesStore } from '../src/lib/growmiesStore';
import { DEFAULT_HASHTAGS } from '../src/features/home/constants';
import {
  getAvatarLabel,
  getDisplayName,
  shortPubkey,
} from '../src/features/home/profileHelpers';
import { useFeedController } from '../src/features/feed/useFeedController';
import { logger } from '../src/lib/logger';
import { assertNoSensitiveMaterial } from '../src/lib/securityBaseline';
import { getAllHashtags } from '../src/lib/eventFilter';
import { getJson, setJson } from '../src/lib/persistentStorage';
import { extractMediaFromContent } from '../src/lib/mediaExtraction';
import { normalizePlantDTagSlug } from '../src/lib/plants/catalog';
import type { PlantSelection } from '../src/lib/plants/types';

const runtimeMode = getRuntimeMode();
const features = getFeatures(runtimeMode);

type MainPage = 'feed' | 'profile' | 'growmies' | 'settings';
type ProfileTab = 'diary' | 'all';
type SettingsSection = 'authentication' | 'relays' | 'hashtags' | 'growmies';
const LOGIN_PROMPT_DISMISSED_KEY = 'login_prompt_dismissed_v1';
const ANONYMOUS_BROWSING_ENABLED_KEY = 'anonymous_browsing_enabled_v1';
const PHASE_TEMPLATE_OPTIONS = ['Seedling', 'Vegetation', 'Flowering', 'Harvest'];

function getDiaryCoverForCard(diary: Diary): string | undefined {
  if (diary.coverImage) return diary.coverImage;
  for (const item of diary.items) {
    if (item.image) return item.image;
    if (item.contentPreview) {
      const fromPreview = extractMediaFromContent(item.contentPreview).images[0];
      if (fromPreview) return fromPreview;
    }
  }
  return undefined;
}

type DiaryRunOption = {
  diaryId: string;
  title: string;
  isPublic: boolean;
  syncStatus: 'local-only' | 'syncing' | 'synced' | 'error';
  itemCount: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [activePage, setActivePage] = useState<MainPage>('profile');
  const [profileTab, setProfileTab] = useState<ProfileTab>('diary');
  const [hoveredProfileTab, setHoveredProfileTab] = useState<ProfileTab | null>(null);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('growmies');
  const [loginPromptDismissed, setLoginPromptDismissed] = useState(false);
  const [loginPromptLoaded, setLoginPromptLoaded] = useState(false);
  const [loginPromptMenuOpen, setLoginPromptMenuOpen] = useState(false);
  const [anonymousBrowsingEnabled, setAnonymousBrowsingEnabled] = useState(false);
  const settingsMenuAnim = useRef(new Animated.Value(0)).current;

  const [authState, setAuthState] = useState<AuthState>(authManager.getState());
  const [relayUrls, setRelayUrls] = useState<string[]>(relayManager.getEnabledUrls());
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS);
  const [feedFilterEnabled, setFeedFilterEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newRelay, setNewRelay] = useState('');
  const [newHashtag, setNewHashtag] = useState('');
  const [nsecInput, setNsecInput] = useState('');
  const [npubInput, setNpubInput] = useState('');
  const [activeAuthTab, setActiveAuthTab] = useState<'nsec' | 'npub'>(
    features.allowNsecLogin ? 'nsec' : 'npub'
  );
  const [signerAvailable, setSignerAvailable] = useState(authManager.isBrowserSignerAvailable());
  const [nip46Available, setNip46Available] = useState(authManager.isNip46SignerAvailable());
  const [nip46BridgePresent, setNip46BridgePresent] = useState(authManager.isNip46BridgePresent());
  const [nip46PairingInput, setNip46PairingInput] = useState('');
  const [nip46PairingBusy, setNip46PairingBusy] = useState(false);
  const [nip46PairingState, setNip46PairingState] = useState<Nip46PairingState>({
    phase: 'unavailable',
    connectionUri: null,
    code: null,
    message: null,
  });

  const [diaryIdInput, setDiaryIdInput] = useState(defaultDiaryId());
  const [diaryTitleInput, setDiaryTitleInput] = useState('My Grow Run #1');
  const [diaryDraft, setDiaryDraft] = useState<DiaryIndex | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryPublishing, setDiaryPublishing] = useState(false);
  const [diaryEditMode, setDiaryEditMode] = useState(false);
  const [diarySnapshot, setDiarySnapshot] = useState<DiaryIndex | null>(null);
  const [diaryPlantInput, setDiaryPlantInput] = useState('');
  const [diaryPlantSlug, setDiaryPlantSlug] = useState('');
  const [diarySpeciesInput, setDiarySpeciesInput] = useState('');
  const [diaryCultivarInput, setDiaryCultivarInput] = useState('');
  const [diaryBreederInput, setDiaryBreederInput] = useState('');
  const [diaryPlantWikiAPointer, setDiaryPlantWikiAPointer] = useState('');
  const [diaryMoreOpen, setDiaryMoreOpen] = useState(false);
  const [diaryPhaseInput, setDiaryPhaseInput] = useState('');

  const [profileLoading, setProfileLoading] = useState(false);
  const [profilePosts, setProfilePosts] = useState<NostrRawEvent[]>([]);
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
  const [feedAuthorNames, setFeedAuthorNames] = useState<Record<string, string>>({});
  const [profileHashtagFilterEnabled, setProfileHashtagFilterEnabled] = useState(false);
  const [profileHashtags, setProfileHashtags] = useState<string[]>([]);
  const [newProfileHashtag, setNewProfileHashtag] = useState('');
  const [diaryTileAspectById, setDiaryTileAspectById] = useState<Record<string, number>>({});
  const {
    events,
    isLoading,
    subscribeFeed,
    refresh: refreshFeed,
  } = useFeedController({
    relayUrls,
    hashtags,
    filterEnabled: feedFilterEnabled,
    onError: setError,
  });

  useEffect(() => {
    setSignerAvailable(authManager.isBrowserSignerAvailable());
    setNip46Available(authManager.isNip46SignerAvailable());
    setNip46BridgePresent(authManager.isNip46BridgePresent());
  }, []);

  useEffect(() => {
    let canceled = false;
    Promise.all([
      getJson<boolean>(LOGIN_PROMPT_DISMISSED_KEY, false),
      getJson<boolean>(ANONYMOUS_BROWSING_ENABLED_KEY, false),
    ])
      .then(([promptDismissed, anonymousEnabled]) => {
        if (canceled) return;
        setLoginPromptDismissed(Boolean(promptDismissed));
        setAnonymousBrowsingEnabled(Boolean(anonymousEnabled));
      })
      .finally(() => {
        if (canceled) return;
        setLoginPromptLoaded(true);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    Animated.timing(settingsMenuAnim, {
      toValue: settingsMenuOpen ? 1 : 0,
      duration: settingsMenuOpen ? 160 : 120,
      useNativeDriver: true,
    }).start();
  }, [settingsMenuAnim, settingsMenuOpen]);

  const refreshSignerAvailability = useCallback(() => {
    setSignerAvailable(authManager.isBrowserSignerAvailable());
    setNip46Available(authManager.isNip46SignerAvailable());
    setNip46BridgePresent(authManager.isNip46BridgePresent());
  }, []);

  const persistLoginPromptDismissed = useCallback(async () => {
    setLoginPromptDismissed(true);
    await setJson(LOGIN_PROMPT_DISMISSED_KEY, true);
  }, []);

  const enableAnonymousBrowsing = useCallback(async () => {
    setAnonymousBrowsingEnabled(true);
    await setJson(ANONYMOUS_BROWSING_ENABLED_KEY, true);
    await persistLoginPromptDismissed();
    setLoginPromptMenuOpen(false);
    setActivePage('feed');
    setSettingsSection('authentication');
  }, [persistLoginPromptDismissed]);

  const disableAnonymousBrowsing = useCallback(async () => {
    setAnonymousBrowsingEnabled(false);
    await setJson(ANONYMOUS_BROWSING_ENABLED_KEY, false);
  }, []);

  const refreshNip46PairingState = useCallback(async () => {
    const state = await authManager.getNip46PairingState();
    setNip46PairingState(state);
  }, []);

  useEffect(() => {
    refreshNip46PairingState().catch(() => {
      // best-effort status load
    });
  }, [refreshNip46PairingState]);

  useEffect(() => {
    if (!authState.isLoggedIn || loginPromptDismissed) return;
    persistLoginPromptDismissed().catch(() => {
      // best-effort persistence only
    });
  }, [authState.isLoggedIn, loginPromptDismissed, persistLoginPromptDismissed]);

  useEffect(() => {
    if (!loginPromptLoaded) return;
    if (authState.isLoggedIn) return;
    if (!anonymousBrowsingEnabled) return;
    setActivePage('feed');
  }, [authState.isLoggedIn, anonymousBrowsingEnabled, loginPromptLoaded]);

  const hydrateDiaryStateFromStore = useCallback(async (preferredDiaryId?: string) => {
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

  }, [relayUrls]);

  const hydrateGrowmiesState = useCallback(() => {
    setGrowmies(growmiesStore.list());
    setOnlyGrowmies(growmiesStore.isOnlyGrowmies());
  }, []);

  const syncRelaysAndProfile = useCallback(async (pubkey: string): Promise<string[]> => {
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
  }, []);

  const loadDiary = useCallback(async (forcedDiaryId?: string) => {
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
  }, [authState.pubkey, relayUrls, hydrateDiaryStateFromStore]);

  const loadAuthorPosts = useCallback(async (relayOverride?: string[]) => {
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
  }, [authState.pubkey, relayUrls]);

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
  }, [
    authState.isLoggedIn,
    authState.pubkey,
    relayUrls,
    lastSyncedPubkey,
    syncRelaysAndProfile,
    loadDiary,
    hydrateGrowmiesState,
    loadAuthorPosts,
  ]);

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
      const eventIdToOpen = addToDiaryEvent.id;
      if (!targetId && newDiaryInlineTitle.trim()) {
        assertNoSensitiveMaterial(newDiaryInlineTitle.trim(), 'new diary title');
        const created = await diaryStore.createDiary(newDiaryInlineTitle.trim(), false);
        targetId = created.id;
      }

      if (!targetId) {
        setError('Select an existing diary or create a new one.');
        return;
      }

      await diaryStore.addItemToDiary(targetId, addToDiaryEvent, diaryPhaseInput.trim() || undefined);
      await hydrateDiaryStateFromStore(targetId);
      setAddToDiaryModalOpen(false);
      setAddToDiaryEvent(null);
      setError(null);
      const path = eventIdToOpen
        ? `/diary/${encodeURIComponent(targetId)}?entryId=${encodeURIComponent(eventIdToOpen)}`
        : `/diary/${encodeURIComponent(targetId)}`;
      router.push(path as Href);
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

  const handlePublishDiaryChanges = async () => {
    if (!diaryDraft) return;
    if (!authState.pubkey || authState.isReadOnly) {
      setError('Publishing requires signer or nsec login.');
      return;
    }
    setDiaryPublishing(true);
    try {
      assertNoSensitiveMaterial(diaryTitleInput, 'diary title');
      if (!diaryPlantInput.trim()) {
        throw new Error('Plant is required. Select from Plant search or use Custom.');
      }
      await diaryStore.updateDiaryDetails(diaryDraft.diaryId, {
        title: diaryTitleInput,
        plant: diaryPlantInput,
        plantSlug: diaryPlantSlug,
        species: diarySpeciesInput,
        cultivar: diaryCultivarInput,
        breeder: diaryBreederInput,
        plantWikiAPointer: diaryPlantWikiAPointer,
        phase: diaryPhaseInput,
      });
      await diaryStore.setDiaryItemOrder(
        diaryDraft.diaryId,
        diaryDraft.entries.map((entry) => entry.id)
      );
      const labelsByEventId = Object.fromEntries(
        diaryDraft.entries.map((entry) => [entry.id, entry.chapter || 'General'])
      );
      await diaryStore.setDiaryItemPhaseLabels(diaryDraft.diaryId, labelsByEventId);
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

  const handleCancelEdit = () => {
    if (diarySnapshot) {
      setDiaryDraft(diarySnapshot);
    }
    setDiarySnapshot(null);
    setDiaryEditMode(false);
  };

  const handleCreateDiary = async () => {
    if (!authState.pubkey) {
      setError('Login required');
      return;
    }
    const proposedTitle = diaryTitleInput.trim() || `My Grow Run #${runOptions.length + 1}`;
    if (!diaryPlantInput.trim()) {
      throw new Error('Plant is required. Select from Plant search or use Custom.');
    }
    const created = await diaryStore.createDiary(proposedTitle, false, {
      plant: diaryPlantInput,
      plantSlug: diaryPlantSlug,
      species: diarySpeciesInput,
      cultivar: diaryCultivarInput,
      breeder: diaryBreederInput,
      plantWikiAPointer: diaryPlantWikiAPointer,
      phase: diaryPhaseInput,
    });
    await hydrateDiaryStateFromStore(created.id);
    setDiaryEditMode(false);
    setDiarySnapshot(null);
    router.push(`/diary/${encodeURIComponent(created.id)}` as Href);
  };

  const handleOpenDiaryEditor = async () => {
    if (!authState.pubkey) {
      setError('Login required');
      return;
    }
    if (!diaryDraft) {
      await handleCreateDiary();
      return;
    }
    router.push(`/diary/${encodeURIComponent(diaryDraft.diaryId)}` as Href);
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
      await disableAnonymousBrowsing();
      setNsecInput('');
      setNpubInput('');
      refreshSignerAvailability();
      await refreshNip46PairingState();
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
      await authManager.loginWithSignerFirst();
      const newState = authManager.getState();
      setAuthState(newState);
      await disableAnonymousBrowsing();
      refreshSignerAvailability();
      await refreshNip46PairingState();
      if (newState.pubkey) {
        const syncedRelays = await syncRelaysAndProfile(newState.pubkey);
        await Promise.all([subscribeFeed(syncedRelays), loadAuthorPosts(syncedRelays)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect signer');
    }
  };

  const handleConnectNip46 = async () => {
    try {
      setError(null);
      await authManager.connectNip46Session();
      const newState = authManager.getState();
      setAuthState(newState);
      await disableAnonymousBrowsing();
      refreshSignerAvailability();
      await refreshNip46PairingState();
      if (newState.pubkey) {
        const syncedRelays = await syncRelaysAndProfile(newState.pubkey);
        await Promise.all([subscribeFeed(syncedRelays), loadAuthorPosts(syncedRelays)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect NIP-46');
    }
  };

  const handleDisconnectNip46 = async () => {
    try {
      setError(null);
      await authManager.disconnectNip46Session();
      setAuthState(authManager.getState());
      refreshSignerAvailability();
      await refreshNip46PairingState();
      setDiaryEditMode(false);
      setProfileMetadata(null);
      setLastSyncedPubkey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect NIP-46');
    }
  };

  const handleStartNip46Pairing = async () => {
    try {
      setError(null);
      setNip46PairingBusy(true);
      const state = await authManager.startNip46Pairing(nip46PairingInput);
      setNip46PairingState(state);
      refreshSignerAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start NIP-46 pairing');
    } finally {
      setNip46PairingBusy(false);
    }
  };

  const handleApproveNip46Pairing = async () => {
    try {
      setError(null);
      setNip46PairingBusy(true);
      const state = await authManager.approveNip46Pairing();
      setNip46PairingState(state);
      refreshSignerAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve NIP-46 pairing');
    } finally {
      setNip46PairingBusy(false);
    }
  };

  const handleRefreshNip46Pairing = async () => {
    try {
      setNip46PairingBusy(true);
      await refreshNip46PairingState();
      refreshSignerAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh NIP-46 pairing status');
    } finally {
      setNip46PairingBusy(false);
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
    await enableAnonymousBrowsing();
    refreshSignerAvailability();
    await refreshNip46PairingState();
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

  const handleResetDefaultHashtags = () => {
    setHashtags(DEFAULT_HASHTAGS);
    setFeedFilterEnabled(true);
  };

  const handleAddProfileHashtag = () => {
    const tag = newProfileHashtag.trim().toLowerCase().replace(/^#+/, '');
    if (!tag) return;
    if (!profileHashtags.includes(tag)) {
      setProfileHashtags((prev) => [...prev, tag]);
    }
    setNewProfileHashtag('');
  };

  const handleRemoveProfileHashtag = (tag: string) => {
    setProfileHashtags((prev) => prev.filter((item) => item !== tag));
  };

  const handlePlantSelection = (selection: PlantSelection) => {
    setDiaryPlantInput(selection.displayName);
    setDiaryPlantSlug(selection.slug);
    setDiarySpeciesInput(selection.latinName || '');
    if (selection.isCustom) {
      setDiaryPlantWikiAPointer('');
    }
  };

  const handleOpenPlantDetails = () => {
    const sourceSlug = diaryPlantSlug || diaryPlantInput;
    const slug = normalizePlantDTagSlug(sourceSlug);
    if (!slug) {
      setError('Select plant first to open details.');
      return;
    }
    router.push(`/plant/${encodeURIComponent(slug)}?name=${encodeURIComponent(diaryPlantInput || '')}` as Href);
  };

  const handleRefresh = () => {
    setError(null);
    refreshFeed();
  };

  const persistDiaryDetails = useCallback(async () => {
    if (!diaryDraft) return;
    try {
      await diaryStore.updateDiaryDetails(diaryDraft.diaryId, {
        title: diaryTitleInput,
        plant: diaryPlantInput,
        plantSlug: diaryPlantSlug,
        species: diarySpeciesInput,
        cultivar: diaryCultivarInput,
        breeder: diaryBreederInput,
        plantWikiAPointer: diaryPlantWikiAPointer,
        phase: diaryPhaseInput,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save diary details');
    }
  }, [
    diaryDraft,
    diaryTitleInput,
    diaryPlantInput,
    diaryPlantSlug,
    diarySpeciesInput,
    diaryCultivarInput,
    diaryBreederInput,
    diaryPlantWikiAPointer,
    diaryPhaseInput,
  ]);

  const feedHashtagsKey = useMemo(() => hashtags.join('|'), [hashtags]);
  useEffect(() => {
    if (relayUrls.length === 0) return;
    refreshFeed();
  }, [feedFilterEnabled, feedHashtagsKey, refreshFeed, relayUrls.length]);

  const profileDiaries = useMemo(
    () =>
      runOptions
        .map((run) => diaryStore.getDiary(run.diaryId))
        .filter((diary): diary is Diary => Boolean(diary)),
    [runOptions]
  );
  const nostrSinceLabel = useMemo(() => {
    if (!authState.pubkey) return 'Unknown';
    const timestamps = profilePosts.map((post) => post.created_at).filter((v) => Number.isFinite(v) && v > 0);
    if (timestamps.length === 0) return 'Unknown';
    const oldest = Math.min(...timestamps);
    const date = new Date(oldest * 1000);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }, [authState.pubkey, profilePosts]);

  const selectedRunTitle =
    runOptions.find((run) => run.diaryId === diaryIdInput)?.title ||
    runOptions[0]?.title ||
    diaryTitleInput ||
    'My Grow Run #1';

  const selectedRunSyncStatus =
    runOptions.find((run) => run.diaryId === diaryIdInput)?.syncStatus || 'local-only';
  const profilePubkeyText = shortPubkey(authState.pubkey);
  const nip46PhaseLabel = nip46PairingState.phase.toUpperCase();
  const isReadOnlyBlocked = authState.isLoggedIn && authState.isReadOnly;
  const readOnlyBlockHint = isReadOnlyBlocked
    ? 'Read-only mode: connect signer or nsec local signer to publish.'
    : null;

  const visibleFeedEvents = useMemo(() => {
    if (!onlyGrowmies) return events;
    if (growmies.length === 0) return [];
    const allowed = new Set(growmies);
    return events.filter((event) => allowed.has(event.author));
  }, [events, onlyGrowmies, growmies]);

  const getDiaryTileResizeMode = useCallback((diaryId: string): 'cover' | 'contain' => {
    const aspect = diaryTileAspectById[diaryId];
    if (!aspect) return 'cover';
    // Portrait-heavy images keep full subject visibility, landscape images keep visual fill.
    return aspect < 0.82 ? 'contain' : 'cover';
  }, [diaryTileAspectById]);

  const visibleProfilePosts = useMemo(() => {
    if (!profileHashtagFilterEnabled || profileHashtags.length === 0) {
      return profilePosts;
    }
    const selected = new Set(profileHashtags.map((tag) => tag.toLowerCase()));
    return profilePosts.filter((post) => {
      const tags = getAllHashtags(post);
      return tags.some((tag) => selected.has(tag.toLowerCase()));
    });
  }, [profileHashtagFilterEnabled, profileHashtags, profilePosts]);

  const growmiesFeedEvents = useMemo(() => {
    if (growmies.length === 0) return [];
    const allowed = new Set(growmies);
    return events.filter((event) => allowed.has(event.author));
  }, [events, growmies]);

  const renderFeedEventCard = (event: typeof events[number], allowAddToGrowmies: boolean) => (
    <View key={event.id} style={styles.feedItem}>
      <View style={styles.feedItemHeader}>
        <View style={styles.feedAuthorAvatar}>
          <Text style={styles.feedAuthorAvatarText}>
            {(feedAuthorNames[event.author] || shortPubkey(event.author)).slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.feedAuthorMeta}>
          <Text style={styles.author}>
            {feedAuthorNames[event.author] || shortPubkey(event.author)}
          </Text>
          <Text style={styles.timestamp}>{event.timestamp}</Text>
        </View>
      </View>
      <PostMediaRenderer content={event.content} tags={event.tags} textNumberOfLines={5} />
      <View style={styles.tagsContainer}>
        {event.hashtags.map((tag) => (
          <Text key={tag} style={styles.tag}>
            #{tag}
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
            reactionManager.fetchInteractions(eventIds, relayUrls).catch((err) => {
              logger.warn('Failed to refresh reactions:', err);
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
      {allowAddToGrowmies && authState.isLoggedIn && event.author !== authState.pubkey && !growmies.includes(event.author) && (
        <TouchableOpacity style={styles.addToDiaryMini} onPress={() => handleAddToGrowmies(event.author)}>
          <Text style={styles.addToDiaryMiniText}>Add to Growmies</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  useEffect(() => {
    if (relayUrls.length === 0 || visibleFeedEvents.length === 0) return;

    const missingAuthors = Array.from(
      new Set(visibleFeedEvents.map((event) => event.author).filter((author) => !feedAuthorNames[author]))
    ).slice(0, 12);

    if (missingAuthors.length === 0) return;

    let canceled = false;
    Promise.all(
      missingAuthors.map(async (author) => {
        const metadata = await nostrClient.fetchProfileMetadata(author, relayUrls, 2500);
        const label = metadata?.display_name?.trim() || metadata?.name?.trim() || '';
        return { author, label };
      })
    )
      .then((resolved) => {
        if (canceled) return;
        setFeedAuthorNames((prev) => {
          const next = { ...prev };
          for (const item of resolved) {
            if (item.label) {
              next[item.author] = item.label;
            }
          }
          return next;
        });
      })
      .catch(() => {
        // best effort only
      });

    return () => {
      canceled = true;
    };
  }, [visibleFeedEvents, relayUrls, feedAuthorNames]);

  const renderFeedPage = () => (
    <View style={styles.pageContainer}>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
          <View style={styles.panel}>
            <View style={styles.feedHeader}>
              <Text style={styles.panelTitle}>Decentralized Farmers</Text>
              <TouchableOpacity style={styles.smallButton} onPress={handleRefresh}>
                <Text style={styles.buttonText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.feedFilterCard}>
              <View style={styles.feedFilterHeader}>
                <Text style={styles.feedFilterTitle}>Hashtag filter</Text>
                <TouchableOpacity
                  style={[styles.filterToggleBtn, !feedFilterEnabled && styles.filterToggleBtnMuted]}
                  onPress={() => setFeedFilterEnabled((prev) => !prev)}
                >
                  <Text style={styles.filterToggleBtnText}>
                    {feedFilterEnabled ? 'Filtering ON' : 'Filtering OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
              {feedFilterEnabled ? (
                <>
                  <Text style={styles.signerHint}>
                    Default load uses #weedstr + #plantstr and includes older notes.
                  </Text>
                  <View style={styles.hashtagContainer}>
                    {hashtags.map((tag) => (
                      <View key={tag} style={styles.hashtagBadge}>
                        <Text style={styles.hashtagText}>#{tag}</Text>
                        <TouchableOpacity onPress={() => handleRemoveHashtag(tag)}>
                          <Text style={styles.removeBtn}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, styles.flexInput]}
                      placeholder="Add hashtag"
                      placeholderTextColor="#999"
                      value={newHashtag}
                      onChangeText={setNewHashtag}
                    />
                    <TouchableOpacity style={styles.smallButton} onPress={handleAddHashtag}>
                      <Text style={styles.buttonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.buttonSecondary} onPress={handleResetDefaultHashtags}>
                    <Text style={styles.buttonText}>Reset to #weedstr + #plantstr</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.signerHint}>Feed runs without hashtag filtering.</Text>
              )}
            </View>
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

          {visibleFeedEvents.map((event) => renderFeedEventCard(event, true))}
        </View>
      </ScrollView>
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
        <View style={[styles.brandPlaqueInline, isMobile && styles.brandPlaqueInlineMobile]}>
          <Image
            source={require('../assets/WeedoshiBanner.png')}
            style={styles.brandPlaqueImage}
            resizeMode="cover"
          />
        </View>
        {!authState.isLoggedIn && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Use the green Login button to connect Alby, or continue as anon.</Text>
          </View>
        )}

        <View style={[styles.profileHeaderCard, isMobile && styles.profileHeaderCardMobile]}>
          <View style={[styles.profileBannerWrap, isMobile && styles.profileBannerWrapMobile]}>
            {profileMetadata?.banner ? (
              <Image source={{ uri: profileMetadata.banner }} style={styles.profileBannerImage} resizeMode="cover" />
            ) : (
              <Image source={require('../assets/WeedoshiBanner.png')} style={styles.profileBannerImage} resizeMode="cover" />
            )}
            <View pointerEvents="none" style={styles.profileBannerOverlayTop} />
            <View pointerEvents="none" style={styles.profileBannerOverlayBottom} />
          </View>

          <View style={[styles.profileHeaderContent, isMobile && styles.profileHeaderContentMobile]}>
            <View style={[styles.profileHeaderRow, isMobile && styles.profileHeaderRowMobile]}>
              <TouchableOpacity
                style={[styles.avatarCircle, isMobile && styles.avatarCircleMobile]}
                onPress={() => setActivePage('profile')}
                accessibilityRole="button"
                accessibilityLabel="Profile"
              >
                {profileMetadata?.picture ? (
                  <Image
                    source={{ uri: profileMetadata.picture }}
                    style={[styles.avatarImage, isMobile && styles.avatarImageMobile]}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarLabel}>{getAvatarLabel(authState, profileMetadata)}</Text>
                )}
              </TouchableOpacity>
              <View style={styles.profileMeta}>
                <View style={styles.profileNameRow}>
                  <Text style={[styles.profileName, isMobile && styles.profileNameMobile]}>
                    {getDisplayName(authState, profileMetadata)}
                  </Text>
                </View>
                <Text style={styles.profilePubkey}>{profilePubkeyText}</Text>
                {profileMetadata?.about ? (
                  <Text style={styles.profileBio}>
                    {profileMetadata.about}
                  </Text>
                ) : null}
                <View style={styles.profileStatsRow}>
                  <View style={styles.profileStatPill}>
                    <Text style={styles.profileStatValue}>{runOptions.length}</Text>
                    <Text style={styles.profileStatLabel}>Diaries</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.profileStatActionPill,
                      authState.isReadOnly && styles.profileStatActionPillDisabled,
                    ]}
                    onPress={() => {
                      handleOpenDiaryEditor().catch((err) => {
                        setError(err instanceof Error ? err.message : 'Failed to open diary editor');
                      });
                    }}
                    disabled={authState.isReadOnly}
                  >
                    <Text style={styles.profileStatActionText}>Add diary</Text>
                  </TouchableOpacity>
                  <View style={styles.profileStatPill}>
                    <Text style={styles.profileStatValue}>{profilePosts.length}</Text>
                    <Text style={styles.profileStatLabel}>Notes</Text>
                  </View>
                  <View style={styles.profileStatPill}>
                    <Text style={styles.profileStatValue}>{growmies.length}</Text>
                    <Text style={styles.profileStatLabel}>Growmies</Text>
                  </View>
                  <View style={styles.profileStatPill}>
                    <Text style={styles.profileStatValue}>{nostrSinceLabel}</Text>
                    <Text style={styles.profileStatLabel}>Nostr since</Text>
                  </View>
                </View>
                {authState.isLoggedIn && (
                  <View style={styles.profileQuickActions}>
                    <TouchableOpacity style={styles.buttonSecondary} onPress={handleLogout}>
                      <Text style={styles.buttonText}>Logout to Anonymous</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {diaryEditMode && (
              <View style={styles.diaryHeaderActions}>
                <TouchableOpacity style={styles.ghostButton} onPress={handleCancelEdit}>
                  <Text style={styles.ghostButtonText}>Close editor</Text>
                </TouchableOpacity>
              </View>
            )}
            {diaryEditMode && (
              <>
                <View style={styles.runSelectorRow}>
                  <TouchableOpacity style={styles.runSelectorButton} onPress={() => setRunMenuOpen((prev) => !prev)}>
                    <Text style={styles.runSelectorText}>
                      {selectedRunTitle} ({runOptions.find((run) => run.diaryId === diaryIdInput)?.itemCount ?? 0})
                    </Text>
                    <Text style={styles.runSelectorChevron}>{runMenuOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.diaryDetailsWrap}>
                  <View style={styles.diaryDetailField}>
                    <Text style={styles.diaryDetailLabel}>Diary name</Text>
                    <TextInput
                      style={styles.diaryDetailInput}
                      value={diaryTitleInput}
                      onChangeText={setDiaryTitleInput}
                      onBlur={() => {
                        persistDiaryDetails().catch(() => {
                          // error handled in callback
                        });
                      }}
                      placeholder="My Plant Journal"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={styles.diaryDetailRow}>
                    <View style={[styles.diaryDetailField, styles.diaryDetailFieldHalf]}>
                      <Text style={styles.diaryDetailLabel}>Plant</Text>
                      <PlantPicker
                        valueSlug={diaryPlantSlug}
                        valueName={diaryPlantInput}
                        onChange={(selection) => {
                          handlePlantSelection(selection);
                          persistDiaryDetails().catch(() => {
                            // error handled in callback
                          });
                        }}
                      />
                      <View style={styles.plantActionsRow}>
                        <TouchableOpacity style={styles.smallButton} onPress={handleOpenPlantDetails}>
                          <Text style={styles.buttonText}>Plant details</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.buttonSecondary}
                          onPress={() => setDiaryMoreOpen((prev) => !prev)}
                        >
                          <Text style={styles.buttonText}>{diaryMoreOpen ? 'Less' : 'More'}</Text>
                        </TouchableOpacity>
                      </View>
                      {diaryMoreOpen && (
                        <View style={styles.plantMoreWrap}>
                          <Text style={styles.diaryDetailLabel}>Cultivar / Strain</Text>
                          <TextInput
                            style={styles.diaryDetailInput}
                            value={diaryCultivarInput}
                            onChangeText={setDiaryCultivarInput}
                            onBlur={() => {
                              persistDiaryDetails().catch(() => {
                                // error handled in callback
                              });
                            }}
                            placeholder="Optional cultivar/strain"
                            placeholderTextColor="#9ca3af"
                          />
                          <Text style={styles.diaryDetailLabel}>Breeder</Text>
                          <TextInput
                            style={styles.diaryDetailInput}
                            value={diaryBreederInput}
                            onChangeText={setDiaryBreederInput}
                            onBlur={() => {
                              persistDiaryDetails().catch(() => {
                                // error handled in callback
                              });
                            }}
                            placeholder="Optional breeder"
                            placeholderTextColor="#9ca3af"
                          />
                          <Text style={styles.diaryDetailLabel}>Wiki article pointer (a)</Text>
                          <TextInput
                            style={styles.diaryDetailInput}
                            value={diaryPlantWikiAPointer}
                            onChangeText={setDiaryPlantWikiAPointer}
                            onBlur={() => {
                              persistDiaryDetails().catch(() => {
                                // error handled in callback
                              });
                            }}
                            placeholder="30818:<pubkey>:<d-tag>"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>
                      )}
                    </View>
                    <View style={[styles.diaryDetailField, styles.diaryDetailFieldHalf]}>
                      <Text style={styles.diaryDetailLabel}>Phase</Text>
                      <TextInput
                        style={styles.diaryDetailInput}
                        value={diaryPhaseInput}
                        onChangeText={setDiaryPhaseInput}
                        onBlur={() => {
                          persistDiaryDetails().catch(() => {
                            // error handled in callback
                          });
                        }}
                        placeholder="e.g. Seedling / Vegetation Week 3"
                        placeholderTextColor="#9ca3af"
                      />
                      <View style={styles.phaseTemplatesRow}>
                        {PHASE_TEMPLATE_OPTIONS.map((template) => (
                          <TouchableOpacity
                            key={template}
                            style={[
                              styles.phaseTemplateChip,
                              diaryPhaseInput.trim().toLowerCase().startsWith(template.toLowerCase()) &&
                                styles.phaseTemplateChipActive,
                            ]}
                            onPress={() => {
                              setDiaryPhaseInput(template);
                              if (!diaryDraft) return;
                              diaryStore
                                .updateDiaryDetails(diaryDraft.diaryId, { phase: template })
                                .catch((err) =>
                                  setError(err instanceof Error ? err.message : 'Failed to save diary phase')
                                );
                            }}
                          >
                            <Text
                              style={[
                                styles.phaseTemplateChipText,
                                diaryPhaseInput.trim().toLowerCase().startsWith(template.toLowerCase()) &&
                                  styles.phaseTemplateChipTextActive,
                              ]}
                            >
                              {template}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
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
              </>
            )}
            <View style={styles.profileTabs}>
              <Pressable
                style={[
                  styles.profileTab,
                  hoveredProfileTab === 'diary' && styles.profileTabHover,
                  profileTab === 'diary' && styles.profileTabActive,
                ]}
                onPress={() => setProfileTab('diary')}
                onHoverIn={() => setHoveredProfileTab('diary')}
                onHoverOut={() => setHoveredProfileTab((prev) => (prev === 'diary' ? null : prev))}
              >
                <Text style={[styles.profileTabText, profileTab === 'diary' && styles.profileTabTextActive]}>Diary</Text>
                <View
                  style={[
                    styles.profileTabUnderline,
                    profileTab === 'diary' && styles.profileTabUnderlineActive,
                  ]}
                />
              </Pressable>
              <Pressable
                style={[
                  styles.profileTab,
                  hoveredProfileTab === 'all' && styles.profileTabHover,
                  profileTab === 'all' && styles.profileTabActive,
                ]}
                onPress={() => setProfileTab('all')}
                onHoverIn={() => setHoveredProfileTab('all')}
                onHoverOut={() => setHoveredProfileTab((prev) => (prev === 'all' ? null : prev))}
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
              </Pressable>
            </View>
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

            {!diaryLoading && profileDiaries.length === 0 && (
              <View style={styles.emptyDiaryState}>
                <Text style={styles.emptyDiaryTitle}>Start your grow diary</Text>
                <Text style={styles.emptyDiarySubtitle}>
                  Pick posts from your feed and organize them by week.
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => {
                    handleCreateDiary().catch((err) => {
                      setError(err instanceof Error ? err.message : 'Failed to create diary');
                    });
                  }}
                  disabled={!authState.isLoggedIn || authState.isReadOnly}
                >
                  <Text style={styles.buttonText}>Create diary</Text>
                </TouchableOpacity>
              </View>
            )}

            {profileDiaries.length > 0 && (
              <View style={styles.diaryTilesGrid}>
                {profileDiaries.map((diary) => {
                  const imageUri = getDiaryCoverForCard(diary);
                  const updatedAtTs = diary.updatedAt || diary.createdAt;

                  return (
                    <Pressable
                      key={diary.id}
                      style={({ hovered, pressed }) => [
                        styles.diaryTileCard,
                        !isMobile && styles.diaryTileCardDesktop,
                        isMobile && styles.diaryTileCardMobile,
                        (hovered || pressed) && styles.diaryTileCardHover,
                      ]}
                      onPress={() => {
                        router.push(`/diary/${encodeURIComponent(diary.id)}` as Href);
                      }}
                    >
                      {imageUri ? (
                        <View style={styles.diaryTileImageWrap}>
                          <Image
                            source={{ uri: imageUri }}
                            style={styles.diaryTileImage}
                            resizeMode={getDiaryTileResizeMode(diary.id)}
                            onLoad={(evt) => {
                              const source = evt.nativeEvent?.source;
                              if (!source?.width || !source?.height) return;
                              const aspect = source.width / source.height;
                              setDiaryTileAspectById((prev) => {
                                if (prev[diary.id] === aspect) return prev;
                                return { ...prev, [diary.id]: aspect };
                              });
                            }}
                          />
                          <View pointerEvents="none" style={styles.diaryTileImageShade} />
                          {diary.coverImage ? (
                            <View style={styles.diaryTileCoverBadge}>
                              <Text style={styles.diaryTileCoverBadgeText}>Cover</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <View style={styles.diaryTileImageFallback}>
                          <Text style={styles.diaryTileImageFallbackText}>No image</Text>
                        </View>
                      )}
                      <View style={styles.diaryTileMeta}>
                        <Text style={styles.diaryTileTitle}>{diary.title || 'Untitled diary'}</Text>
                        <Text style={styles.diaryTileSub}>
                          {(diary.plant || 'Plant n/a')} • {(diary.phase || 'Phase n/a')}
                        </Text>
                        <Text style={styles.diaryTileDate}>
                          {diary.items.length} entries • {new Date(updatedAtTs * 1000).toLocaleDateString()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
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
                  loadAuthorPosts().catch((err) => {
                    setError(err instanceof Error ? err.message : 'Failed to load profile posts');
                  });
                }}
              >
                <Text style={styles.buttonText}>Reload</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.feedFilterCard}>
              <View style={styles.feedFilterHeader}>
                <Text style={styles.feedFilterTitle}>Profile hashtag filter</Text>
                <TouchableOpacity
                  style={[styles.filterToggleBtn, !profileHashtagFilterEnabled && styles.filterToggleBtnMuted]}
                  onPress={() => setProfileHashtagFilterEnabled((prev) => !prev)}
                >
                  <Text style={styles.filterToggleBtnText}>
                    {profileHashtagFilterEnabled ? 'Filter ON' : 'Filter OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
              {profileHashtagFilterEnabled ? (
                <>
                  <View style={styles.hashtagContainer}>
                    {profileHashtags.map((tag) => (
                      <View key={tag} style={styles.hashtagBadge}>
                        <Text style={styles.hashtagText}>#{tag}</Text>
                        <TouchableOpacity onPress={() => handleRemoveProfileHashtag(tag)}>
                          <Text style={styles.removeBtn}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, styles.flexInput]}
                      placeholder="Filter by hashtag"
                      placeholderTextColor="#999"
                      value={newProfileHashtag}
                      onChangeText={setNewProfileHashtag}
                    />
                    <TouchableOpacity style={styles.smallButton} onPress={handleAddProfileHashtag}>
                      <Text style={styles.buttonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.signerHint}>Show all posts without hashtag filter.</Text>
              )}
            </View>
            {profileLoading && (
              <View style={styles.centerContent}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.loadingText}>Loading profile posts...</Text>
              </View>
            )}
            {!profileLoading && visibleProfilePosts.length === 0 && (
              <Text style={styles.emptyText}>No profile posts found.</Text>
            )}
            {visibleProfilePosts.map((post) => (
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
              disabled={diaryPublishing || isReadOnlyBlocked}
            >
              <Text style={styles.buttonText}>
                {isReadOnlyBlocked ? 'Publish blocked (read-only)' : diaryPublishing ? 'Publishing...' : 'Publish changes'}
              </Text>
            </TouchableOpacity>
          </View>
          {readOnlyBlockHint && (
            <Text style={styles.readOnlyGuardHint}>{readOnlyBlockHint}</Text>
          )}
        </View>
      )}
    </View>
  );

  const renderSettingsPage = () => (
    <ScrollView style={styles.pageContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
      <View style={styles.settingsHeaderRow}>
        <Text style={styles.panelTitle}>Settings</Text>
        <Text style={styles.statusText}>
          {settingsSection === 'authentication' && 'Authentication'}
          {settingsSection === 'relays' && 'Relays'}
          {settingsSection === 'hashtags' && 'Hashtags'}
          {settingsSection === 'growmies' && 'Growmies'}
        </Text>
      </View>
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

      {settingsSection === 'authentication' && (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Authentication</Text>

        {authState.isLoggedIn ? (
          <View>
            <Text style={styles.statusText}>
              Logged in as {authState.isReadOnly ? '(read-only)' : '(full access)'}
            </Text>
            {authState.method === 'signer' && (
              <Text style={styles.signerHint}>
                Connected via signer: {authState.signerKind?.toUpperCase() || 'UNKNOWN'}.
              </Text>
            )}
            {authState.method === 'signer' && (
              <Text style={styles.signerHint}>
                Session status: {authManager.getSignerSessionStatus()}
              </Text>
            )}
            {authState.method === 'signer' && authState.signerKind === 'nip46' && (
              <View style={styles.nip46StatusRow}>
                <Text style={styles.signerHint}>NIP-46 pairing: {nip46PhaseLabel}</Text>
                <TouchableOpacity style={styles.smallButton} onPress={handleRefreshNip46Pairing}>
                  <Text style={styles.buttonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.pubkeyText}>{authState.pubkey?.substring(0, 16)}...</Text>
            {authState.method === 'signer' && authState.signerKind === 'nip46' && (
              <TouchableOpacity style={styles.buttonSecondary} onPress={handleDisconnectNip46}>
                <Text style={styles.buttonText}>Disconnect NIP-46</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.button} onPress={handleLogout}>
              <Text style={styles.buttonText}>Logout & Browse Anonymous</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {anonymousBrowsingEnabled && (
              <Text style={styles.signerHint}>
                Anonymous mode active: feed browsing is enabled without login.
              </Text>
            )}
            {runtimeMode === 'web' ? (
              <View>
                <Text style={styles.statusText}>Web mode prefers browser signer auth.</Text>
                <TouchableOpacity style={styles.button} onPress={handleConnectSigner}>
                  <Text style={styles.buttonText}>Connect Signer (NIP-07/NIP-46)</Text>
                </TouchableOpacity>
                {nip46Available && (
                  <TouchableOpacity style={styles.buttonSecondary} onPress={handleConnectNip46}>
                    <Text style={styles.buttonText}>Connect NIP-46 Session</Text>
                  </TouchableOpacity>
                )}
                {!signerAvailable && !nip46Available && (
                  <Text style={styles.signerHint}>
                    No signer found. App stays in read-only mode until NIP-07 or NIP-46 is connected.
                  </Text>
                )}
                {(signerAvailable || nip46Available) && (
                  <Text style={styles.signerHint}>
                    Signer available: {signerAvailable ? 'NIP-07' : 'NIP-46'}
                  </Text>
                )}
                {nip46BridgePresent && (
                  <View style={styles.nip46PairingCard}>
                    <Text style={styles.nip46PairingTitle}>NIP-46 Pairing</Text>
                    <Text style={styles.signerHint}>Status: {nip46PhaseLabel}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Paste bunker:// URI or pairing code (optional)"
                      placeholderTextColor="#999"
                      value={nip46PairingInput}
                      onChangeText={setNip46PairingInput}
                    />
                    <View style={styles.nip46PairingActions}>
                      <TouchableOpacity
                        style={styles.buttonSecondary}
                        onPress={handleStartNip46Pairing}
                        disabled={nip46PairingBusy}
                      >
                        <Text style={styles.buttonText}>
                          {nip46PairingBusy ? 'Pairing...' : 'Start Pairing'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={handleRefreshNip46Pairing}
                        disabled={nip46PairingBusy}
                      >
                        <Text style={styles.buttonText}>Refresh</Text>
                      </TouchableOpacity>
                    </View>
                    {nip46PairingState.phase === 'pairing' && (
                      <TouchableOpacity
                        style={styles.buttonSecondary}
                        onPress={handleApproveNip46Pairing}
                        disabled={nip46PairingBusy}
                      >
                        <Text style={styles.buttonText}>
                          {nip46PairingBusy ? 'Approving...' : 'Approve Pairing'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {!!nip46PairingState.connectionUri && (
                      <Text style={styles.nip46PairingMono}>{nip46PairingState.connectionUri}</Text>
                    )}
                    {!!nip46PairingState.code && (
                      <Text style={styles.nip46PairingMono}>Code: {nip46PairingState.code}</Text>
                    )}
                    {!!nip46PairingState.message && (
                      <Text style={styles.signerHint}>{nip46PairingState.message}</Text>
                    )}
                  </View>
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
                <TouchableOpacity style={styles.buttonSecondary} onPress={enableAnonymousBrowsing}>
                  <Text style={styles.buttonText}>Browse as Anonymous</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TouchableOpacity style={styles.button} onPress={handleConnectSigner}>
                  <Text style={styles.buttonText}>Login with Signer (NIP-07/NIP-46)</Text>
                </TouchableOpacity>
                <Text style={styles.signerHint}>
                  Primary path: signer-first auth.
                </Text>
                <Text style={styles.signerHint}>
                  Secondary path: local signer via nsec. Read-only path: npub.
                </Text>

                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, activeAuthTab === 'nsec' && styles.activeTab]}
                    onPress={() => setActiveAuthTab('nsec')}
                  >
                    <Text style={[styles.tabText, activeAuthTab === 'nsec' && styles.activeTabText]}>
                      Local signer (nsec)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeAuthTab === 'npub' && styles.activeTab]}
                    onPress={() => setActiveAuthTab('npub')}
                  >
                    <Text style={[styles.tabText, activeAuthTab === 'npub' && styles.activeTabText]}>
                      Read-only (npub)
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

                <TouchableOpacity style={styles.buttonSecondary} onPress={handleLogin}>
                  <Text style={styles.buttonText}>
                    {activeAuthTab === 'nsec' ? 'Login with Local Signer' : 'Continue Read-only'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.buttonSecondary} onPress={enableAnonymousBrowsing}>
                  <Text style={styles.buttonText}>Browse as Anonymous</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
      )}

      {settingsSection === 'relays' && (
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
      )}

      {settingsSection === 'relays' && (
      <SmartRelayPanel
        allowBackgroundProbe={authState.isLoggedIn}
        onSelectionChanged={() => {
          setRelayUrls(relayManager.getEnabledUrls());
        }}
      />
      )}

      {settingsSection === 'hashtags' && (
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
      )}

      {!features.allowFileSystem && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Native-only features are hidden in web mode.</Text>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Credits</Text>
        <Text style={styles.statusText}>Credits: Wondrej D. Grower & LLM's</Text>
      </View>

      {settingsSection === 'growmies' && (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>🧑‍🌾⚙️ Growmies Settings</Text>
        <Text style={styles.statusText}>Manage your Growmies list and filtering behavior.</Text>
        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={() => {
            growmiesStore
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
            growmiesStore
              .sync(authState, relayUrls)
              .then(() => hydrateGrowmiesState())
              .catch((err) => setError(err instanceof Error ? err.message : 'Growmies sync failed'));
          }}
          disabled={isReadOnlyBlocked}
        >
          <Text style={styles.buttonText}>
            {isReadOnlyBlocked ? 'Sync blocked (read-only)' : 'Sync Growmies to Nostr'}
          </Text>
        </TouchableOpacity>
        {readOnlyBlockHint && <Text style={styles.readOnlyGuardHint}>{readOnlyBlockHint}</Text>}
      </View>
      )}

      {settingsSection === 'growmies' && (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>🧑‍🌾 Growmies Members ({growmies.length})</Text>
        {growmies.length === 0 && <Text style={styles.emptyText}>No Growmies yet. Add from feed cards.</Text>}
        {growmies.map((pubkey) => (
          <View key={pubkey} style={styles.relayItem}>
            <Text style={styles.relayUrl}>{feedAuthorNames[pubkey] || pubkey}</Text>
            <TouchableOpacity
              onPress={() => {
                growmiesStore
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
      )}

      <DiagnosticsPanel />
      </View>
    </ScrollView>
  );

  const renderGrowmiesPage = () => (
    <ScrollView style={styles.pageContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
        <View style={styles.panel}>
          <View style={styles.feedHeader}>
            <Text style={styles.panelTitle}>Growmies Feed</Text>
            <TouchableOpacity style={styles.smallButton} onPress={handleRefresh}>
              <Text style={styles.buttonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.statusText}>Posts only from authors in your Growmies list.</Text>
          {growmies.length === 0 && (
            <Text style={styles.emptyText}>No Growmies added yet. Add people from Feed and they will appear here.</Text>
          )}
        </View>

        {growmiesFeedEvents.map((event) => renderFeedEventCard(event, false))}

        {growmies.length > 0 && !isLoading && growmiesFeedEvents.length === 0 && (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>No posts from your Growmies yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderBottomNav = () => (
    <View style={styles.bottomNavWrap} pointerEvents="box-none">
      <View style={styles.bottomNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Feed"
          style={({ pressed, hovered }) => [
            styles.bottomNavItem,
            activePage === 'feed' && styles.bottomNavItemActive,
            (pressed || hovered) && styles.bottomNavItemHover,
          ]}
          onPress={() => setActivePage('feed')}
        >
          <Text style={[styles.bottomNavText, activePage === 'feed' && styles.bottomNavTextActive]}>Feed</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={({ pressed, hovered }) => [
            styles.bottomNavProfileItem,
            activePage === 'profile' && styles.bottomNavProfileItemActive,
            (pressed || hovered) && styles.bottomNavProfileItemHover,
          ]}
          onPress={() => setActivePage('profile')}
        >
          {profileMetadata?.picture ? (
            <Image
              source={{ uri: profileMetadata.picture }}
              style={styles.bottomNavProfileImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.bottomNavProfileFallback}>
              <Text style={styles.bottomNavProfileText}>{getAvatarLabel(authState, profileMetadata).slice(0, 2)}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Growmies"
          style={({ pressed, hovered }) => [
            styles.bottomNavItem,
            activePage === 'growmies' && styles.bottomNavItemActive,
            (pressed || hovered) && styles.bottomNavItemHover,
          ]}
          onPress={() => setActivePage('growmies')}
        >
          <Text style={[styles.bottomNavText, activePage === 'growmies' && styles.bottomNavTextActive]}>Growmies</Text>
        </Pressable>
      </View>
    </View>
  );

  const openSettingsSection = (section: SettingsSection) => {
    setSettingsSection(section);
    setSettingsMenuOpen(false);
    setActivePage('settings');
  };

  const isSettingsItemActive = (item: 'profile' | 'diary' | SettingsSection): boolean => {
    if (item === 'profile') {
      return activePage === 'profile';
    }
    if (item === 'diary') {
      return activePage === 'profile' && profileTab === 'diary';
    }
    return activePage === 'settings' && settingsSection === item;
  };

  const renderFloatingSettingsMenu = () => (
    <View style={styles.settingsMenuWrap} pointerEvents="box-none">
      {settingsMenuOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings menu"
          onPress={() => setSettingsMenuOpen(false)}
          style={styles.settingsMenuBackdrop}
        />
      )}
      <View style={styles.settingsMenuAnchor}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed, hovered }) => [
            styles.settingsFloatingButton,
            (pressed || hovered || settingsMenuOpen) && styles.settingsFloatingButtonActive,
          ]}
          onPress={() => setSettingsMenuOpen((prev) => !prev)}
        >
          <Text style={styles.settingsFloatingButtonIcon}>⚙</Text>
        </Pressable>
        <Animated.View
          pointerEvents={settingsMenuOpen ? 'auto' : 'none'}
          style={[
            styles.settingsMenuDropdown,
            {
              opacity: settingsMenuAnim,
              transform: [
                {
                  translateY: settingsMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {settingsMenuOpen && (
            <>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                isSettingsItemActive('profile') && styles.settingsMenuItemActive,
              ]}
              onPress={() => {
                setSettingsMenuOpen(false);
                setActivePage('profile');
              }}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  isSettingsItemActive('profile') && styles.settingsMenuItemTextActive,
                ]}
              >
                Profile settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                isSettingsItemActive('diary') && styles.settingsMenuItemActive,
              ]}
              onPress={() => {
                setSettingsMenuOpen(false);
                setActivePage('profile');
                setProfileTab('diary');
              }}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  isSettingsItemActive('diary') && styles.settingsMenuItemTextActive,
                ]}
              >
                Diaries settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                isSettingsItemActive('growmies') && styles.settingsMenuItemActive,
              ]}
              onPress={() => openSettingsSection('growmies')}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  isSettingsItemActive('growmies') && styles.settingsMenuItemTextActive,
                ]}
              >
                Growmies settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                isSettingsItemActive('relays') && styles.settingsMenuItemActive,
              ]}
              onPress={() => openSettingsSection('relays')}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  isSettingsItemActive('relays') && styles.settingsMenuItemTextActive,
                ]}
              >
                Relay settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                styles.settingsMenuItemLast,
                isSettingsItemActive('hashtags') && styles.settingsMenuItemActive,
              ]}
              onPress={() => openSettingsSection('hashtags')}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  isSettingsItemActive('hashtags') && styles.settingsMenuItemTextActive,
                ]}
              >
                Hashtag settings
              </Text>
            </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );

  const renderFloatingLoginPrompt = () => {
    if (!loginPromptLoaded || loginPromptDismissed || authState.isLoggedIn) return null;
    return (
      <View style={styles.loginPromptWrap} pointerEvents="box-none">
        {loginPromptMenuOpen && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close login menu"
            onPress={() => setLoginPromptMenuOpen(false)}
            style={styles.loginPromptBackdrop}
          />
        )}
        <View style={styles.loginPromptAnchor}>
          <TouchableOpacity
            style={styles.loginPromptButton}
            onPress={() => setLoginPromptMenuOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Login"
          >
            <Text style={styles.loginPromptButtonText}>Login</Text>
          </TouchableOpacity>
          {loginPromptMenuOpen && (
            <View style={styles.loginPromptMenu}>
              <TouchableOpacity
                style={styles.loginPromptMenuItem}
                onPress={() => {
                  setLoginPromptMenuOpen(false);
                  handleConnectSigner().catch((err) => {
                    setError(err instanceof Error ? err.message : 'Failed to connect signer');
                  });
                }}
              >
                <Text style={styles.loginPromptMenuItemText}>Login with Alby</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.loginPromptMenuItem, styles.loginPromptMenuItemLast]}
                onPress={() => {
                  enableAnonymousBrowsing().catch(() => {
                    // best-effort persistence only
                  });
                }}
              >
                <Text style={styles.loginPromptMenuItemText}>Continue as anon</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
      {renderFloatingLoginPrompt()}
      {renderFloatingSettingsMenu()}
      {renderBottomNav()}

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
                  handleConfirmAddToDiary().catch((err) => {
                    setError(err instanceof Error ? err.message : 'Failed to add post to diary');
                  });
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
    backgroundColor: '#f2f1eb',
  },
  pageContainer: {
    flex: 1,
    paddingBottom: 92,
  },
  pageInner: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
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
    backgroundColor: '#fffdf8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2d5b8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  settingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
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
  feedAuthorAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f5d35',
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
  timestamp: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 3,
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
  profileHeaderCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 14,
    paddingBottom: 14,
    marginBottom: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e1d1ae',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  profileHeaderCardMobile: {
    marginTop: 6,
    borderRadius: 12,
  },
  profileBannerWrap: {
    width: '100%',
    height: 244,
    overflow: 'hidden',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  profileBannerWrapMobile: {
    height: 192,
  },
  profileBannerImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#d1d5db',
  },
  profileBannerOverlayTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  profileBannerOverlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  profileHeaderContent: {
    marginTop: -36,
    paddingHorizontal: 18,
    paddingTop: 0,
  },
  profileHeaderContentMobile: {
    marginTop: -24,
    paddingHorizontal: 12,
  },
  brandPlaqueInline: {
    alignSelf: 'flex-start',
    marginLeft: 2,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  brandPlaqueInlineMobile: {
    marginLeft: 8,
  },
  brandPlaqueImage: {
    width: 286,
    height: 124,
    borderRadius: 16,
    opacity: 0.9,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  profileHeaderRowMobile: {
    gap: 10,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#fffef9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarCircleMobile: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  avatarLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#047857',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarImageMobile: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  profileMeta: {
    flex: 1,
    paddingTop: 10,
    backgroundColor: '#fffdf7',
    borderWidth: 1,
    borderColor: '#dfcfa9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  profileName: {
    fontSize: 38,
    fontWeight: '700',
    color: '#1b4d2f',
    flexShrink: 1,
  },
  profileNameMobile: {
    fontSize: 30,
  },
  profilePubkey: {
    fontSize: 11,
    color: '#947848',
    opacity: 0.9,
    marginTop: 4,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  profileBio: {
    fontSize: 16,
    lineHeight: 26,
    color: '#304335',
    marginTop: 14,
  },
  profileStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  profileQuickActions: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  profileStatPill: {
    borderWidth: 1,
    borderColor: '#d7be86',
    backgroundColor: '#fbf7ee',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 88,
  },
  profileStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2a6a3c',
  },
  profileStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#967a47',
    marginTop: 2,
  },
  profileStatActionPill: {
    borderWidth: 1,
    borderColor: '#7cb08a',
    backgroundColor: '#2e7044',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileStatActionPillDisabled: {
    opacity: 0.6,
  },
  profileStatActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f5fff8',
  },
  diaryHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
    marginBottom: 8,
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
  diaryDetailsWrap: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  diaryDetailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  diaryDetailField: {
    marginBottom: 8,
    flex: 1,
  },
  diaryDetailFieldHalf: {
    minWidth: 0,
  },
  diaryDetailLabel: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '600',
    marginBottom: 5,
  },
  diaryDetailInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  plantActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  plantMoreWrap: {
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#f9fafb',
  },
  phaseTemplatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  phaseTemplateChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  phaseTemplateChipActive: {
    borderColor: '#16a34a',
    backgroundColor: '#dcfce7',
  },
  phaseTemplateChipText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  phaseTemplateChipTextActive: {
    color: '#14532d',
  },
  profileTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 0,
    gap: 8,
  },
  profileTab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 0,
  },
  profileTabActive: {
    backgroundColor: '#edf2e8',
  },
  profileTabHover: {
    backgroundColor: '#f3f4f6',
  },
  profileTabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  profileTabTextActive: {
    color: '#235a37',
    fontWeight: '600',
  },
  profileTabUnderline: {
    marginTop: 8,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  profileTabUnderlineActive: {
    backgroundColor: '#b38a3f',
  },
  emptyDiaryState: {
    backgroundColor: '#fffdf9',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2d6be',
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
  diaryCard: {
    backgroundColor: '#fffefb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#e2d7c2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  diaryTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  diaryTileCard: {
    backgroundColor: '#fffefb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1d5bc',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  diaryTileCardDesktop: {
    width: '32.5%',
  },
  diaryTileCardMobile: {
    width: '48.5%',
  },
  diaryTileCardHover: {
    borderColor: '#86efac',
    shadowOpacity: 0.12,
    shadowRadius: 9,
    elevation: 3,
    transform: [{ translateY: -1 }],
  },
  diaryTileImageWrap: {
    position: 'relative',
  },
  diaryTileImage: {
    width: '100%',
    height: 190,
    backgroundColor: '#1f2e22',
  },
  diaryTileImageShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 62,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  diaryTileCoverBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(5,150,105,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  diaryTileCoverBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  diaryTileImageFallback: {
    width: '100%',
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  diaryTileImageFallbackText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  diaryTileMeta: {
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  diaryTileTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  diaryTileSub: {
    marginTop: 3,
    fontSize: 12,
    color: '#2b6a3c',
    fontWeight: '600',
  },
  diaryTileDate: {
    marginTop: 5,
    fontSize: 11,
    color: '#6b7280',
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 76,
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
    borderColor: '#dacdb3',
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
    backgroundColor: '#2f6b3f',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  smallButton: {
    backgroundColor: '#2f6b3f',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#2f6b3f',
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
    borderColor: '#d5bf8f',
    backgroundColor: '#f7f2e7',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addToDiaryMiniText: {
    color: '#2f6b3f',
    fontSize: 12,
    fontWeight: '600',
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
    borderColor: '#2f6b3f',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#2f6b3f',
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
    backgroundColor: '#ebf2e5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  hashtagText: {
    fontSize: 13,
    color: '#2f6b3f',
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
  feedFilterCard: {
    borderWidth: 1,
    borderColor: '#d9c89e',
    borderRadius: 10,
    backgroundColor: '#f8f4eb',
    padding: 10,
    marginBottom: 12,
  },
  feedFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  feedFilterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2f6b3f',
  },
  filterToggleBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2f6b3f',
    backgroundColor: '#e4efdf',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterToggleBtnMuted: {
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
  },
  filterToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2f6b3f',
  },
  readOnlyGuardHint: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 8,
  },
  nip46StatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  nip46PairingCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  nip46PairingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 6,
  },
  nip46PairingActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  nip46PairingMono: {
    fontSize: 11,
    color: '#334155',
    fontFamily: 'monospace',
    marginBottom: 6,
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
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomNav: {
    width: '100%',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#fffdf8',
    borderTopWidth: 1,
    borderTopColor: '#dfcfad',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomNavItem: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bottomNavItemActive: {
    backgroundColor: '#edf2e8',
    borderColor: '#d9c593',
  },
  bottomNavItemHover: {
    backgroundColor: '#f3f4f6',
  },
  bottomNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  bottomNavTextActive: {
    color: '#2f6b3f',
  },
  bottomNavProfileItem: {
    width: 74,
    height: 74,
    borderRadius: 37,
    marginTop: -30,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7cff9e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 9,
  },
  bottomNavProfileItemActive: {
    borderColor: '#7cff9e',
    backgroundColor: '#f6f1e5',
    shadowColor: '#7cff9e',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  bottomNavProfileItemHover: {
    backgroundColor: '#f3f4f6',
  },
  bottomNavProfileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  bottomNavProfileFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavProfileText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
  },
  settingsMenuWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  settingsMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.14)',
  },
  settingsMenuAnchor: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
  },
  settingsFloatingButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  settingsFloatingButtonActive: {
    backgroundColor: '#f3f4f6',
  },
  settingsFloatingButtonIcon: {
    fontSize: 20,
    color: '#374151',
  },
  settingsMenuDropdown: {
    marginTop: 8,
    minWidth: 210,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  settingsMenuItem: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingsMenuItemLast: {
    borderBottomWidth: 0,
  },
  settingsMenuItemActive: {
    backgroundColor: '#ecfdf5',
  },
  settingsMenuItemText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  settingsMenuItemTextActive: {
    color: '#047857',
  },
  loginPromptWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 41,
  },
  loginPromptBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.08)',
  },
  loginPromptAnchor: {
    position: 'absolute',
    top: 12,
    left: 12,
    alignItems: 'flex-start',
  },
  loginPromptButton: {
    borderRadius: 999,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  loginPromptButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  loginPromptMenu: {
    marginTop: 8,
    minWidth: 190,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  loginPromptMenuItem: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0fdf4',
  },
  loginPromptMenuItemLast: {
    borderBottomWidth: 0,
  },
  loginPromptMenuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
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
