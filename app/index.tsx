import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import {
  View,
  Text,
  Alert,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  SafeAreaView,
  StyleSheet,
  Linking,
  Image,
  Modal,
  useWindowDimensions,
  Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Event as NostrRawEvent } from 'nostr-tools';
import { nostrClient } from '../src/lib/nostrClient';
import { authManager } from '../src/lib/authManager';
import { relayManager } from '../src/lib/relayManager';
import type { NostrProfileMetadata } from '../src/lib/nostrClient';
import type { AuthState } from '../src/lib/authManager';
import { getRuntimeMode } from '../src/runtime/mode';
import { getFeatures } from '../src/runtime/features';
import {
  defaultDiaryId,
  type DiaryIndex,
} from '../src/lib/diaryManager';
import { diaryStore, type Diary, type DiaryDetailsInput } from '../src/lib/diaryStore';
import { growmiesStore } from '../src/lib/growmiesStore';
import { DEFAULT_HASHTAGS } from '../src/features/home/constants';
import {
  getAvatarLabel,
  shortPubkey,
} from '../src/features/home/profileHelpers';
import { useFeedController } from '../src/features/feed/useFeedController';
import { assertNoSensitiveMaterial } from '../src/lib/securityBaseline';
import { getAllHashtags } from '../src/lib/eventFilter';
import { setJson } from '../src/lib/persistentStorage';
import { extractMediaFromContent } from '../src/lib/mediaExtraction';
import { normalizePlantDTagSlug } from '../src/lib/plants/catalog';
import type { PlantSelection } from '../src/lib/plants/types';
import { FeedPage } from '../src/features/home/components/FeedPage';
import { GrowmiesPage } from '../src/features/home/components/GrowmiesPage';
import { SettingsPage } from '../src/features/home/components/SettingsPage';
import { ProfilePage } from '../src/features/home/components/ProfilePage';
import { useHomeShellState, type SettingsSection } from '../src/features/home/hooks/useHomeShellState';
import { useAuthActions } from '../src/features/home/hooks/useAuthActions';
import { useFeedSettingsActions } from '../src/features/home/hooks/useFeedSettingsActions';
import { useHomeDataSync } from '../src/features/home/hooks/useHomeDataSync';
import { useFeedAuthorNames } from '../src/features/home/hooks/useFeedAuthorNames';
import {
  buildFeedSearchSuggestions,
  eventMatchesFeedQuery,
  splitFeedQueryTerms,
} from '../src/features/home/feedSearch';
import { FeedEventCard } from '../src/features/home/components/FeedEventCard';

const runtimeMode = getRuntimeMode();
const features = getFeatures(runtimeMode);

type ProfileTab = 'diary' | 'all';
const LOGIN_PROMPT_DISMISSED_KEY = 'login_prompt_dismissed_v1';
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
  const [authState, setAuthState] = useState<AuthState>(authManager.getState());
  const {
    activePage,
    setActivePage,
    settingsMenuOpen,
    setSettingsMenuOpen,
    settingsSection,
    setSettingsSection,
    loginPromptDismissed,
    setLoginPromptDismissed,
    loginPromptLoaded,
    loginPromptMenuOpen,
    setLoginPromptMenuOpen,
    anonymousBrowsingEnabled,
    themeMode,
    toggleThemeMode,
    settingsMenuAnim,
    signerAvailable,
    nip46Available,
    nip46BridgePresent,
    nip46PairingState,
    setNip46PairingState,
    nip46PairingInput,
    setNip46PairingInput,
    nip46PairingBusy,
    setNip46PairingBusy,
    enableAnonymousBrowsing,
    disableAnonymousBrowsing,
    refreshSignerAvailability,
    refreshNip46PairingState,
    resetLoginPromptDismissed,
  } = useHomeShellState({ isLoggedIn: authState.isLoggedIn });
  const [profileTab, setProfileTab] = useState<ProfileTab>('diary');
  const [hoveredProfileTab, setHoveredProfileTab] = useState<ProfileTab | null>(null);

  const [relayUrls, setRelayUrls] = useState<string[]>(relayManager.getEnabledUrls());
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS);
  const [feedFilterEnabled, setFeedFilterEnabled] = useState(true);
  const [feedSearchInput, setFeedSearchInput] = useState('');
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [newRelay, setNewRelay] = useState('');
  const [newHashtag, setNewHashtag] = useState('');
  const [nsecInput, setNsecInput] = useState('');
  const [npubInput, setNpubInput] = useState('');
  const [activeAuthTab, setActiveAuthTab] = useState<'nsec' | 'npub'>(
    features.allowNsecLogin ? 'nsec' : 'npub'
  );

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
  const [npubCopied, setNpubCopied] = useState(false);
  const [profileHashtagFilterEnabled, setProfileHashtagFilterEnabled] = useState(false);
  const [profileHashtags, setProfileHashtags] = useState<string[]>([]);
  const [newProfileHashtag, setNewProfileHashtag] = useState('');
  const [diaryTileAspectById, setDiaryTileAspectById] = useState<Record<string, number>>({});
  const {
    events,
    isLoading,
    isFetchingMore,
    subscribeFeed,
    refresh: refreshFeed,
    loadMore,
  } = useFeedController({
    relayUrls,
    hashtags,
    filterEnabled: feedFilterEnabled,
    searchQuery: feedSearchQuery,
    onError: setError,
  });
  const feedAuthorNames = useFeedAuthorNames(events, relayUrls);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFeedSearchQuery(feedSearchInput.trim());
    }, 180);
    return () => clearTimeout(timeout);
  }, [feedSearchInput]);

  const {
    setErrorFromUnknown,
    hydrateDiaryStateFromStore,
    hydrateGrowmiesState,
    loadDiary,
    loadAuthorPosts,
    bootstrapLoggedInSession,
  } = useHomeDataSync({
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
  });

  const {
    handleLogin,
    handleConnectSigner,
    handleConnectNip46,
    handleDisconnectNip46,
    handleStartNip46Pairing,
    handleApproveNip46Pairing,
    handleRefreshNip46Pairing,
    handleLogout,
  } = useAuthActions({
    activeAuthTab,
    nsecInput,
    npubInput,
    allowNsecLogin: features.allowNsecLogin,
    nip46PairingInput,
    setAuthState,
    setNsecInput,
    setNpubInput,
    setError,
    setErrorFromUnknown,
    setDiaryEditMode,
    setProfileMetadata,
    setLastSyncedPubkey,
    setNip46PairingBusy,
    setNip46PairingState,
    disableAnonymousBrowsing,
    enableAnonymousBrowsing,
    resetLoginPromptDismissed,
    refreshSignerAvailability,
    refreshNip46PairingState,
    bootstrapLoggedInSession,
  });

  const {
    handleToggleRelay,
    handleAddRelay,
    handleRemoveRelay,
    handleAddHashtag,
    handleRemoveHashtag,
    handleResetDefaultHashtags,
    handleAddProfileHashtag,
    handleRemoveProfileHashtag,
    handleRefresh,
  } = useFeedSettingsActions({
    newRelay,
    setNewRelay,
    setRelayUrls,
    newHashtag,
    setNewHashtag,
    hashtags,
    setHashtags,
    setFeedFilterEnabled,
    newProfileHashtag,
    profileHashtags,
    setProfileHashtags,
    setNewProfileHashtag,
    setError,
    refreshFeed,
  });

  const openAddToDiaryModal = useCallback((event: NostrRawEvent) => {
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
  }, [authState.isLoggedIn, authState.pubkey, runOptions, setActivePage]);

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

  const handleAddToGrowmies = useCallback(async (authorPubkey: string) => {
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
  }, [authState.pubkey, hydrateGrowmiesState]);

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
      await diaryStore.updateDiaryDetails(diaryDraft.diaryId, collectDiaryDetailsInput());
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
      setErrorFromUnknown(err, 'Failed to publish diary changes');
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
      ...collectDiaryDetailsInput(),
      title: undefined,
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
      setErrorFromUnknown(err, 'Failed to load selected run');
    });
  };

  const handleRenameRun = useCallback(async (run: DiaryRunOption) => {
    const promptFn = (globalThis as { prompt?: (message?: string, defaultValue?: string) => string | null }).prompt;
    if (typeof promptFn !== 'function') {
      setError('Rename prompt is not available on this device.');
      return;
    }
    const nextTitle = promptFn('Rename diary', run.title);
    if (nextTitle === null) return;

    const normalized = nextTitle.trim();
    if (!normalized) {
      setError('Diary name cannot be empty.');
      return;
    }

    try {
      await diaryStore.renameDiary(run.diaryId, normalized);
      await hydrateDiaryStateFromStore(run.diaryId);
      setError(null);
    } catch (err) {
      setErrorFromUnknown(err, 'Failed to rename diary');
    }
  }, [hydrateDiaryStateFromStore, setErrorFromUnknown]);

  const handleDeleteRun = useCallback((run: DiaryRunOption) => {
    Alert.alert(
      'Delete diary',
      `Do you really want to delete "${run.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            diaryStore
              .deleteDiary(run.diaryId)
              .then(() => hydrateDiaryStateFromStore())
              .catch((err) => {
                setErrorFromUnknown(err, 'Failed to delete diary');
              });
          },
        },
      ]
    );
  }, [hydrateDiaryStateFromStore, setErrorFromUnknown]);

  const handleOpenApp = async () => {
    try {
      await Linking.openURL('weedoshi://');
    } catch {
      setError('Could not open app deep link. Install the app and try again.');
    }
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

  const collectDiaryDetailsInput = useCallback((): DiaryDetailsInput => ({
    title: diaryTitleInput,
    plant: diaryPlantInput,
    plantSlug: diaryPlantSlug,
    species: diarySpeciesInput,
    cultivar: diaryCultivarInput,
    breeder: diaryBreederInput,
    plantWikiAPointer: diaryPlantWikiAPointer,
    phase: diaryPhaseInput,
  }), [
    diaryTitleInput,
    diaryPlantInput,
    diaryPlantSlug,
    diarySpeciesInput,
    diaryCultivarInput,
    diaryBreederInput,
    diaryPlantWikiAPointer,
    diaryPhaseInput,
  ]);

  const persistDiaryDetails = useCallback(async () => {
    if (!diaryDraft) return;
    try {
      await diaryStore.updateDiaryDetails(diaryDraft.diaryId, collectDiaryDetailsInput());
    } catch (err) {
      setErrorFromUnknown(err, 'Failed to save diary details');
    }
  }, [
    diaryDraft,
    collectDiaryDetailsInput,
    setErrorFromUnknown,
  ]);

  const feedHashtagsKey = useMemo(() => hashtags.join('|'), [hashtags]);
  useEffect(() => {
    if (relayUrls.length === 0) return;
    refreshFeed();
  }, [feedFilterEnabled, feedHashtagsKey, feedSearchQuery, refreshFeed, relayUrls.length]);

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
  const profileNpub = useMemo(() => {
    if (!authState.pubkey) return '';
    try {
      return nostrClient.pubkeyToNpub(authState.pubkey);
    } catch {
      return '';
    }
  }, [authState.pubkey]);
  const isReadOnlyBlocked = authState.isLoggedIn && authState.isReadOnly;
  const readOnlyBlockHint = isReadOnlyBlocked
    ? 'Read-only mode: connect signer or nsec local signer to publish.'
    : null;

  const visibleFeedEvents = useMemo(() => {
    let filteredEvents = events;
    if (onlyGrowmies) {
      if (growmies.length === 0) {
        return [];
      }
      const allowed = new Set(growmies);
      filteredEvents = filteredEvents.filter((event) => allowed.has(event.author));
    }

    const queryTerms = splitFeedQueryTerms(feedSearchQuery);
    if (queryTerms.length === 0) {
      return filteredEvents;
    }

    return filteredEvents.filter((event) => {
      const authorLabel = feedAuthorNames[event.author] || '';
      return eventMatchesFeedQuery(event, queryTerms, authorLabel);
    });
  }, [events, onlyGrowmies, growmies, feedSearchQuery, feedAuthorNames]);

  const feedSearchSuggestions = useMemo(() => {
    return buildFeedSearchSuggestions(events, feedAuthorNames, feedSearchInput, 8);
  }, [events, feedAuthorNames, feedSearchInput]);

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

  const renderFeedEventCard = useCallback((event: typeof events[number], allowAddToGrowmies: boolean) => {
    return (
      <FeedEventCard
        key={event.id}
        event={event}
        allowAddToGrowmies={allowAddToGrowmies}
        isNight={themeMode === 'night'}
        authState={authState}
        relayUrls={relayUrls}
        feedAuthorNames={feedAuthorNames}
        growmies={growmies}
        onOpenProfile={(pubkey) => router.push(`/profile/${encodeURIComponent(pubkey)}` as Href)}
        onOpenAddToDiary={openAddToDiaryModal}
        onAddToGrowmies={(pubkey) => {
          handleAddToGrowmies(pubkey).catch(() => {
            // handled in callback
          });
        }}
      />
    );
  }, [themeMode, authState, relayUrls, feedAuthorNames, growmies, router, openAddToDiaryModal, handleAddToGrowmies]);

  const renderFeedPage = () => (
    <FeedPage
      isMobile={isMobile}
      isNight={themeMode === 'night'}
      onRefresh={handleRefresh}
      feedSearchInput={feedSearchInput}
      onFeedSearchInputChange={setFeedSearchInput}
      feedSearchSuggestions={feedSearchSuggestions}
      onSelectFeedSuggestion={(value) => {
        setFeedSearchInput(value);
        setFeedSearchQuery(value);
      }}
      feedFilterEnabled={feedFilterEnabled}
      onToggleFeedFilter={() => setFeedFilterEnabled((prev) => !prev)}
      hashtags={hashtags}
      onRemoveHashtag={handleRemoveHashtag}
      newHashtag={newHashtag}
      onNewHashtagChange={setNewHashtag}
      onAddHashtag={handleAddHashtag}
      onResetDefaultHashtags={handleResetDefaultHashtags}
      isLoading={isLoading}
      isFetchingMore={isFetchingMore}
      visibleFeedEvents={visibleFeedEvents}
      relayUrlsCount={relayUrls.length}
      onlyGrowmies={onlyGrowmies}
      feedSearchQuery={feedSearchQuery}
      renderFeedEventCard={renderFeedEventCard}
      onLoadMore={loadMore}
    />
  );

  const renderProfilePage = () => (
    <ProfilePage
      ctx={{
        isNight: themeMode === 'night',
        diaryEditMode,
        isMobile,
        authState,
        profileMetadata,
        setActivePage,
        profilePubkeyText,
        profileNpub,
        npubCopied,
        runOptions,
        handleOpenDiaryEditor,
        handleCopyNpub: async () => {
          if (!profileNpub) return;
          try {
            await Clipboard.setStringAsync(profileNpub);
            setNpubCopied(true);
            setTimeout(() => setNpubCopied(false), 1400);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to copy npub');
          }
        },
        setError,
        setLoginPromptMenuOpen,
        setLoginPromptDismissed,
        LOGIN_PROMPT_DISMISSED_KEY,
        setJson,
        profilePosts,
        growmies,
        nostrSinceLabel,
        handleCancelEdit,
        setRunMenuOpen,
        selectedRunTitle,
        diaryIdInput,
        runMenuOpen,
        diaryTitleInput,
        setDiaryTitleInput,
        persistDiaryDetails,
        diaryPlantSlug,
        diaryPlantInput,
        handlePlantSelection,
        handleOpenPlantDetails,
        setDiaryMoreOpen,
        diaryMoreOpen,
        diaryCultivarInput,
        setDiaryCultivarInput,
        diaryBreederInput,
        setDiaryBreederInput,
        diaryPlantWikiAPointer,
        setDiaryPlantWikiAPointer,
        diaryPhaseInput,
        setDiaryPhaseInput,
        PHASE_TEMPLATE_OPTIONS,
        diaryDraft,
        diaryStore,
        selectedRunSyncStatus,
        handleSelectRun,
        handleRenameRun,
        handleDeleteRun,
        profileTab,
        hoveredProfileTab,
        setHoveredProfileTab,
        setProfileTab,
        diaryLoading,
        profileDiaries,
        handleCreateDiary,
        router,
        getDiaryCoverForCard,
        getDiaryTileResizeMode,
        setDiaryTileAspectById,
        loadAuthorPosts,
        profileHashtagFilterEnabled,
        setProfileHashtagFilterEnabled,
        profileHashtags,
        handleRemoveProfileHashtag,
        newProfileHashtag,
        setNewProfileHashtag,
        handleAddProfileHashtag,
        profileLoading,
        visibleProfilePosts,
        openAddToDiaryModal,
        handlePublishDiaryChanges,
        diaryPublishing,
        isReadOnlyBlocked,
        readOnlyBlockHint,
      }}
    />
  );

  const renderSettingsPage = () => (
    <SettingsPage
      isMobile={isMobile}
      settingsSection={settingsSection}
      authState={authState}
      anonymousBrowsingEnabled={anonymousBrowsingEnabled}
      signerAvailable={signerAvailable}
      nip46Available={nip46Available}
      nip46BridgePresent={nip46BridgePresent}
      nip46PairingState={nip46PairingState}
      nip46PairingInput={nip46PairingInput}
      nip46PairingBusy={nip46PairingBusy}
      setNip46PairingInput={setNip46PairingInput}
      handleStartNip46Pairing={handleStartNip46Pairing}
      handleRefreshNip46Pairing={handleRefreshNip46Pairing}
      handleApproveNip46Pairing={handleApproveNip46Pairing}
      handleDisconnectNip46={handleDisconnectNip46}
      nsecInput={nsecInput}
      npubInput={npubInput}
      activeAuthTab={activeAuthTab}
      setActiveAuthTab={setActiveAuthTab}
      setNsecInput={setNsecInput}
      setNpubInput={setNpubInput}
      handleLogin={handleLogin}
      handleConnectSigner={handleConnectSigner}
      handleConnectNip46={handleConnectNip46}
      enableAnonymousBrowsing={enableAnonymousBrowsing}
      relayManager={relayManager}
      handleToggleRelay={handleToggleRelay}
      handleRemoveRelay={handleRemoveRelay}
      newRelay={newRelay}
      setNewRelay={setNewRelay}
      handleAddRelay={handleAddRelay}
      hashtags={hashtags}
      handleRemoveHashtag={handleRemoveHashtag}
      newHashtag={newHashtag}
      setNewHashtag={setNewHashtag}
      handleAddHashtag={handleAddHashtag}
      features={features}
      onlyGrowmies={onlyGrowmies}
      growmiesStore={growmiesStore}
      hydrateGrowmiesState={hydrateGrowmiesState}
      setError={setError}
      isReadOnlyBlocked={isReadOnlyBlocked}
      readOnlyBlockHint={readOnlyBlockHint}
      relayUrls={relayUrls}
      growmies={growmies}
      feedAuthorNames={feedAuthorNames}
      setRelayUrls={setRelayUrls}
      handleLogout={handleLogout}
      runtimeMode={runtimeMode}
      handleOpenApp={handleOpenApp}
      authManager={authManager}
      nip46PhaseLabel={nip46PhaseLabel}
    />
  );

  const renderGrowmiesPage = () => (
    <GrowmiesPage
      isMobile={isMobile}
      isNight={themeMode === 'night'}
      onRefresh={handleRefresh}
      growmiesCount={growmies.length}
      growmiesFeedEvents={growmiesFeedEvents}
      isLoading={isLoading}
      renderFeedEventCard={renderFeedEventCard}
    />
  );

  const renderBottomNav = () => (
    <View style={styles.bottomNavWrap} pointerEvents="box-none">
      <View style={[styles.bottomNav, themeMode === 'night' && styles.bottomNavNight]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Feed"
          style={({ pressed, hovered }) => [
            styles.bottomNavItem,
            themeMode === 'night' && styles.bottomNavItemNight,
            activePage === 'feed' && (themeMode === 'night' ? styles.bottomNavItemActiveNight : styles.bottomNavItemActive),
            (pressed || hovered) && (themeMode === 'night' ? styles.bottomNavItemHoverNight : styles.bottomNavItemHover),
          ]}
          onPress={() => setActivePage('feed')}
        >
          <Text
            style={[
              styles.bottomNavText,
              themeMode === 'night' && styles.bottomNavTextNight,
              activePage === 'feed' && (themeMode === 'night' ? styles.bottomNavTextActiveNight : styles.bottomNavTextActive),
            ]}
          >
            Feed
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={({ pressed, hovered }) => [
            styles.bottomNavProfileItem,
            themeMode === 'night' && styles.bottomNavProfileItemNight,
            activePage === 'profile' && (themeMode === 'night' ? styles.bottomNavProfileItemActiveNight : styles.bottomNavProfileItemActive),
            (pressed || hovered) && (themeMode === 'night' ? styles.bottomNavProfileItemHoverNight : styles.bottomNavProfileItemHover),
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
            themeMode === 'night' && styles.bottomNavItemNight,
            activePage === 'growmies' && (themeMode === 'night' ? styles.bottomNavItemActiveNight : styles.bottomNavItemActive),
            (pressed || hovered) && (themeMode === 'night' ? styles.bottomNavItemHoverNight : styles.bottomNavItemHover),
          ]}
          onPress={() => setActivePage('growmies')}
        >
          <Text
            style={[
              styles.bottomNavText,
              themeMode === 'night' && styles.bottomNavTextNight,
              activePage === 'growmies' && (themeMode === 'night' ? styles.bottomNavTextActiveNight : styles.bottomNavTextActive),
            ]}
          >
            Growmies
          </Text>
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
        <View style={styles.topRightActionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle day night mode"
            style={({ pressed, hovered }) => [
              styles.themeFloatingButton,
              themeMode === 'night' && styles.themeFloatingButtonNight,
              (pressed || hovered) && styles.themeFloatingButtonActive,
              themeMode === 'night' && (pressed || hovered) && styles.themeFloatingButtonActiveNight,
            ]}
            onPress={toggleThemeMode}
          >
            <Text style={[styles.themeFloatingButtonIcon, themeMode === 'night' && styles.themeFloatingButtonIconNight]}>
              {themeMode === 'night' ? '🌙' : '☀️'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed, hovered }) => [
              styles.settingsFloatingButton,
              themeMode === 'night' && styles.settingsFloatingButtonNight,
              (pressed || hovered || settingsMenuOpen) && styles.settingsFloatingButtonActive,
              themeMode === 'night' && (pressed || hovered || settingsMenuOpen) && styles.settingsFloatingButtonActiveNight,
            ]}
            onPress={() => setSettingsMenuOpen((prev) => !prev)}
          >
            <Text style={[styles.settingsFloatingButtonIcon, themeMode === 'night' && styles.settingsFloatingButtonIconNight]}>⚙</Text>
          </Pressable>
        </View>
        <Animated.View
          pointerEvents={settingsMenuOpen ? 'auto' : 'none'}
          style={[
            styles.settingsMenuDropdown,
            themeMode === 'night' && styles.settingsMenuDropdownNight,
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
                themeMode === 'night' && styles.settingsMenuItemNight,
                isSettingsItemActive('profile') && styles.settingsMenuItemActive,
                themeMode === 'night' && isSettingsItemActive('profile') && styles.settingsMenuItemActiveNight,
              ]}
              onPress={() => {
                setSettingsMenuOpen(false);
                setActivePage('profile');
              }}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  themeMode === 'night' && styles.settingsMenuItemTextNight,
                  isSettingsItemActive('profile') && styles.settingsMenuItemTextActive,
                  themeMode === 'night' && isSettingsItemActive('profile') && styles.settingsMenuItemTextActiveNight,
                ]}
              >
                Profile settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                themeMode === 'night' && styles.settingsMenuItemNight,
                isSettingsItemActive('diary') && styles.settingsMenuItemActive,
                themeMode === 'night' && isSettingsItemActive('diary') && styles.settingsMenuItemActiveNight,
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
                  themeMode === 'night' && styles.settingsMenuItemTextNight,
                  isSettingsItemActive('diary') && styles.settingsMenuItemTextActive,
                  themeMode === 'night' && isSettingsItemActive('diary') && styles.settingsMenuItemTextActiveNight,
                ]}
              >
                Diaries settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                themeMode === 'night' && styles.settingsMenuItemNight,
                isSettingsItemActive('growmies') && styles.settingsMenuItemActive,
                themeMode === 'night' && isSettingsItemActive('growmies') && styles.settingsMenuItemActiveNight,
              ]}
              onPress={() => openSettingsSection('growmies')}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  themeMode === 'night' && styles.settingsMenuItemTextNight,
                  isSettingsItemActive('growmies') && styles.settingsMenuItemTextActive,
                  themeMode === 'night' && isSettingsItemActive('growmies') && styles.settingsMenuItemTextActiveNight,
                ]}
              >
                Growmies settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                themeMode === 'night' && styles.settingsMenuItemNight,
                isSettingsItemActive('relays') && styles.settingsMenuItemActive,
                themeMode === 'night' && isSettingsItemActive('relays') && styles.settingsMenuItemActiveNight,
              ]}
              onPress={() => openSettingsSection('relays')}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  themeMode === 'night' && styles.settingsMenuItemTextNight,
                  isSettingsItemActive('relays') && styles.settingsMenuItemTextActive,
                  themeMode === 'night' && isSettingsItemActive('relays') && styles.settingsMenuItemTextActiveNight,
                ]}
              >
                Relay settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.settingsMenuItem,
                styles.settingsMenuItemLast,
                themeMode === 'night' && styles.settingsMenuItemNight,
                isSettingsItemActive('hashtags') && styles.settingsMenuItemActive,
                themeMode === 'night' && isSettingsItemActive('hashtags') && styles.settingsMenuItemActiveNight,
              ]}
              onPress={() => openSettingsSection('hashtags')}
            >
              <Text
                style={[
                  styles.settingsMenuItemText,
                  themeMode === 'night' && styles.settingsMenuItemTextNight,
                  isSettingsItemActive('hashtags') && styles.settingsMenuItemTextActive,
                  themeMode === 'night' && isSettingsItemActive('hashtags') && styles.settingsMenuItemTextActiveNight,
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
            style={[styles.loginPromptBackdrop, themeMode === 'night' && styles.loginPromptBackdropNight]}
          />
        )}
        <View style={styles.loginPromptAnchor}>
          <TouchableOpacity
            style={[styles.loginPromptButton, themeMode === 'night' && styles.loginPromptButtonNight]}
            onPress={() => setLoginPromptMenuOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Login"
          >
            <Text style={styles.loginPromptButtonText}>Login</Text>
          </TouchableOpacity>
          {loginPromptMenuOpen && (
            <View style={[styles.loginPromptMenu, themeMode === 'night' && styles.loginPromptMenuNight]}>
              <TouchableOpacity
                style={[styles.loginPromptMenuItem, themeMode === 'night' && styles.loginPromptMenuItemNight]}
                onPress={() => {
                  setLoginPromptMenuOpen(false);
                  handleConnectSigner().catch((err) => {
                    setError(err instanceof Error ? err.message : 'Failed to connect signer');
                  });
                }}
              >
                <Text style={[styles.loginPromptMenuItemText, themeMode === 'night' && styles.loginPromptMenuItemTextNight]}>Login with Alby</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.loginPromptMenuItem,
                  styles.loginPromptMenuItemLast,
                  themeMode === 'night' && styles.loginPromptMenuItemNight,
                ]}
                onPress={() => {
                  enableAnonymousBrowsing().catch(() => {
                    // best-effort persistence only
                  });
                }}
              >
                <Text style={[styles.loginPromptMenuItemText, themeMode === 'night' && styles.loginPromptMenuItemTextNight]}>Continue as anon</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderFloatingSessionActions = () => {
    if (!authState.isLoggedIn) return null;
    return (
      <View style={styles.logoutPromptWrap} pointerEvents="box-none">
        <View style={styles.sessionPromptAnchor}>
          <TouchableOpacity
            style={[styles.logoutPromptButton, themeMode === 'night' && styles.logoutPromptButtonNight]}
            onPress={() => {
              handleLogout().catch((err) => {
                setError(err instanceof Error ? err.message : 'Failed to logout');
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <Text style={styles.logoutPromptButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!loginPromptLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.bootLoadingWrap}>
          <Image source={require('../assets/WeedoshiBanner.png')} style={styles.bootLoadingImage} resizeMode="cover" />
          <Text style={styles.bootLoadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.pageBgLayer}>
        <Image
          source={themeMode === 'night' ? require('../assets/nightbg.png') : require('../assets/daybg.png')}
          style={styles.pageBgImage}
          resizeMode="cover"
        />
      </View>
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
      {renderFloatingSessionActions()}
      {renderFloatingLoginPrompt()}
      {renderFloatingSettingsMenu()}
      {renderBottomNav()}

      <Modal visible={addToDiaryModalOpen} transparent animationType="fade" onRequestClose={() => setAddToDiaryModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, themeMode === 'night' && styles.modalCardNight]}>
            <Text style={[styles.panelTitle, themeMode === 'night' && styles.panelTitleNight]}>Add to Diary</Text>
            <Text style={[styles.statusText, themeMode === 'night' && styles.statusTextNight]}>Select an existing diary or create a new one.</Text>

            <ScrollView style={styles.modalList}>
              {runOptions.map((run) => (
                <TouchableOpacity
                  key={run.diaryId}
                  style={[
                    styles.runMenuItem,
                    addToDiaryTargetId === run.diaryId && styles.modalSelectedDiary,
                    themeMode === 'night' && styles.runMenuItemNight,
                    themeMode === 'night' && addToDiaryTargetId === run.diaryId && styles.modalSelectedDiaryNight,
                  ]}
                  onPress={() => setAddToDiaryTargetId(run.diaryId)}
                >
                  <Text style={[styles.runMenuText, themeMode === 'night' && styles.runMenuTextNight]}>
                    {run.title} • {run.itemCount} items • {run.syncStatus}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[styles.input, themeMode === 'night' && styles.inputNight]}
              placeholder="New diary name (optional)"
              placeholderTextColor={themeMode === 'night' ? '#94a3b8' : '#999'}
              value={newDiaryInlineTitle}
              onChangeText={setNewDiaryInlineTitle}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.stickySecondary, themeMode === 'night' && styles.stickySecondaryNight]}
                onPress={() => setAddToDiaryModalOpen(false)}
              >
                <Text style={[styles.stickySecondaryText, themeMode === 'night' && styles.stickySecondaryTextNight]}>Cancel</Text>
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
        backgroundColor: 'transparent',
    },
    bootLoadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f4f0e6',
        paddingHorizontal: 20,
        gap: 14,
    },
    bootLoadingImage: {
        width: '100%',
        maxWidth: 720,
        height: 180,
        borderRadius: 16,
    },
    bootLoadingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#355b2f',
    },
    pageBgLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    pageBgImage: {
        width: '100%',
        height: '100%',
    },
    panelTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#1f2937',
    },
    panelTitleNight: {
        color: '#e5e7eb',
    },
    runMenuItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        gap: 8,
    },
    runMenuItemNight: {
        borderBottomColor: '#1f2937',
    },
    runMenuText: {
        fontSize: 13,
        color: '#1f2937',
    },
    runMenuTextNight: {
        color: '#e2e8f0',
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
    stickySecondaryNight: {
        borderColor: '#475569',
        backgroundColor: '#0f172a',
    },
    stickySecondaryTextNight: {
        color: '#e2e8f0',
    },
    stickyPrimary: {
        flex: 1,
        borderRadius: 8,
        backgroundColor: '#059669',
        paddingVertical: 12,
        alignItems: 'center',
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
    inputNight: {
        borderColor: '#475569',
        backgroundColor: 'rgba(15,23,42,0.82)',
        color: '#e5e7eb',
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
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
    statusText: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 8,
    },
    statusTextNight: {
        color: '#cbd5e1',
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
    bottomNavNight: {
        backgroundColor: 'rgba(2,6,23,0.9)',
        borderTopColor: 'rgba(71,85,105,0.9)',
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
    bottomNavItemNight: {
        borderColor: 'transparent',
    },
    bottomNavItemActive: {
        backgroundColor: '#edf2e8',
        borderColor: '#d9c593',
    },
    bottomNavItemActiveNight: {
        backgroundColor: '#0f172a',
        borderColor: '#475569',
    },
    bottomNavItemHover: {
        backgroundColor: '#f3f4f6',
    },
    bottomNavItemHoverNight: {
        backgroundColor: 'rgba(30,41,59,0.86)',
    },
    bottomNavText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6b7280',
    },
    bottomNavTextNight: {
        color: '#cbd5e1',
    },
    bottomNavTextActive: {
        color: '#2f6b3f',
    },
    bottomNavTextActiveNight: {
        color: '#86efac',
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
    bottomNavProfileItemNight: {
        borderColor: '#0f172a',
        backgroundColor: '#0b1220',
    },
    bottomNavProfileItemActive: {
        borderColor: '#7cff9e',
        backgroundColor: '#f6f1e5',
        shadowColor: '#7cff9e',
        shadowOpacity: 0.55,
        shadowRadius: 20,
        elevation: 12,
    },
    bottomNavProfileItemActiveNight: {
        borderColor: '#86efac',
        backgroundColor: '#0f172a',
        shadowColor: '#86efac',
        shadowOpacity: 0.5,
        shadowRadius: 18,
        elevation: 11,
    },
    bottomNavProfileItemHover: {
        backgroundColor: '#f3f4f6',
    },
    bottomNavProfileItemHoverNight: {
        backgroundColor: '#111827',
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
    topRightActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    themeFloatingButton: {
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
    themeFloatingButtonActive: {
        backgroundColor: '#f3f4f6',
    },
    themeFloatingButtonNight: {
        borderColor: '#475569',
        backgroundColor: 'rgba(2,6,23,0.95)',
    },
    themeFloatingButtonActiveNight: {
        backgroundColor: '#0f172a',
    },
    themeFloatingButtonIcon: {
        fontSize: 18,
        color: '#374151',
    },
    themeFloatingButtonIconNight: {
        color: '#f8fafc',
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
    settingsFloatingButtonNight: {
        borderColor: '#475569',
        backgroundColor: 'rgba(2,6,23,0.95)',
    },
    settingsFloatingButtonActiveNight: {
        backgroundColor: '#0f172a',
    },
    settingsFloatingButtonIcon: {
        fontSize: 20,
        color: '#374151',
    },
    settingsFloatingButtonIconNight: {
        color: '#f8fafc',
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
    settingsMenuDropdownNight: {
        borderColor: '#334155',
        backgroundColor: 'rgba(2,6,23,0.96)',
    },
    settingsMenuItem: {
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    settingsMenuItemNight: {
        borderBottomColor: '#1f2937',
    },
    settingsMenuItemLast: {
        borderBottomWidth: 0,
    },
    settingsMenuItemActive: {
        backgroundColor: '#ecfdf5',
    },
    settingsMenuItemActiveNight: {
        backgroundColor: '#0f172a',
    },
    settingsMenuItemText: {
        fontSize: 14,
        color: '#1f2937',
        fontWeight: '600',
    },
    settingsMenuItemTextNight: {
        color: '#e2e8f0',
    },
    settingsMenuItemTextActive: {
        color: '#047857',
    },
    settingsMenuItemTextActiveNight: {
        color: '#86efac',
    },
    loginPromptWrap: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 41,
    },
    logoutPromptWrap: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 41,
    },
    sessionPromptAnchor: {
        position: 'absolute',
        top: 12,
        left: 12,
        alignItems: 'flex-start',
    },
    logoutPromptButton: {
        borderRadius: 999,
        backgroundColor: '#4b5563',
        paddingVertical: 10,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 10,
        elevation: 6,
    },
    logoutPromptButtonNight: {
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#475569',
    },
    logoutPromptButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    loginPromptBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(17,24,39,0.08)',
    },
    loginPromptBackdropNight: {
        backgroundColor: 'rgba(2,6,23,0.32)',
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
    loginPromptButtonNight: {
        backgroundColor: '#166534',
        borderWidth: 1,
        borderColor: '#22c55e',
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
    loginPromptMenuNight: {
        borderColor: '#334155',
        backgroundColor: 'rgba(2,6,23,0.96)',
    },
    loginPromptMenuItem: {
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0fdf4',
    },
    loginPromptMenuItemNight: {
        borderBottomColor: '#1f2937',
    },
    loginPromptMenuItemLast: {
        borderBottomWidth: 0,
    },
    loginPromptMenuItemText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#166534',
    },
    loginPromptMenuItemTextNight: {
        color: '#d1fae5',
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
    modalCardNight: {
        backgroundColor: 'rgba(2,6,23,0.96)',
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalList: {
        maxHeight: 220,
        marginBottom: 10,
    },
    modalSelectedDiary: {
        backgroundColor: '#ecfdf5',
    },
    modalSelectedDiaryNight: {
        backgroundColor: '#0f172a',
        borderColor: '#475569',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
    }
});
