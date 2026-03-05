import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Event as NostrEvent } from 'nostr-tools';
import { authManager } from '../../src/lib/authManager';
import { diaryStore, type Diary } from '../../src/lib/diaryStore';
import { relayManager } from '../../src/lib/relayManager';
import { diaryManager, fetchEventsByIds } from '../../src/lib/diaryManager';
import { PostMediaRenderer } from '../../src/components/PostMediaRenderer';
import { shortPubkey } from '../../src/features/home/profileHelpers';
import { extractMediaFromContent, parseMediaFromEventTags } from '../../src/lib/mediaExtraction';
import { normalizePlantDTagSlug } from '../../src/lib/plants/catalog';

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

export default function DiaryDetailPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; entryId?: string | string[] }>();
  const diaryId = Array.isArray(params.id) ? params.id[0] : params.id;
  const focusEntryId = Array.isArray(params.entryId) ? params.entryId[0] : params.entryId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diary, setDiary] = useState<Diary | null>(null);
  const [eventsById, setEventsById] = useState<Record<string, NostrEvent>>({});
  const [editMode, setEditMode] = useState(false);
  const [entryDrafts, setEntryDrafts] = useState<Record<string, { phase: string; week: string }>>({});
  const [coverImageDraft, setCoverImageDraft] = useState<string | undefined>(undefined);
  const [sortMode, setSortMode] = useState<SortMode>('phase-flow');

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
      if (!auth.pubkey) {
        throw new Error('Login required to open diary detail.');
      }

      await diaryStore.setUser(auth.pubkey);
      const relayUrls = relayManager.getEnabledUrls();
      if (relayUrls.length > 0) {
        await diaryStore.mergePublicDiariesFromRelays(auth.pubkey, relayUrls);
      }

      const selected = diaryStore.getDiary(diaryId);
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
      setError(e instanceof Error ? e.message : 'Failed to open diary');
    } finally {
      setLoading(false);
    }
  }, [diaryId]);

  useEffect(() => {
    loadDiary().catch(() => {
      // handled in callback
    });
  }, [loadDiary]);

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
      setError(e instanceof Error ? e.message : 'Failed to save edits');
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
      setError(e instanceof Error ? e.message : 'Failed to remove entry from diary');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          {!editMode ? (
            <TouchableOpacity style={styles.editButton} onPress={() => setEditMode(true)}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelButton}
                onPress={() => {
                  setEditMode(false);
                  setCoverImageDraft(diary?.coverImage);
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
        <Text style={styles.headerTitle}>{diary?.title || 'Diary detail'}</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2f6b3f" />
            <Text style={styles.helper}>Loading diary...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && diary && (
          <View style={styles.content}>
            <View style={styles.metaCard}>
              <Text style={styles.metaTitle}>{diary.title}</Text>
              <Text style={styles.metaText}>
                {(diary.plant || 'Plant not set')} • {(diary.phase || 'Phase not set')}
              </Text>
              {diary.cultivar ? <Text style={styles.metaText}>Cultivar: {diary.cultivar}</Text> : null}
              {diary.breeder ? <Text style={styles.metaText}>Breeder: {diary.breeder}</Text> : null}
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
              <Text style={styles.metaText}>Entries: {diary.items.length}</Text>
              {diary.coverImage ? <Text style={styles.metaText}>Cover: custom image selected</Text> : null}
              {editMode && (
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
                <Text style={styles.sortLabel}>Sort</Text>
                <TouchableOpacity
                  style={[styles.sortChip, sortMode === 'phase-flow' && styles.sortChipActive]}
                  onPress={() => setSortMode('phase-flow')}
                >
                  <Text style={[styles.sortChipText, sortMode === 'phase-flow' && styles.sortChipTextActive]}>
                    Seedling → Harvest
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortChip, sortMode === 'newest' && styles.sortChipActive]}
                  onPress={() => setSortMode('newest')}
                >
                  <Text style={[styles.sortChipText, sortMode === 'newest' && styles.sortChipTextActive]}>
                    Newest
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortChip, sortMode === 'oldest' && styles.sortChipActive]}
                  onPress={() => setSortMode('oldest')}
                >
                  <Text style={[styles.sortChipText, sortMode === 'oldest' && styles.sortChipTextActive]}>
                    Oldest
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {orderedEntries.map((entry) => {
              const parsed = parsePhaseLabel(entry.phaseLabel);
              const draft = entryDrafts[entry.eventId] || parsed;
              const mediaUrl = getPrimaryMediaUrl(entry);
              const mediaUrls = getAllMediaUrls(entry);
              const fallbackTags = mediaUrls.map((url) => ['url', url] as string[]);
              const isCoverCandidate = Boolean(mediaUrl && coverImageDraft && mediaUrl === coverImageDraft);
              const mediaHost = getHostLabel(mediaUrl);
              const eventStorage = entry.content ? 'Relay event' : 'Local diary cache';
              return (
                <View key={entry.eventId} style={styles.entryCard}>
                  {!editMode ? (
                    <Text style={styles.entryTitle}>
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
                  <Text style={styles.entryMeta}>
                    {new Date((entry.content?.created_at || entry.addedAt) * 1000).toLocaleString()} •{' '}
                    {shortPubkey(entry.content?.pubkey || entry.authorPubkey)}
                  </Text>
                  <View style={styles.storageInfoBox}>
                    <Text style={styles.storageLine}>
                      Event source: <Text style={styles.storageValue}>{eventStorage}</Text>
                    </Text>
                    <Text style={styles.storageLine}>
                      Media host: <Text style={styles.storageValue}>{mediaHost || 'No media host detected'}</Text>
                    </Text>
                    {mediaUrl ? (
                      <TouchableOpacity style={styles.storageLinkButton} onPress={() => Linking.openURL(mediaUrl)}>
                        <Text style={styles.storageLinkText}>Open media source</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {editMode && (
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
                    />
                  ) : (
                    <View>
                      <PostMediaRenderer
                        content={entry.contentPreview || entry.image || ''}
                        tags={fallbackTags}
                        textNumberOfLines={0}
                        imageResizeMode="contain"
                        singleImageHeight={420}
                      />
                      <Text style={styles.helper}>Loaded from local diary cache (relay event unavailable).</Text>
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
    backgroundColor: '#f2f1eb',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dfcfad',
    backgroundColor: '#fffdf8',
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
  editButton: {
    borderWidth: 1,
    borderColor: '#d7be86',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8f4ea',
  },
  editButtonText: {
    color: '#2f6b3f',
    fontWeight: '700',
    fontSize: 13,
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
  metaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b4d2f',
  },
  metaText: {
    marginTop: 5,
    fontSize: 13,
    color: '#4b5563',
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
  sortRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  sortLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginRight: 2,
  },
  sortChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7c593',
    backgroundColor: '#f7f2e7',
    paddingHorizontal: 9,
    paddingVertical: 5,
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
  entryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f5d35',
  },
  entryMeta: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 11,
    color: '#8a6d3b',
  },
  storageInfoBox: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2d7c2',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#f8f5ed',
  },
  storageLine: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  storageValue: {
    color: '#1f5d35',
    fontWeight: '700',
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
  storageLinkText: {
    fontSize: 11,
    color: '#2f6b3f',
    fontWeight: '700',
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
