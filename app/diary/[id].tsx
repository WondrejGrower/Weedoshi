import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Event as NostrEvent } from 'nostr-tools';
import { authManager } from '../../src/lib/authManager';
import { diaryStore, type Diary, type DiaryDetailsInput } from '../../src/lib/diaryStore';
import { relayManager } from '../../src/lib/relayManager';
import { diaryManager, fetchEventsByIds } from '../../src/lib/diaryManager';
import { fetchPublicDiaries } from '../../src/lib/nostrSync';
import { nostrClient } from '../../src/lib/nostrClient';
import { PostMediaRenderer } from '../../src/components/PostMediaRenderer';
import { shortPubkey } from '../../src/features/home/profileHelpers';
import { extractMediaFromContent, parseMediaFromEventTags } from '../../src/lib/mediaExtraction';
import { normalizePlantDTagSlug } from '../../src/lib/plants/catalog';
import { PlantPicker } from '../../src/components/PlantPicker';
import type { PlantSelection } from '../../src/lib/plants/types';
import { toErrorMessage } from '../../src/lib/errorUtils';
import { getJson } from '../../src/lib/persistentStorage';

type DiaryEntryView = {
  eventId: string;
  phaseLabel: string;
  addedAt: number;
  authorPubkey: string;
  image?: string;
  mediaUrls?: string[];
  contentPreview?: string;
  content: NostrEvent | null;
};

const PHASE_TEMPLATE_OPTIONS = ['Seedling', 'Vegetation', 'Flowering', 'Harvest'];
type SortMode = 'phase-flow' | 'newest' | 'oldest';
const APP_THEME_MODE_KEY = 'app_theme_mode_v1';

function parsePhaseLabel(value?: string): { phase: string; week: string } {
  const raw = (value || '').trim();
  if (!raw) return { phase: 'General', week: '' };
  if (raw.includes(' :: ')) {
    const [phase, week] = raw.split(' :: ');
    return { phase: phase?.trim() || 'General', week: week?.trim() || '' };
  }
  return { phase: raw, week: '' };
}

function composePhaseLabel(phase: string, week: string): string {
  const phaseValue = phase.trim();
  const weekValue = week.trim();
  if (phaseValue && weekValue) return `${phaseValue} :: ${weekValue}`;
  if (phaseValue) return phaseValue;
  if (weekValue) return `Week ${weekValue}`;
  return 'General';
}

function phaseRank(phaseRaw: string): number {
  const phase = phaseRaw.toLowerCase();
  if (phase.includes('seed')) return 0;
  if (phase.includes('veg')) return 1;
  if (phase.includes('flow') || phase.includes('bloom')) return 2;
  if (phase.includes('harvest')) return 3;
  return 9;
}

function weekRank(weekRaw: string): number {
  const match = weekRaw.match(/\d+/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number.parseInt(match[0], 10);
}

function getHostLabel(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

function getPrimaryMediaUrl(entry: DiaryEntryView): string | undefined {
  if (entry.image) return entry.image;
  if (entry.mediaUrls && entry.mediaUrls.length > 0) return entry.mediaUrls[0];
  if (entry.content) {
    const tagMedia = parseMediaFromEventTags(entry.content);
    const fromTags = tagMedia.images[0] || tagMedia.videos[0];
    if (fromTags) return fromTags;
    const extracted = extractMediaFromContent(entry.content.content || '');
    return extracted.images[0] || extracted.videos[0];
  }
  const previewExtracted = extractMediaFromContent(entry.contentPreview || '');
  return previewExtracted.images[0] || previewExtracted.videos[0];
}

function getAllMediaUrls(entry: DiaryEntryView): string[] {
  if (entry.content) {
    const tagMedia = parseMediaFromEventTags(entry.content);
    const contentMedia = extractMediaFromContent(entry.content.content || '');
    return Array.from(new Set([...tagMedia.images, ...tagMedia.videos, ...contentMedia.images, ...contentMedia.videos]));
  }

  const previewMedia = extractMediaFromContent(entry.contentPreview || '');
  return Array.from(new Set([...(entry.mediaUrls || []), ...previewMedia.images, ...previewMedia.videos]));
}

function getDerivedDiaryPhase(diary: Diary | null): string | undefined {
  if (!diary) return undefined;
  if (diary.phase?.trim()) return diary.phase.trim();
  const newestWithPhase = [...diary.items]
    .sort((a, b) => (b.createdAt || b.addedAt || 0) - (a.createdAt || a.addedAt || 0))
    .map((item) => {
      const raw = (item.phaseLabel || '').trim();
      if (!raw) return undefined;
      const base = raw.includes(' :: ') ? raw.split(' :: ')[0]?.trim() : raw;
      return base || undefined;
    })
    .find((phase) => Boolean(phase));
  return newestWithPhase || undefined;
}

function isLikelyVideoUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return (
    normalized.includes('.mp4') ||
    normalized.includes('.webm') ||
    normalized.includes('.mov') ||
    normalized.includes('.m4v') ||
    normalized.includes('.m3u8')
  );
}

export default function DiaryDetailPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionOffsetsRef = useRef<Record<string, number>>({});
  const params = useLocalSearchParams<{ id?: string | string[]; entryId?: string | string[]; owner?: string | string[] }>();
  const diaryId = Array.isArray(params.id) ? params.id[0] : params.id;
  const focusEntryId = Array.isArray(params.entryId) ? params.entryId[0] : params.entryId;
  const ownerPubkeyParam = Array.isArray(params.owner) ? params.owner[0] : params.owner;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diary, setDiary] = useState<Diary | null>(null);
  const [eventsById, setEventsById] = useState<Record<string, NostrEvent>>({});
  const [editMode, setEditMode] = useState(false);
  const [entryDrafts, setEntryDrafts] = useState<Record<string, { phase: string; week: string }>>({});
  const [coverImageDraft, setCoverImageDraft] = useState<string | undefined>(undefined);
  const [titleDraft, setTitleDraft] = useState('');
  const [plantNameDraft, setPlantNameDraft] = useState('');
  const [plantSlugDraft, setPlantSlugDraft] = useState('');
  const [speciesDraft, setSpeciesDraft] = useState('');
  const [cultivarDraft, setCultivarDraft] = useState('');
  const [breederDraft, setBreederDraft] = useState('');
  const [wikiPointerDraft, setWikiPointerDraft] = useState('');
  const [showMorePlantFields, setShowMorePlantFields] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('phase-flow');
  const [isVisitorDiary, setIsVisitorDiary] = useState(false);
  const [themeMode, setThemeMode] = useState<'day' | 'night'>('day');
  const [activeTimelineKey, setActiveTimelineKey] = useState<string | null>(null);
  const isNight = themeMode === 'night';
  const visitorColumns = width >= 1100 ? 3 : width >= 760 ? 2 : 1;

  const loadThemeMode = useCallback(() => {
    getJson<'day' | 'night'>(APP_THEME_MODE_KEY, 'day')
      .then((mode) => setThemeMode(mode === 'night' ? 'night' : 'day'))
      .catch(() => setThemeMode('day'));
  }, []);

  const loadDiary = useCallback(async () => {
    if (!diaryId) {
      setError('Diary id is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const auth = authManager.getState();
      const relayUrls = relayManager.getEnabledUrls();
      const isOwnerView = Boolean(auth.pubkey && (!ownerPubkeyParam || ownerPubkeyParam === auth.pubkey));
      let selected: Diary | null = null;

      if (isOwnerView) {
        if (!auth.pubkey) {
          throw new Error('Login required to open private diary detail.');
        }
        setIsVisitorDiary(false);
        await diaryStore.setUser(auth.pubkey);
        if (relayUrls.length > 0) {
          await diaryStore.mergePublicDiariesFromRelays(auth.pubkey, relayUrls);
        }
        selected = diaryStore.getDiary(diaryId);
      } else {
        const ownerPubkey = ownerPubkeyParam?.trim();
        if (!ownerPubkey) {
          throw new Error('Owner pubkey is required for public diary view.');
        }
        setIsVisitorDiary(true);

        // 🚀 Find where this author writes (NIP-65)
        const currentRelays = relayManager.getEnabledUrls();
        const allKnownRelays = relayManager.getAllRelays().map((r) => r.url);
        const seedRelays = Array.from(new Set([...currentRelays, ...allKnownRelays])).slice(0, 12);
        const authorWriteRelays = await nostrClient.fetchUserWriteRelays(ownerPubkey, seedRelays, 4500);
        const mergedRelays = Array.from(new Set([...currentRelays, ...authorWriteRelays])).slice(0, 15);

        const remoteDiaries = await fetchPublicDiaries(ownerPubkey, mergedRelays);
        const remote = remoteDiaries.find((item) => item.id === diaryId) || null;
        selected = remote ? { ...remote, syncStatus: 'synced' } : null;
      }

      if (!selected) {
        throw new Error('Diary not found.');
      }
      setDiary(selected);

      const ids = selected.items.map((item) => item.eventId);
      if (ids.length === 0 || relayUrls.length === 0) {
        setEventsById({});
        return;
      }

      const fetched = await fetchEventsByIds(diaryManager.getPool(), relayUrls, ids);
      const mapped: Record<string, NostrEvent> = {};
      for (const [id, event] of fetched.entries()) {
        mapped[id] = event;
      }
      setEventsById(mapped);
    } catch (e) {
      setError(toErrorMessage(e, 'Failed to open diary'));
    } finally {
      setLoading(false);
    }
  }, [diaryId, ownerPubkeyParam]);

  useEffect(() => {
    loadDiary().catch(() => {
      // handled in callback
    });
  }, [loadDiary]);

  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();
    }, [loadThemeMode])
  );

  const entries = useMemo<DiaryEntryView[]>(() => {
    if (!diary) return [];
    return diary.items.map((item) => ({
      eventId: item.eventId,
      phaseLabel: item.phaseLabel || diary.phase || 'General',
      addedAt: item.addedAt,
      authorPubkey: item.authorPubkey,
      image: item.image,
      mediaUrls: item.mediaUrls,
      contentPreview: item.contentPreview,
      content: eventsById[item.eventId] || null,
    }));
  }, [diary, eventsById]);
  const diaryPhaseDisplay = useMemo(() => getDerivedDiaryPhase(diary), [diary]);

  useEffect(() => {
    const next: Record<string, { phase: string; week: string }> = {};
    for (const entry of entries) {
      next[entry.eventId] = parsePhaseLabel(entry.phaseLabel);
    }
    setEntryDrafts(next);
  }, [entries]);

  useEffect(() => {
    setCoverImageDraft(diary?.coverImage);
  }, [diary?.coverImage]);

  useEffect(() => {
    if (!diary) return;
    setTitleDraft(diary.title || '');
    setPlantNameDraft(diary.plant || '');
    setPlantSlugDraft(diary.plantSlug || '');
    setSpeciesDraft(diary.species || '');
    setCultivarDraft(diary.cultivar || '');
    setBreederDraft(diary.breeder || '');
    setWikiPointerDraft(diary.plantWikiAPointer || '');
    setShowMorePlantFields(false);
  }, [diary]);

  const orderedEntries = useMemo(() => {
    const next = [...entries];
    if (sortMode === 'phase-flow') {
      next.sort((a, b) => {
        const ap = parsePhaseLabel(a.phaseLabel);
        const bp = parsePhaseLabel(b.phaseLabel);
        const rankDiff = phaseRank(ap.phase) - phaseRank(bp.phase);
        if (rankDiff !== 0) return rankDiff;
        const weekDiff = weekRank(ap.week) - weekRank(bp.week);
        if (weekDiff !== 0) return weekDiff;
        return (a.content?.created_at || a.addedAt) - (b.content?.created_at || b.addedAt);
      });
    } else if (sortMode === 'newest') {
      next.sort((a, b) => (b.content?.created_at || b.addedAt) - (a.content?.created_at || a.addedAt));
    } else {
      next.sort((a, b) => (a.content?.created_at || a.addedAt) - (b.content?.created_at || b.addedAt));
    }

    if (!focusEntryId) return next;
    const focus = next.find((entry) => entry.eventId === focusEntryId);
    if (!focus) return next;
    return [focus, ...next.filter((entry) => entry.eventId !== focusEntryId)];
  }, [entries, focusEntryId, sortMode]);

  const visitorTimelineSections = useMemo(() => {
    const sections: Array<{ key: string; label: string; firstEntryId: string }> = [];
    const seen = new Set<string>();

    for (const entry of orderedEntries) {
      const parsed = parsePhaseLabel(entry.phaseLabel);
      const key = `${parsed.phase.toLowerCase()}::${parsed.week.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sections.push({
        key,
        label: parsed.week ? `${parsed.phase} • W${parsed.week}` : parsed.phase,
        firstEntryId: entry.eventId,
      });
    }

    return sections;
  }, [orderedEntries]);

  const visitorSectionKeyByEntryId = useMemo(() => {
    const next: Record<string, string> = {};
    for (const section of visitorTimelineSections) {
      next[section.firstEntryId] = section.key;
    }
    return next;
  }, [visitorTimelineSections]);

  useEffect(() => {
    if (visitorTimelineSections.length === 0) {
      setActiveTimelineKey(null);
      return;
    }
    setActiveTimelineKey((prev) => prev || visitorTimelineSections[0].key);
  }, [visitorTimelineSections]);

  const handleDiaryScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isVisitorDiary || visitorTimelineSections.length === 0) return;

      const y = event.nativeEvent.contentOffset.y + 18;
      const keyedOffsets = visitorTimelineSections
        .map((section) => ({ key: section.key, offset: sectionOffsetsRef.current[section.key] }))
        .filter((item): item is { key: string; offset: number } => typeof item.offset === 'number')
        .sort((a, b) => a.offset - b.offset);

      if (keyedOffsets.length === 0) return;

      let nextActive = keyedOffsets[0].key;
      for (const item of keyedOffsets) {
        if (item.offset <= y) {
          nextActive = item.key;
        } else {
          break;
        }
      }

      setActiveTimelineKey((prev) => (prev === nextActive ? prev : nextActive));
    },
    [isVisitorDiary, visitorTimelineSections]
  );

  const coverCandidates = useMemo(() => {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const entry of entries) {
      const url = getPrimaryMediaUrl(entry);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      next.push(url);
    }
    return next;
  }, [entries]);

  const handleSaveEdits = async () => {
    if (!diary) return;
    try {
      await diaryStore.updateDiaryDetails(diary.id, {
        title: titleDraft,
        plant: plantNameDraft,
        plantSlug: plantSlugDraft,
        species: speciesDraft,
        cultivar: cultivarDraft,
        breeder: breederDraft,
        plantWikiAPointer: wikiPointerDraft,
      } satisfies DiaryDetailsInput);
      const labelsByEventId: Record<string, string> = {};
      for (const entry of entries) {
        const draft = entryDrafts[entry.eventId] || parsePhaseLabel(entry.phaseLabel);
        labelsByEventId[entry.eventId] = composePhaseLabel(draft.phase, draft.week);
      }
      await diaryStore.setDiaryItemPhaseLabels(diary.id, labelsByEventId);
      await diaryStore.setDiaryCoverImage(diary.id, coverImageDraft);
      setEditMode(false);
      await loadDiary();
    } catch (e) {
      setError(toErrorMessage(e, 'Failed to save edits'));
    }
  };

  const handleDeleteDiary = () => {
    if (!diary) return;
    Alert.alert(
      'Delete diary',
      `Do you really want to delete "${diary.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            diaryStore
              .deleteDiary(diary.id)
              .then(() => {
                router.replace('/' as Href);
              })
              .catch((e) => {
                setError(toErrorMessage(e, 'Failed to delete diary'));
              });
          },
        },
      ]
    );
  };

  const handlePlantSelection = (selection: PlantSelection) => {
    setPlantNameDraft(selection.displayName);
    setPlantSlugDraft(selection.slug);
    setSpeciesDraft(selection.latinName || '');
    if (selection.isCustom) {
      setWikiPointerDraft('');
    }
  };

  const handleRemoveEntry = async (eventId: string) => {
    if (!diary) return;
    try {
      await diaryStore.removeItemFromDiary(diary.id, eventId);
      setEntryDrafts((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      await loadDiary();
    } catch (e) {
      setError(toErrorMessage(e, 'Failed to remove entry from diary'));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.pageBgLayer}>
        <Image
          source={isNight ? require('../../assets/nightbg.png') : require('../../assets/daybg.png')}
          style={styles.pageBgImage}
          resizeMode="cover"
        />
      </View>
      <View style={[styles.header, isNight && styles.headerNight]}>
        <View style={styles.headerTopRow}>
          <Pressable style={[styles.backButton, isNight && styles.backButtonNight]} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, isNight && styles.backButtonTextNight]}>← Back</Text>
          </Pressable>
          {!editMode || isVisitorDiary ? (
            <TouchableOpacity
              style={[styles.editButton, isNight && styles.editButtonNight, isVisitorDiary && styles.editButtonDisabled]}
              onPress={() => {
                if (isVisitorDiary) return;
                setEditMode(true);
              }}
              disabled={isVisitorDiary}
            >
              <Text style={[styles.editButtonText, isNight && styles.editButtonTextNight]}>
                {isVisitorDiary ? 'Read only' : 'Edit'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelButton}
                onPress={() => {
                  setEditMode(false);
                  setCoverImageDraft(diary?.coverImage);
                  setTitleDraft(diary?.title || '');
                  setPlantNameDraft(diary?.plant || '');
                  setPlantSlugDraft(diary?.plantSlug || '');
                  setSpeciesDraft(diary?.species || '');
                  setCultivarDraft(diary?.cultivar || '');
                  setBreederDraft(diary?.breeder || '');
                  setWikiPointerDraft(diary?.plantWikiAPointer || '');
                  setShowMorePlantFields(false);
                }}
              >
                <Text style={styles.editCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveButton} onPress={handleSaveEdits}>
                <Text style={styles.editSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={[styles.headerTitle, isNight && styles.headerTitleNight]}>
          {editMode ? titleDraft || diary?.title || 'Diary detail' : diary?.title || 'Diary detail'}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={handleDiaryScroll}
        scrollEventThrottle={16}
      >
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2f6b3f" />
            <Text style={[styles.helper, isNight && styles.helperNight]}>Loading diary...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && diary && (
          <View style={styles.content}>
            {isVisitorDiary && (
              <View style={[styles.infoBox, isNight && styles.infoBoxNight]}>
                <Text style={[styles.infoText, isNight && styles.infoTextNight]}>Viewing public diary as visitor.</Text>
              </View>
            )}
            <View style={[styles.metaCard, isNight && styles.metaCardNight]}>
              {!editMode ? (
                <Text style={[styles.metaTitle, isNight && styles.metaTitleNight]}>{diary.title}</Text>
              ) : (
                <View style={styles.metaEditSection}>
                  <Text style={styles.metaLabel}>Diary name</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={titleDraft}
                    onChangeText={setTitleDraft}
                    placeholder="Diary name"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              )}
              <Text style={[styles.metaText, isNight && styles.metaTextNight]}>
                {(diary.plant || 'Plant not set')} • {(diaryPhaseDisplay || 'Phase not set')}
              </Text>
              {diary.cultivar ? <Text style={[styles.metaText, isNight && styles.metaTextNight]}>Cultivar: {diary.cultivar}</Text> : null}
              {diary.breeder ? <Text style={[styles.metaText, isNight && styles.metaTextNight]}>Breeder: {diary.breeder}</Text> : null}
              {(diary.plantSlug || diary.plant) ? (
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => {
                    const slug = normalizePlantDTagSlug(diary.plantSlug || diary.plant || '');
                    if (!slug) return;
                    router.push(
                      `/plant/${encodeURIComponent(slug)}?name=${encodeURIComponent(diary.plant || '')}` as Href
                    );
                  }}
                >
                  <Text style={styles.smallButtonText}>Plant details</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={[styles.metaText, isNight && styles.metaTextNight]}>Entries: {diary.items.length}</Text>
              {diary.coverImage ? (
                <Text style={[styles.metaText, isNight && styles.metaTextNight]}>Cover: custom image selected</Text>
              ) : null}
              {editMode && !isVisitorDiary && (
                <View style={styles.metaEditSection}>
                  <Text style={styles.metaLabel}>Plant</Text>
                  <PlantPicker
                    valueSlug={plantSlugDraft}
                    valueName={plantNameDraft}
                    onChange={handlePlantSelection}
                  />
                  <View style={styles.metaRow}>
                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() => {
                        const slug = normalizePlantDTagSlug(plantSlugDraft || plantNameDraft || '');
                        if (!slug) return;
                        router.push(`/plant/${encodeURIComponent(slug)}?name=${encodeURIComponent(plantNameDraft || '')}` as Href);
                      }}
                    >
                      <Text style={styles.smallButtonText}>Plant details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editCancelButton}
                      onPress={() => setShowMorePlantFields((value) => !value)}
                    >
                      <Text style={styles.editCancelButtonText}>{showMorePlantFields ? 'Less' : 'More'}</Text>
                    </TouchableOpacity>
                  </View>
                  {showMorePlantFields && (
                    <View style={styles.moreFieldsWrap}>
                      <Text style={styles.metaLabel}>Cultivar / Strain</Text>
                      <TextInput
                        style={styles.metaInput}
                        value={cultivarDraft}
                        onChangeText={setCultivarDraft}
                        placeholder="Optional cultivar/strain"
                        placeholderTextColor="#9ca3af"
                      />
                      <Text style={styles.metaLabel}>Breeder</Text>
                      <TextInput
                        style={styles.metaInput}
                        value={breederDraft}
                        onChangeText={setBreederDraft}
                        placeholder="Optional breeder"
                        placeholderTextColor="#9ca3af"
                      />
                      <Text style={styles.metaLabel}>Wiki article pointer (a)</Text>
                      <TextInput
                        style={styles.metaInput}
                        value={wikiPointerDraft}
                        onChangeText={setWikiPointerDraft}
                        placeholder="30818:<pubkey>:<d-tag>"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  )}
                </View>
              )}
              {editMode && !isVisitorDiary && (
                <TouchableOpacity style={styles.deleteDiaryButton} onPress={handleDeleteDiary}>
                  <Text style={styles.deleteDiaryButtonText}>Delete diary</Text>
                </TouchableOpacity>
              )}
              {editMode && !isVisitorDiary && (
                <View style={styles.coverEditorCard}>
                  <Text style={styles.coverEditorTitle}>Cover image</Text>
                  {coverImageDraft ? (
                    <Image source={{ uri: coverImageDraft }} style={styles.coverPreview} />
                  ) : (
                    <Text style={styles.coverEditorHelper}>No cover selected yet.</Text>
                  )}
                  {coverCandidates.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coverCandidatesRow}>
                      {coverCandidates.map((imageUrl) => {
                        const isSelected = imageUrl === coverImageDraft;
                        return (
                          <TouchableOpacity
                            key={imageUrl}
                            style={[styles.coverCandidateCard, isSelected && styles.coverCandidateCardActive]}
                            onPress={() => setCoverImageDraft(imageUrl)}
                          >
                            <Image source={{ uri: imageUrl }} style={styles.coverCandidateImage} />
                            <Text style={[styles.coverCandidateLabel, isSelected && styles.coverCandidateLabelActive]}>
                              {isSelected ? 'Selected' : 'Use cover'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={styles.coverEditorHelper}>No images found in this diary yet.</Text>
                  )}
                  {coverImageDraft ? (
                    <TouchableOpacity style={styles.coverResetButton} onPress={() => setCoverImageDraft(undefined)}>
                      <Text style={styles.coverResetButtonText}>Remove cover image</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
              <View style={styles.sortRow}>
                <Text style={[styles.sortLabel, isNight && styles.sortLabelNight]}>Sort</Text>
                <TouchableOpacity
                  style={[styles.sortChip, isNight && styles.sortChipNight, sortMode === 'phase-flow' && styles.sortChipActive]}
                  onPress={() => setSortMode('phase-flow')}
                >
                  <Text style={[styles.sortChipText, isNight && styles.sortChipTextNight, sortMode === 'phase-flow' && styles.sortChipTextActive]}>
                    Seedling → Harvest
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortChip, isNight && styles.sortChipNight, sortMode === 'newest' && styles.sortChipActive]}
                  onPress={() => setSortMode('newest')}
                >
                  <Text style={[styles.sortChipText, isNight && styles.sortChipTextNight, sortMode === 'newest' && styles.sortChipTextActive]}>
                    Newest
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortChip, isNight && styles.sortChipNight, sortMode === 'oldest' && styles.sortChipActive]}
                  onPress={() => setSortMode('oldest')}
                >
                  <Text style={[styles.sortChipText, isNight && styles.sortChipTextNight, sortMode === 'oldest' && styles.sortChipTextActive]}>
                    Oldest
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {isVisitorDiary && visitorTimelineSections.length > 1 && (
              <View style={[styles.timelineStickyWrap, isNight && styles.timelineStickyWrapNight]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineChipRow}>
                  {visitorTimelineSections.map((section) => {
                    const isActive = section.key === activeTimelineKey;
                    return (
                      <TouchableOpacity
                        key={section.key}
                        style={[
                          styles.timelineChip,
                          isNight && styles.timelineChipNight,
                          isActive && styles.timelineChipActive,
                          isNight && isActive && styles.timelineChipActiveNight,
                        ]}
                        onPress={() => {
                          const y = sectionOffsetsRef.current[section.key];
                          if (typeof y === 'number') {
                            scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
                            setActiveTimelineKey(section.key);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.timelineChipText,
                            isNight && styles.timelineChipTextNight,
                            isActive && styles.timelineChipTextActive,
                          ]}
                        >
                          {section.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {orderedEntries.map((entry) => {
              const parsed = parsePhaseLabel(entry.phaseLabel);
              const sectionStartKey = visitorSectionKeyByEntryId[entry.eventId];
              const draft = entryDrafts[entry.eventId] || parsed;
              const mediaUrl = getPrimaryMediaUrl(entry);
              const mediaUrls = getAllMediaUrls(entry);
              const fallbackTags = mediaUrls.map((url) => ['url', url] as string[]);
              const isCoverCandidate = Boolean(mediaUrl && coverImageDraft && mediaUrl === coverImageDraft);
              const mediaHost = getHostLabel(mediaUrl);
              const eventStorage = entry.content ? 'Relay event' : 'Local diary cache';
              const entryTimestamp = new Date((entry.content?.created_at || entry.addedAt) * 1000).toLocaleString();
              const visitorPreviewText = (entry.content?.content || entry.contentPreview || '').trim();
              const visitorMedia = mediaUrls.slice(0, 6);
              const visitorTileWidth = `${100 / visitorColumns}%` as const;
              return (
                <View
                  key={entry.eventId}
                  onLayout={(evt) => {
                    if (!isVisitorDiary || !sectionStartKey) return;
                    sectionOffsetsRef.current[sectionStartKey] = evt.nativeEvent.layout.y;
                  }}
                  style={[styles.entryCard, isNight && styles.entryCardNight, isVisitorDiary && styles.entryCardVisitor]}
                >
                  {!editMode || isVisitorDiary ? (
                    <Text style={[styles.entryTitle, isNight && styles.entryTitleNight]}>
                      {parsed.phase}
                      {parsed.week ? ` • Week ${parsed.week}` : ''}
                    </Text>
                  ) : (
                    <View style={styles.entryEditWrap}>
                      <View style={styles.entryEditRow}>
                        <TextInput
                          style={[styles.entryInput, styles.entryInputPhase]}
                          value={draft.phase}
                          onChangeText={(value) =>
                            setEntryDrafts((prev) => ({
                              ...prev,
                              [entry.eventId]: { ...draft, phase: value },
                            }))
                          }
                          placeholder="Phase"
                          placeholderTextColor="#9ca3af"
                        />
                        <TextInput
                          style={[styles.entryInput, styles.entryInputWeek]}
                          value={draft.week}
                          onChangeText={(value) =>
                            setEntryDrafts((prev) => ({
                              ...prev,
                              [entry.eventId]: { ...draft, week: value },
                            }))
                          }
                          placeholder="Week"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                      <View style={styles.templatesRow}>
                        {PHASE_TEMPLATE_OPTIONS.map((template) => (
                          <TouchableOpacity
                            key={`${entry.eventId}-${template}`}
                            style={[
                              styles.templateChip,
                              draft.phase.toLowerCase().startsWith(template.toLowerCase()) && styles.templateChipActive,
                            ]}
                            onPress={() =>
                              setEntryDrafts((prev) => ({
                                ...prev,
                                [entry.eventId]: { ...draft, phase: template },
                              }))
                            }
                          >
                            <Text
                              style={[
                                styles.templateChipText,
                                draft.phase.toLowerCase().startsWith(template.toLowerCase()) && styles.templateChipTextActive,
                              ]}
                            >
                              {template}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                  <Text style={[styles.entryMeta, isNight && styles.entryMetaNight]}>
                    {entryTimestamp} •{' '}
                    {shortPubkey(entry.content?.pubkey || entry.authorPubkey)}
                  </Text>
                  {isVisitorDiary && (
                    <View style={styles.visitorTimelineSection}>
                      {visitorMedia.length > 0 ? (
                        <View style={styles.visitorMediaGrid}>
                          {visitorMedia.map((url) => {
                            const isVideo = isLikelyVideoUrl(url);
                            return (
                              <TouchableOpacity
                                key={`${entry.eventId}-${url}`}
                                style={[
                                  styles.visitorMediaTile,
                                  { width: visitorTileWidth },
                                  isNight && styles.visitorMediaTileNight,
                                ]}
                                onPress={() => {
                                  Linking.openURL(url).catch(() => {
                                    setError('Could not open media URL.');
                                  });
                                }}
                              >
                                {isVideo ? (
                                  <View style={[styles.visitorVideoPlaceholder, isNight && styles.visitorVideoPlaceholderNight]}>
                                    <Text style={styles.visitorVideoPlay}>▶</Text>
                                    <Text style={[styles.visitorVideoLabel, isNight && styles.visitorVideoLabelNight]}>
                                      Video
                                    </Text>
                                  </View>
                                ) : (
                                  <Image source={{ uri: url }} style={styles.visitorMediaImage} resizeMode="cover" />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : null}
                      {visitorPreviewText.length > 0 ? (
                        <Text style={[styles.visitorPreviewText, isNight && styles.visitorPreviewTextNight]}>
                          {visitorPreviewText}
                        </Text>
                      ) : null}
                    </View>
                  )}
                  {!isVisitorDiary && (
                    <View style={[styles.storageInfoBox, isNight && styles.storageInfoBoxNight]}>
                      <Text style={[styles.storageLine, isNight && styles.storageLineNight]}>
                        Event source: <Text style={[styles.storageValue, isNight && styles.storageValueNight]}>{eventStorage}</Text>
                      </Text>
                      <Text style={[styles.storageLine, isNight && styles.storageLineNight]}>
                        Media host:{' '}
                        <Text style={[styles.storageValue, isNight && styles.storageValueNight]}>
                          {mediaHost || 'No media host detected'}
                        </Text>
                      </Text>
                      {mediaUrl ? (
                        <TouchableOpacity style={[styles.storageLinkButton, isNight && styles.storageLinkButtonNight]} onPress={() => Linking.openURL(mediaUrl)}>
                          <Text style={[styles.storageLinkText, isNight && styles.storageLinkTextNight]}>Open media source</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                  {editMode && !isVisitorDiary && (
                    <View style={styles.entryActionRow}>
                      {mediaUrl ? (
                        <TouchableOpacity
                          style={[styles.coverButton, isCoverCandidate && styles.coverButtonActive]}
                          onPress={() => setCoverImageDraft(mediaUrl)}
                        >
                          <Text style={[styles.coverButtonText, isCoverCandidate && styles.coverButtonTextActive]}>
                            {isCoverCandidate ? 'Cover selected' : 'Set as cover'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.removeEntryButton}
                        onPress={() => {
                          handleRemoveEntry(entry.eventId).catch(() => {
                            // handled in callback
                          });
                        }}
                      >
                        <Text style={styles.removeEntryButtonText}>Remove from diary</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {entry.content ? (
                    <PostMediaRenderer
                      content={entry.content.content || ''}
                      tags={entry.content.tags}
                      textNumberOfLines={0}
                      imageResizeMode="contain"
                      singleImageHeight={420}
                      isNight={isNight}
                    />
                  ) : (
                    <View>
                      <PostMediaRenderer
                        content={entry.contentPreview || entry.image || ''}
                        tags={fallbackTags}
                        textNumberOfLines={0}
                        imageResizeMode="contain"
                        singleImageHeight={420}
                        isNight={isNight}
                      />
                      {!isVisitorDiary ? (
                        <Text style={[styles.helper, isNight && styles.helperNight]}>
                          Loaded from local diary cache (relay event unavailable).
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
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
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dfcfad',
    backgroundColor: '#fffdf8',
  },
  headerNight: {
    borderBottomColor: '#2d3d42',
    backgroundColor: 'rgba(13,22,28,0.9)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d7be86',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: '#f8f4ea',
  },
  backButtonText: {
    color: '#2f6b3f',
    fontWeight: '700',
    fontSize: 13,
  },
  backButtonNight: {
    borderColor: '#3f555b',
    backgroundColor: '#14232d',
  },
  backButtonTextNight: {
    color: '#c8f4da',
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#d7be86',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8f4ea',
  },
  editButtonNight: {
    borderColor: '#3f555b',
    backgroundColor: '#14232d',
  },
  editButtonDisabled: {
    opacity: 0.7,
  },
  editButtonText: {
    color: '#2f6b3f',
    fontWeight: '700',
    fontSize: 13,
  },
  editButtonTextNight: {
    color: '#c8f4da',
  },
  editActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  editCancelButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  editCancelButtonText: {
    color: '#4b5563',
    fontWeight: '700',
    fontSize: 12,
  },
  editSaveButton: {
    borderWidth: 1,
    borderColor: '#2f6b3f',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#2f6b3f',
  },
  editSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1b4d2f',
  },
  headerTitleNight: {
    color: '#d8f4df',
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
    marginTop: 10,
    fontSize: 13,
    color: '#6b7280',
  },
  helperNight: {
    color: '#8aa0b1',
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
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  infoText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '600',
  },
  infoBoxNight: {
    backgroundColor: '#12263d',
  },
  infoTextNight: {
    color: '#c6e1ff',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },
  metaCard: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  metaCardNight: {
    backgroundColor: 'rgba(16,27,34,0.88)',
    borderColor: '#2b3f47',
  },
  metaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b4d2f',
  },
  metaTitleNight: {
    color: '#d8f4df',
  },
  metaEditSection: {
    marginTop: 8,
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  metaInput: {
    borderWidth: 1,
    borderColor: '#d7ccb4',
    backgroundColor: '#fffdf8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1f2937',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  moreFieldsWrap: {
    borderWidth: 1,
    borderColor: '#e2d7c2',
    borderRadius: 8,
    backgroundColor: '#f8f5ed',
    padding: 8,
    gap: 6,
  },
  metaText: {
    marginTop: 5,
    fontSize: 13,
    color: '#4b5563',
  },
  metaTextNight: {
    color: '#a7bac8',
  },
  smallButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c6e8d2',
    borderRadius: 8,
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  deleteDiaryButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d58f86',
    borderRadius: 8,
    backgroundColor: '#fff4f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteDiaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9f2d20',
  },
  sortRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  timelineStickyWrap: {
    marginTop: -2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 12,
    backgroundColor: '#fffdf8',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  timelineStickyWrapNight: {
    borderColor: '#2b3f47',
    backgroundColor: 'rgba(16,27,34,0.88)',
  },
  timelineChipRow: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  timelineChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7c593',
    backgroundColor: '#f7f2e7',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timelineChipNight: {
    borderColor: '#41555d',
    backgroundColor: '#14232d',
  },
  timelineChipActive: {
    borderColor: '#2f6b3f',
    backgroundColor: '#e5efdf',
  },
  timelineChipActiveNight: {
    borderColor: '#5fbe8a',
    backgroundColor: '#1f3843',
  },
  timelineChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2f6b3f',
  },
  timelineChipTextNight: {
    color: '#c7f6d6',
  },
  timelineChipTextActive: {
    color: '#1f5d35',
  },
  sortLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginRight: 2,
  },
  sortLabelNight: {
    color: '#93a7b3',
  },
  sortChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7c593',
    backgroundColor: '#f7f2e7',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  sortChipNight: {
    borderColor: '#41555d',
    backgroundColor: '#14232d',
  },
  sortChipActive: {
    borderColor: '#2f6b3f',
    backgroundColor: '#e5efdf',
  },
  sortChipText: {
    fontSize: 11,
    color: '#2f6b3f',
    fontWeight: '600',
  },
  sortChipTextNight: {
    color: '#c7f6d6',
  },
  sortChipTextActive: {
    color: '#1f5d35',
  },
  coverEditorCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2d7c2',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fffefb',
  },
  coverEditorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f5d35',
    marginBottom: 8,
  },
  coverEditorHelper: {
    fontSize: 12,
    color: '#6b7280',
  },
  coverPreview: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#e5e7eb',
  },
  coverCandidatesRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  coverCandidateCard: {
    width: 112,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#d7c593',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f7f2e7',
  },
  coverCandidateCardActive: {
    borderColor: '#2f6b3f',
    backgroundColor: '#e5efdf',
  },
  coverCandidateImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#e5e7eb',
  },
  coverCandidateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2f6b3f',
    textAlign: 'center',
    paddingVertical: 6,
  },
  coverCandidateLabelActive: {
    color: '#1f5d35',
  },
  coverResetButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#caa05b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fcf8ef',
  },
  coverResetButtonText: {
    fontSize: 11,
    color: '#8a6d3b',
    fontWeight: '700',
  },
  coverButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7c593',
    backgroundColor: '#f7f2e7',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  coverButtonActive: {
    borderColor: '#2f6b3f',
    backgroundColor: '#e5efdf',
  },
  coverButtonText: {
    fontSize: 11,
    color: '#2f6b3f',
    fontWeight: '700',
  },
  coverButtonTextActive: {
    color: '#1f5d35',
  },
  entryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  removeEntryButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d58f86',
    backgroundColor: '#fff4f2',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  removeEntryButtonText: {
    fontSize: 11,
    color: '#9f2d20',
    fontWeight: '700',
  },
  entryCard: {
    backgroundColor: '#fffefb',
    borderWidth: 1,
    borderColor: '#e2d7c2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  entryCardNight: {
    backgroundColor: 'rgba(13,24,31,0.9)',
    borderColor: '#2b3f47',
  },
  entryCardVisitor: {
    marginBottom: 14,
    paddingBottom: 14,
  },
  visitorTimelineSection: {
    marginTop: 4,
    marginBottom: 8,
    gap: 10,
  },
  visitorMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  visitorMediaTile: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d8ccb3',
    backgroundColor: '#f5efe3',
    minWidth: 100,
  },
  visitorMediaTileNight: {
    borderColor: '#32464f',
    backgroundColor: '#13232c',
  },
  visitorMediaImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#e5e7eb',
  },
  visitorVideoPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  visitorVideoPlaceholderNight: {
    backgroundColor: '#0a1118',
  },
  visitorVideoPlay: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  visitorVideoLabel: {
    color: '#c9d5df',
    fontSize: 12,
    fontWeight: '700',
  },
  visitorVideoLabelNight: {
    color: '#a8bccb',
  },
  visitorPreviewText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#344153',
  },
  visitorPreviewTextNight: {
    color: '#bfd0db',
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f5d35',
  },
  entryTitleNight: {
    color: '#d5f5df',
  },
  entryMeta: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 11,
    color: '#8a6d3b',
  },
  entryMetaNight: {
    color: '#8fa4b1',
  },
  storageInfoBox: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2d7c2',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#f8f5ed',
  },
  storageInfoBoxNight: {
    borderColor: '#31434c',
    backgroundColor: '#14232d',
  },
  storageLine: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  storageLineNight: {
    color: '#9eb2bf',
  },
  storageValue: {
    color: '#1f5d35',
    fontWeight: '700',
  },
  storageValueNight: {
    color: '#c6f3d6',
  },
  storageLinkButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#d7c593',
    backgroundColor: '#fffdf8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  storageLinkButtonNight: {
    borderColor: '#3f555b',
    backgroundColor: '#0f1b24',
  },
  storageLinkText: {
    fontSize: 11,
    color: '#2f6b3f',
    fontWeight: '700',
  },
  storageLinkTextNight: {
    color: '#c6f3d6',
  },
  entryEditWrap: {
    marginBottom: 6,
  },
  entryEditRow: {
    flexDirection: 'row',
    gap: 6,
  },
  entryInput: {
    borderWidth: 1,
    borderColor: '#d7ccb4',
    backgroundColor: '#fffdf8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#1f2937',
  },
  entryInputPhase: {
    flex: 1,
  },
  entryInputWeek: {
    width: 84,
  },
  templatesRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  templateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7c593',
    backgroundColor: '#f7f2e7',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  templateChipActive: {
    borderColor: '#2f6b3f',
    backgroundColor: '#e5efdf',
  },
  templateChipText: {
    fontSize: 10,
    color: '#2f6b3f',
    fontWeight: '600',
  },
  templateChipTextActive: {
    color: '#1f5d35',
  },
});
