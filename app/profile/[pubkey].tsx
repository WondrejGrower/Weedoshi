import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Event as NostrEvent } from 'nostr-tools';
import type { NostrProfileMetadata } from '../../src/lib/nostrClient';
import { nostrClient } from '../../src/lib/nostrClient';
import { relayManager } from '../../src/lib/relayManager';
import { fetchPublicDiaries, type RemoteDiary } from '../../src/lib/nostrSync';
import { diaryManager, fetchAuthorNotes } from '../../src/lib/diaryManager';
import { getDiaryPhaseDisplay, shortPubkey } from '../../src/features/home/profileHelpers';
import { toErrorMessage } from '../../src/lib/errorUtils';
import { extractMediaFromContent } from '../../src/lib/mediaExtraction';
import { getJson } from '../../src/lib/persistentStorage';
import { PostMediaRenderer } from '../../src/components/PostMediaRenderer';

const APP_THEME_MODE_KEY = 'app_theme_mode_v1';
const DIARY_CACHE_KEY_PREFIX = 'diaries:';
const DIARY_RENDER_STEP = 16;
const POST_RENDER_STEP = 24;
type VisitorSection = 'diaries' | 'posts';

type CachedDiaryItem = {
  eventId: string;
  authorPubkey: string;
  createdAt: number;
  addedAt: number;
  contentPreview?: string;
  image?: string;
  mediaUrls?: string[];
  phaseLabel?: string;
};

type CachedDiary = {
  id: string;
  title: string;
  plant?: string;
  plantSlug?: string;
  species?: string;
  cultivar?: string;
  breeder?: string;
  plantWikiAPointer?: string;
  phase?: string;
  coverImage?: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  items: CachedDiaryItem[];
};

type CachedDiaryStorePayload = {
  version: number;
  state?: {
    diaries?: CachedDiary[];
  };
};

function isValidImageUrl(url?: string): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
}

function getDiaryCoverForTile(diary: RemoteDiary, ignoreCover: boolean = false): string | undefined {
  if (!ignoreCover && isValidImageUrl(diary.coverImage)) return diary.coverImage;
  for (const item of diary.items) {
    if (isValidImageUrl(item.image)) return item.image;
    if (item.mediaUrls && item.mediaUrls.length > 0) {
      const media = item.mediaUrls.find((url) => isValidImageUrl(url));
      if (media) return media;
    }
    if (item.contentPreview) {
      const media = extractMediaFromContent(item.contentPreview);
      const previewImage = media.images.find((url) => isValidImageUrl(url));
      if (previewImage) return previewImage;
    }
  }
  return undefined;
}

async function loadCachedPublicDiaries(pubkey: string): Promise<RemoteDiary[]> {
  const payload = await getJson<CachedDiaryStorePayload | null>(`${DIARY_CACHE_KEY_PREFIX}${pubkey}`, null);
  const source = payload?.state?.diaries;
  if (!Array.isArray(source)) return [];

  return source
    .filter((entry): entry is CachedDiary => Boolean(entry && typeof entry.id === 'string' && entry.isPublic))
    .map((entry) => ({
      id: entry.id,
      title: entry.title || entry.id,
      plant: entry.plant,
      plantSlug: entry.plantSlug,
      species: entry.species,
      cultivar: entry.cultivar,
      breeder: entry.breeder,
      plantWikiAPointer: entry.plantWikiAPointer,
      phase: entry.phase,
      coverImage: entry.coverImage,
      createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : 0,
      updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
      isPublic: true,
      items: Array.isArray(entry.items)
        ? entry.items
            .filter((item): item is CachedDiaryItem => Boolean(item && typeof item.eventId === 'string'))
            .map((item) => ({
              eventId: item.eventId,
              authorPubkey: item.authorPubkey || pubkey,
              createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
              addedAt: typeof item.addedAt === 'number' ? item.addedAt : 0,
              contentPreview: item.contentPreview,
              image: item.image,
              mediaUrls: item.mediaUrls,
              phaseLabel: item.phaseLabel,
            }))
        : [],
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function mergeDiaryItems(clientItems: RemoteDiary['items'], relayItems: RemoteDiary['items']): RemoteDiary['items'] {
  const byId = new Map<string, RemoteDiary['items'][number]>();
  for (const item of relayItems) {
    byId.set(item.eventId, { ...item });
  }
  for (const item of clientItems) {
    const current = byId.get(item.eventId);
    byId.set(item.eventId, {
      ...(current || {}),
      ...item,
      eventId: item.eventId,
      authorPubkey: item.authorPubkey || current?.authorPubkey || '',
      createdAt: item.createdAt || current?.createdAt || 0,
      addedAt: item.addedAt || current?.addedAt || 0,
    });
  }
  return Array.from(byId.values()).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

function mergeDiarySources(clientDiaries: RemoteDiary[], relayDiaries: RemoteDiary[]): RemoteDiary[] {
  const byId = new Map<string, RemoteDiary>();

  for (const diary of relayDiaries) {
    byId.set(diary.id, { ...diary, items: [...diary.items] });
  }

  for (const clientDiary of clientDiaries) {
    const relayDiary = byId.get(clientDiary.id);
    if (!relayDiary) {
      byId.set(clientDiary.id, { ...clientDiary, items: [...clientDiary.items] });
      continue;
    }

    byId.set(clientDiary.id, {
      ...relayDiary,
      ...clientDiary,
      title: clientDiary.title || relayDiary.title,
      plant: clientDiary.plant || relayDiary.plant,
      plantSlug: clientDiary.plantSlug || relayDiary.plantSlug,
      species: clientDiary.species || relayDiary.species,
      cultivar: clientDiary.cultivar || relayDiary.cultivar,
      breeder: clientDiary.breeder || relayDiary.breeder,
      plantWikiAPointer: clientDiary.plantWikiAPointer || relayDiary.plantWikiAPointer,
      phase: clientDiary.phase || relayDiary.phase,
      coverImage: clientDiary.coverImage || relayDiary.coverImage,
      createdAt: Math.min(
        clientDiary.createdAt || relayDiary.createdAt || 0,
        relayDiary.createdAt || clientDiary.createdAt || 0
      ),
      updatedAt: Math.max(clientDiary.updatedAt || 0, relayDiary.updatedAt || 0),
      isPublic: true,
      items: mergeDiaryItems(clientDiary.items, relayDiary.items),
    });
  }

  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export default function VisitorProfilePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const diaryTileLayoutStyle =
    width >= 1280
      ? styles.diaryTileCardXL
      : width >= 980
        ? styles.diaryTileCardLarge
        : !isMobile
          ? styles.diaryTileCardDesktop
          : styles.diaryTileCardMobile;
  const params = useLocalSearchParams<{ pubkey?: string | string[] }>();
  const pubkey = Array.isArray(params.pubkey) ? params.pubkey[0] : params.pubkey;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<'day' | 'night'>('day');
  const [npubCopied, setNpubCopied] = useState(false);
  const [metadata, setMetadata] = useState<NostrProfileMetadata | null>(null);
  const [diaries, setDiaries] = useState<RemoteDiary[]>([]);
  const [allPosts, setAllPosts] = useState<NostrEvent[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [visibleDiaryCount, setVisibleDiaryCount] = useState(DIARY_RENDER_STEP);
  const [visiblePostCount, setVisiblePostCount] = useState(POST_RENDER_STEP);
  const [activeSection, setActiveSection] = useState<VisitorSection>('diaries');
  const [failedPrimaryCoverByDiary, setFailedPrimaryCoverByDiary] = useState<Record<string, boolean>>({});

  const displayName = useMemo(() => {
    if (!pubkey) return 'Unknown profile';
    const profileName = metadata?.display_name?.trim() || metadata?.name?.trim();
    return profileName || shortPubkey(pubkey);
  }, [metadata?.display_name, metadata?.name, pubkey]);
  const avatarLabel = useMemo(() => displayName.slice(0, 2).toUpperCase(), [displayName]);
  const publicDiaryCount = diaries.length;
  const publicEntryCount = useMemo(() => diaries.reduce((sum, diary) => sum + diary.items.length, 0), [diaries]);
  const visibleDiaries = useMemo(() => diaries.slice(0, visibleDiaryCount), [diaries, visibleDiaryCount]);
  const visiblePosts = useMemo(() => allPosts.slice(0, visiblePostCount), [allPosts, visiblePostCount]);
  const profileBio = (metadata?.about || '').trim();
  const profileNip05 = (metadata?.nip05 || '').trim();
  const profileWebsite =
    metadata && typeof (metadata as Record<string, unknown>).website === 'string'
      ? ((metadata as Record<string, unknown>).website as string).trim()
      : '';
  const profileNpub = useMemo(() => {
    if (!pubkey) return null;
    try {
      return nostrClient.pubkeyToNpub(pubkey);
    } catch {
      return null;
    }
  }, [pubkey]);
  const nostrSinceLabel = useMemo(() => {
    if (diaries.length === 0) return 'Unknown';
    const oldest = diaries.reduce((min, diary) => Math.min(min, diary.createdAt || diary.updatedAt), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(oldest)) return 'Unknown';
    return new Date(oldest * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }, [diaries]);

  const loadThemeMode = useCallback(() => {
    getJson<'day' | 'night'>(APP_THEME_MODE_KEY, 'day')
      .then((mode) => {
        setThemeMode(mode === 'night' ? 'night' : 'day');
      })
      .catch(() => {
        setThemeMode('day');
      });
  }, []);

  const load = useCallback(async () => {
    if (!pubkey) {
      setError('Profile pubkey is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);
    setAllPosts([]);
    setPostsLoaded(false);
    setVisibleDiaryCount(DIARY_RENDER_STEP);
    setVisiblePostCount(POST_RENDER_STEP);
    try {
      const currentRelays = relayManager.getEnabledUrls();
      const allKnownRelays = relayManager.getAllRelays().map((r) => r.url);
      const seedRelays = Array.from(new Set([...currentRelays, ...allKnownRelays])).slice(0, 12);

      // 🚀 Step 1: Find where this author writes (NIP-65)
      const authorWriteRelays = await nostrClient.fetchUserWriteRelays(pubkey, seedRelays, 4500);
      const mergedRelays = Array.from(new Set([...currentRelays, ...authorWriteRelays])).slice(0, 15);

      nostrClient.setRelays(mergedRelays);
      const cachedPublicDiaries = await loadCachedPublicDiaries(pubkey);
      if (cachedPublicDiaries.length > 0) {
        setDiaries(cachedPublicDiaries);
        setFailedPrimaryCoverByDiary({});
      }

      const [profileMetadataResult, publicDiariesResult] = await Promise.allSettled([
        nostrClient.fetchProfileMetadata(pubkey, mergedRelays, 6500),
        fetchPublicDiaries(pubkey, mergedRelays),
      ]);

      const profileMetadata =
        profileMetadataResult.status === 'fulfilled' ? profileMetadataResult.value : null;
      const remotePublicDiaries =
        publicDiariesResult.status === 'fulfilled' ? publicDiariesResult.value : [];
      const publicDiaries = mergeDiarySources(cachedPublicDiaries, remotePublicDiaries);

      setMetadata(profileMetadata);
      setDiaries(publicDiaries);
      setFailedPrimaryCoverByDiary({});

      const profileFailed = profileMetadataResult.status === 'rejected';
      const diariesFailed = publicDiariesResult.status === 'rejected';
      if (profileFailed && diariesFailed) {
        throw new Error('Failed to load public profile content from relays.');
      }
      if (diariesFailed && cachedPublicDiaries.length > 0) {
        setWarning('Relay request failed. Showing cached public diaries from this device.');
      } else if (diariesFailed) {
        setWarning('Profile loaded, but public diaries are temporarily unavailable.');
      } else if (remotePublicDiaries.length === 0 && cachedPublicDiaries.length > 0) {
        setWarning('Showing cached public diaries from this device. Relay sync may be pending.');
      } else if (profileFailed) {
        setWarning('Public diaries loaded, but profile metadata is temporarily unavailable.');
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load public profile'));
    } finally {
      setLoading(false);
    }
  }, [pubkey]);

  const loadPosts = useCallback(async () => {
    if (!pubkey) return;
    setPostsLoading(true);
    try {
      const currentRelays = relayManager.getEnabledUrls();
      const allKnownRelays = relayManager.getAllRelays().map((r) => r.url);
      const seedRelays = Array.from(new Set([...currentRelays, ...allKnownRelays])).slice(0, 12);

      // 🚀 Step 1: Ensure we use author's preferred write relays
      const authorWriteRelays = await nostrClient.fetchUserWriteRelays(pubkey, seedRelays, 4500);
      const activeRelays = Array.from(new Set([...currentRelays, ...authorWriteRelays])).slice(0, 15);

      if (activeRelays.length === 0) return;

      const authorPosts = await fetchAuthorNotes(diaryManager.getPool(), activeRelays, pubkey, 220);
      setAllPosts(authorPosts);
      setPostsLoaded(true);
    } catch {
      setWarning('Public diaries loaded, but all posts are temporarily unavailable.');
    } finally {
      setPostsLoaded(true);
      setPostsLoading(false);
    }
  }, [pubkey]);

  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();
    }, [loadThemeMode])
  );

  useEffect(() => {
    load().catch(() => {
      // handled in callback
    });
  }, [load]);

  useEffect(() => {
    if (activeSection !== 'posts' || postsLoaded || postsLoading) return;
    loadPosts().catch(() => {
      // best effort
    });
  }, [activeSection, loadPosts, postsLoaded, postsLoading]);

  useEffect(() => {
    if (activeSection === 'diaries') {
      setVisibleDiaryCount(DIARY_RENDER_STEP);
      return;
    }
    setVisiblePostCount(POST_RENDER_STEP);
  }, [activeSection]);

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.pageBgLayer}>
        <Image
          source={themeMode === 'night' ? require('../../assets/nightbg.png') : require('../../assets/daybg.png')}
          style={styles.pageBgImage}
          resizeMode="cover"
        />
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, themeMode === 'night' && styles.headerNight]}>
          <TouchableOpacity style={[styles.backButton, themeMode === 'night' && styles.backButtonNight]} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, themeMode === 'night' && styles.backButtonTextNight]}>← Back</Text>
          </TouchableOpacity>
          <View style={[styles.profileHeroCard, themeMode === 'night' && styles.profileHeroCardNight]}>
            <View style={styles.profileBannerWrap}>
              {metadata?.banner ? (
                <Image source={{ uri: metadata.banner }} style={styles.profileBannerImage} resizeMode="cover" />
              ) : (
                <View style={[styles.profileBannerFallback, themeMode === 'night' && styles.profileBannerFallbackNight]} />
              )}
              <View style={styles.profileBannerShade} />
            </View>
            <View style={[styles.profileHeaderContent, isMobile && styles.profileHeaderContentMobile]}>
              <View style={[styles.profileMeta, themeMode === 'night' && styles.profileMetaNight]}>
                <View style={[styles.profileMetaContentRow, isMobile && styles.profileMetaContentRowMobile]}>
                  <View style={styles.profileMetaLead}>
                    <View style={styles.profileNameRow}>
                      <Text style={[styles.title, themeMode === 'night' && styles.titleNight]}>{displayName}</Text>
                      <View style={[styles.publicBadge, themeMode === 'night' && styles.publicBadgeNight]}>
                        <Text style={[styles.publicBadgeText, themeMode === 'night' && styles.publicBadgeTextNight]}>PUBLIC</Text>
                      </View>
                    </View>
                    <Text style={[styles.pubkey, themeMode === 'night' && styles.pubkeyNight]}>{pubkey ? shortPubkey(pubkey) : 'Unknown'}</Text>
                    {profileNpub ? (
                      <View style={styles.profileIdentityActionsRow}>
                        <TouchableOpacity
                          style={styles.profileCopyNpubButton}
                          onPress={() => {
                            Clipboard.setStringAsync(profileNpub)
                              .then(() => {
                                setNpubCopied(true);
                                setTimeout(() => setNpubCopied(false), 1400);
                              })
                              .catch(() => {
                                // best effort
                              });
                          }}
                        >
                          <Text style={styles.profileCopyNpubButtonText}>{npubCopied ? 'Copied' : 'Copy npub'}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <View style={styles.profileAvatarSpot}>
                      {metadata?.picture ? (
                        <Image source={{ uri: metadata.picture }} style={styles.avatarImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarFallbackText}>{avatarLabel}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={[styles.profileBioAside, themeMode === 'night' && styles.profileBioAsideNight, isMobile && styles.profileBioAsideMobile]}>
                    {profileBio.length > 0 ? (
                      <Text style={[styles.profileBio, themeMode === 'night' && styles.profileBioNight]}>{profileBio}</Text>
                    ) : (
                      <Text style={[styles.profileBioMuted, themeMode === 'night' && styles.profileBioMutedNight]}>
                        No profile bio published.
                      </Text>
                    )}
                    {(profileNip05.length > 0 || profileWebsite.length > 0) && (
                      <View style={styles.profileMetaRows}>
                        {profileNip05.length > 0 ? (
                          <Text style={[styles.profileMetaLine, themeMode === 'night' && styles.profileMetaLineNight]}>
                            NIP-05: {profileNip05}
                          </Text>
                        ) : null}
                        {profileWebsite.length > 0 ? (
                          <Text style={[styles.profileMetaLine, themeMode === 'night' && styles.profileMetaLineNight]}>
                            Website: {profileWebsite}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.profileStatsRow}>
                  <View style={[styles.statPill, themeMode === 'night' && styles.statPillNight]}>
                    <Text style={[styles.statValue, themeMode === 'night' && styles.statValueNight]}>{publicDiaryCount}</Text>
                    <Text style={[styles.statLabel, themeMode === 'night' && styles.statLabelNight]}>Diaries</Text>
                  </View>
                  <View style={[styles.statPill, themeMode === 'night' && styles.statPillNight]}>
                    <Text style={[styles.statValue, themeMode === 'night' && styles.statValueNight]}>{publicEntryCount}</Text>
                    <Text style={[styles.statLabel, themeMode === 'night' && styles.statLabelNight]}>Notes</Text>
                  </View>
                  <View style={[styles.statPill, themeMode === 'night' && styles.statPillNight]}>
                    <Text style={[styles.statValue, themeMode === 'night' && styles.statValueNight]}>{nostrSinceLabel}</Text>
                    <Text style={[styles.statLabel, themeMode === 'night' && styles.statLabelNight]}>Nostr since</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2f6b3f" />
            <Text style={[styles.helper, themeMode === 'night' && styles.helperNight]}>Loading public profile...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!error && warning && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        )}

        {!error && (
          <View style={styles.content}>
            <View style={[styles.panelIntro, themeMode === 'night' && styles.panelIntroNight]}>
              <View style={styles.panelIntroHeader}>
                <Text style={[styles.panelTitle, themeMode === 'night' && styles.panelTitleNight]}>
                  {activeSection === 'diaries' ? 'Public diaries' : 'All posts'}
                </Text>
                <TouchableOpacity
                  style={[styles.refreshButton, themeMode === 'night' && styles.refreshButtonNight]}
                  onPress={() => {
                    load().catch(() => {});
                    if (activeSection === 'posts') {
                      loadPosts().catch(() => {});
                    }
                  }}
                >
                  <Text style={[styles.refreshButtonText, themeMode === 'night' && styles.refreshButtonTextNight]}>Refresh</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.sectionTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.sectionTab,
                    themeMode === 'night' && styles.sectionTabNight,
                    activeSection === 'diaries' && styles.sectionTabActive,
                    themeMode === 'night' && activeSection === 'diaries' && styles.sectionTabActiveNight,
                  ]}
                  onPress={() => setActiveSection('diaries')}
                >
                  <Text
                    style={[
                      styles.sectionTabText,
                      themeMode === 'night' && styles.sectionTabTextNight,
                      activeSection === 'diaries' && styles.sectionTabTextActive,
                    ]}
                  >
                    Public diaries
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sectionTab,
                    themeMode === 'night' && styles.sectionTabNight,
                    activeSection === 'posts' && styles.sectionTabActive,
                    themeMode === 'night' && activeSection === 'posts' && styles.sectionTabActiveNight,
                  ]}
                  onPress={() => setActiveSection('posts')}
                >
                  <Text
                    style={[
                      styles.sectionTabText,
                      themeMode === 'night' && styles.sectionTabTextNight,
                      activeSection === 'posts' && styles.sectionTabTextActive,
                    ]}
                  >
                    All posts
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.panelSubtitle, themeMode === 'night' && styles.panelSubtitleNight]}>
                {activeSection === 'diaries'
                  ? 'Visitor mode reads only diaries published as public by this user.'
                  : 'All posts are loaded from relays for this public profile.'}
              </Text>
            </View>

            {activeSection === 'diaries' && diaries.length === 0 && (
              <View style={[styles.panel, themeMode === 'night' && styles.panelNight]}>
                <Text style={[styles.helper, themeMode === 'night' && styles.helperNight]}>No public diaries found.</Text>
              </View>
            )}

            {activeSection === 'diaries' && diaries.length > 0 && (
              <View style={styles.diaryTilesGrid}>
                {visibleDiaries.map((diary) => {
                  const forceFallback = Boolean(failedPrimaryCoverByDiary[diary.id]);
                  const imageUri = getDiaryCoverForTile(diary, forceFallback);
                  const updatedAtTs = diary.updatedAt || diary.createdAt;
                  const phaseDisplay = getDiaryPhaseDisplay(diary);

                  return (
                    <Pressable
                      key={diary.id}
                      style={({ hovered, pressed }) => [
                        styles.diaryTileCard,
                        themeMode === 'night' && styles.diaryTileCardNight,
                        diaryTileLayoutStyle,
                        (hovered || pressed) && styles.diaryTileCardHover,
                      ]}
                      onPress={() =>
                        router.push(`/diary/${encodeURIComponent(diary.id)}?owner=${encodeURIComponent(pubkey || '')}` as Href)
                      }
                    >
                      {imageUri ? (
                        <View style={styles.diaryTileImageWrap}>
                          <Image
                            source={{ uri: imageUri }}
                            style={styles.diaryTileImage}
                            resizeMode="cover"
                            onError={() => {
                              setFailedPrimaryCoverByDiary((prev) => ({ ...prev, [diary.id]: true }));
                            }}
                          />
                          <View pointerEvents="none" style={styles.diaryTileImageShade} />
                          {isValidImageUrl(diary.coverImage) && !forceFallback ? (
                            <View style={styles.diaryTileCoverBadge}>
                              <Text style={styles.diaryTileCoverBadgeText}>Cover</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <View style={[styles.diaryTileImageFallback, themeMode === 'night' && styles.diaryTileImageFallbackNight]}>
                          <Text style={[styles.diaryTileImageFallbackText, themeMode === 'night' && styles.diaryTileImageFallbackTextNight]}>No image</Text>
                        </View>
                      )}
                      <View style={[styles.diaryTileMeta, themeMode === 'night' && styles.diaryTileMetaNight]}>
                        <Text style={[styles.diaryTileTitle, themeMode === 'night' && styles.diaryTileTitleNight]}>{diary.title || 'Untitled diary'}</Text>
                        <Text style={[styles.diaryTileSub, themeMode === 'night' && styles.diaryTileSubNight]}>
                          {(diary.plant || 'Plant n/a')} • {(phaseDisplay || 'Phase n/a')}
                        </Text>
                        <Text style={[styles.diaryTileDate, themeMode === 'night' && styles.diaryTileDateNight]}>
                          {diary.items.length} entries • {new Date(updatedAtTs * 1000).toLocaleDateString()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {activeSection === 'diaries' && diaries.length > visibleDiaryCount && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, themeMode === 'night' && styles.loadMoreBtnNight]}
                onPress={() => setVisibleDiaryCount((prev) => prev + DIARY_RENDER_STEP)}
              >
                <Text style={[styles.loadMoreBtnText, themeMode === 'night' && styles.loadMoreBtnTextNight]}>
                  Load more diaries ({diaries.length - visibleDiaryCount} remaining)
                </Text>
              </TouchableOpacity>
            )}

            {activeSection === 'posts' && postsLoading && (
              <View style={[styles.panel, themeMode === 'night' && styles.panelNight]}>
                <Text style={[styles.helper, themeMode === 'night' && styles.helperNight]}>Loading posts from relays...</Text>
              </View>
            )}

            {activeSection === 'posts' && !postsLoading && allPosts.length === 0 && (
              <View style={[styles.panel, themeMode === 'night' && styles.panelNight]}>
                <Text style={[styles.helper, themeMode === 'night' && styles.helperNight]}>
                  No public posts found on selected relays.
                </Text>
              </View>
            )}

            {activeSection === 'posts' &&
              visiblePosts.map((post) => (
                <View key={post.id} style={[styles.postCard, themeMode === 'night' && styles.postCardNight]}>
                  <Text style={[styles.postMeta, themeMode === 'night' && styles.postMetaNight]}>
                    {new Date(post.created_at * 1000).toLocaleString()}
                  </Text>
                  <PostMediaRenderer
                    content={post.content || ''}
                    tags={post.tags}
                    textNumberOfLines={5}
                    isNight={themeMode === 'night'}
                  />
                </View>
              ))}
            {activeSection === 'posts' && !postsLoading && allPosts.length > visiblePostCount && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, themeMode === 'night' && styles.loadMoreBtnNight]}
                onPress={() => setVisiblePostCount((prev) => prev + POST_RENDER_STEP)}
              >
                <Text style={[styles.loadMoreBtnText, themeMode === 'night' && styles.loadMoreBtnTextNight]}>
                  Load more posts ({allPosts.length - visiblePostCount} remaining)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pageBgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  pageBgImage: {
    width: '100%',
    height: '100%',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#f2f1eb',
  },
  headerNight: {
    backgroundColor: 'transparent',
  },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d7be86',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8f4ea',
    marginBottom: 8,
  },
  backButtonNight: {
    borderColor: '#475569',
    backgroundColor: 'rgba(2,6,23,0.78)',
  },
  profileHeroCard: {
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fffdf8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  profileHeroCardNight: {
    borderColor: 'rgba(71,85,105,0.85)',
    backgroundColor: 'rgba(15,23,42,0.84)',
  },
  profileBannerWrap: {
    width: '100%',
    height: 116,
    position: 'relative',
    backgroundColor: '#d9e8d6',
  },
  profileBannerImage: {
    width: '100%',
    height: '100%',
  },
  profileBannerFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#dae8d8',
  },
  profileBannerFallbackNight: {
    backgroundColor: '#1f2937',
  },
  profileBannerShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  profileHeaderContent: {
    marginTop: -22,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  profileHeaderContentMobile: {
    marginTop: -18,
    paddingHorizontal: 10,
  },
  profileMeta: {
    borderWidth: 1,
    borderColor: '#dfcfa9',
    borderRadius: 12,
    backgroundColor: '#fffdf7',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  profileMetaNight: {
    borderColor: '#475569',
    backgroundColor: 'rgba(2,6,23,0.62)',
  },
  profileMetaContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  profileMetaContentRowMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  profileMetaLead: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 240,
    maxWidth: 260,
    minWidth: 0,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  profileIdentityActionsRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  profileCopyNpubButton: {
    borderWidth: 1,
    borderColor: '#bcdcbf',
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  profileCopyNpubButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  profileAvatarSpot: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 98,
  },
  profileBioAside: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#e7d9bb',
    paddingLeft: 8,
    paddingTop: 4,
    backgroundColor: '#f5fbf2',
    borderRadius: 8,
    paddingRight: 8,
    paddingBottom: 6,
  },
  profileBioAsideNight: {
    borderLeftColor: '#475569',
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  profileBioAsideMobile: {
    borderLeftWidth: 0,
    paddingLeft: 0,
    paddingTop: 0,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#fffdf8',
    backgroundColor: '#d1d5db',
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#fffdf8',
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#047857',
  },
  backButtonText: {
    color: '#2f6b3f',
    fontWeight: '700',
    fontSize: 13,
  },
  backButtonTextNight: {
    color: '#d1fae5',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1b4d2f',
  },
  titleNight: {
    color: '#f8fafc',
  },
  pubkey: {
    marginTop: 2,
    fontSize: 11,
    color: '#7a6742',
    fontFamily: 'monospace',
  },
  pubkeyNight: {
    color: '#cbd5e1',
  },
  profileBio: {
    fontSize: 13,
    lineHeight: 19,
    color: '#234330',
    fontWeight: '600',
  },
  profileBioNight: {
    color: '#e2e8f0',
  },
  profileBioMuted: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  profileBioMutedNight: {
    color: '#94a3b8',
  },
  profileMetaRows: {
    gap: 4,
  },
  profileMetaLine: {
    fontSize: 12,
    color: '#475569',
  },
  profileMetaLineNight: {
    color: '#cbd5e1',
  },
  publicBadge: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ecfdf5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  publicBadgeNight: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  publicBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.3,
  },
  publicBadgeTextNight: {
    color: '#86efac',
  },
  scroll: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  helper: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
  },
  helperNight: {
    color: '#cbd5e1',
  },
  errorBox: {
    margin: 14,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
  },
  warningBox: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 12,
  },
  warningText: {
    color: '#92400e',
    fontSize: 13,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  panel: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 12,
    padding: 12,
  },
  panelNight: {
    backgroundColor: 'rgba(15,23,42,0.84)',
    borderColor: 'rgba(71,85,105,0.85)',
  },
  panelIntro: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  panelIntroNight: {
    backgroundColor: 'rgba(15,23,42,0.84)',
    borderColor: 'rgba(71,85,105,0.85)',
  },
  panelIntroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1b4d2f',
  },
  panelTitleNight: {
    color: '#e2e8f0',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#b9dcbf',
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refreshButtonNight: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  refreshButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  refreshButtonTextNight: {
    color: '#d1fae5',
  },
  panelSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#5b6470',
  },
  panelSubtitleNight: {
    color: '#cbd5e1',
  },
  sectionTabsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionTab: {
    borderWidth: 1,
    borderColor: '#d7c593',
    borderRadius: 999,
    backgroundColor: '#f7f2e7',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionTabNight: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  sectionTabActive: {
    borderColor: '#2f6b3f',
    backgroundColor: '#e5efdf',
  },
  sectionTabActiveNight: {
    borderColor: '#86efac',
    backgroundColor: '#1f2937',
  },
  sectionTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2f6b3f',
  },
  sectionTabTextNight: {
    color: '#d1fae5',
  },
  sectionTabTextActive: {
    color: '#1f5d35',
  },
  profileStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  statPill: {
    borderWidth: 1,
    borderColor: '#d7be86',
    borderRadius: 999,
    backgroundColor: '#fbf7ee',
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 96,
  },
  statPillNight: {
    borderColor: '#475569',
    backgroundColor: '#111827',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2a6a3c',
  },
  statValueNight: {
    color: '#d1fae5',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: '#967a47',
  },
  statLabelNight: {
    color: '#94a3b8',
  },
  diaryTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  diaryTileCard: {
    backgroundColor: '#fffefb',
    borderWidth: 1,
    borderColor: '#e2d7c0',
    borderRadius: 14,
    overflow: 'hidden',
  },
  diaryTileCardNight: {
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderColor: 'rgba(71,85,105,0.85)',
  },
  diaryTileCardDesktop: {
    width: '48.8%',
    minWidth: 220,
  },
  diaryTileCardLarge: {
    width: '32.3%',
    minWidth: 210,
  },
  diaryTileCardXL: {
    width: '24.2%',
    minWidth: 180,
  },
  diaryTileCardMobile: {
    width: '100%',
  },
  diaryTileCardHover: {
    borderColor: '#b9dcbf',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  postCard: {
    backgroundColor: '#fffefb',
    borderWidth: 1,
    borderColor: '#e2d7c0',
    borderRadius: 14,
    padding: 12,
  },
  postCardNight: {
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderColor: 'rgba(71,85,105,0.85)',
  },
  postMeta: {
    marginBottom: 8,
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  postMetaNight: {
    color: '#cbd5e1',
  },
  loadMoreBtn: {
    borderWidth: 1,
    borderColor: '#d7be86',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'center',
    backgroundColor: '#f8f4ea',
    marginTop: 4,
    marginBottom: 6,
  },
  loadMoreBtnNight: {
    borderColor: '#475569',
    backgroundColor: 'rgba(2,6,23,0.78)',
  },
  loadMoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#355b2f',
  },
  loadMoreBtnTextNight: {
    color: '#d1fae5',
  },
  diaryTileImageWrap: {
    width: '100%',
    aspectRatio: 2.35,
    backgroundColor: '#d1d5db',
    position: 'relative',
  },
  diaryTileImage: {
    width: '100%',
    height: '100%',
  },
  diaryTileImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  diaryTileCoverBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: 'rgba(20,83,45,0.85)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  diaryTileCoverBadgeText: {
    color: '#ecfdf5',
    fontSize: 10,
    fontWeight: '700',
  },
  diaryTileImageFallback: {
    width: '100%',
    aspectRatio: 2.35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2e7',
  },
  diaryTileImageFallbackNight: {
    backgroundColor: '#0f172a',
  },
  diaryTileImageFallbackText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  diaryTileImageFallbackTextNight: {
    color: '#cbd5e1',
  },
  diaryTileMeta: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 3,
  },
  diaryTileMetaNight: {
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  diaryTileTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f5d35',
  },
  diaryTileTitleNight: {
    color: '#e2e8f0',
  },
  diaryTileSub: {
    fontSize: 12,
    color: '#4b5563',
  },
  diaryTileSubNight: {
    color: '#cbd5e1',
  },
  diaryTileDate: {
    fontSize: 11,
    color: '#6b7280',
  },
  diaryTileDateNight: {
    color: '#94a3b8',
  },
});
