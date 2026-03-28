import { getJson, setJson } from './persistentStorage';
import { publishPublicDiary, fetchPublicDiaries } from './nostrSync';
import { extractMediaFromContent, parseMediaFromEventTags } from './mediaExtraction';
const STORE_VERSION = 1;
function emptyState() {
    return {
        diaries: [],
        selectedDiaryId: null,
    };
}
function keyFor(pubkey) {
    return `diaries:${pubkey}`;
}
function nowTs() {
    return Math.floor(Date.now() / 1000);
}
function normalizeTitle(title) {
    const trimmed = title.trim();
    return trimmed.length > 0 ? trimmed : 'Untitled Diary';
}
function normalizeOptionalField(value) {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function normalizeImageUrl(value) {
    const normalized = normalizeOptionalField(value);
    if (!normalized)
        return undefined;
    if (!/^https?:\/\//i.test(normalized))
        return undefined;
    return normalized;
}
function diaryIdFromTitle(title) {
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    const base = slug || 'diary';
    return `${base}-${Date.now().toString(36)}`;
}
function fromEvent(event) {
    const tagMedia = parseMediaFromEventTags(event);
    const textMedia = extractMediaFromContent(event.content || '');
    const firstImage = tagMedia.images[0] || textMedia.images[0];
    const mediaUrls = Array.from(new Set([...tagMedia.images, ...tagMedia.videos, ...textMedia.images, ...textMedia.videos]));
    return {
        eventId: event.id,
        authorPubkey: event.pubkey,
        createdAt: event.created_at,
        contentPreview: event.content || '',
        image: firstImage,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        addedAt: nowTs(),
    };
}
class DiaryStore {
    constructor() {
        Object.defineProperty(this, "pubkey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: emptyState()
        });
    }
    async setUser(pubkey) {
        this.pubkey = pubkey;
        if (!pubkey) {
            this.state = emptyState();
            return;
        }
        const persisted = await getJson(keyFor(pubkey), null);
        if (!persisted || persisted.version !== STORE_VERSION) {
            this.state = emptyState();
            await this.persist();
            return;
        }
        this.state = persisted.state;
    }
    async persist() {
        if (!this.pubkey)
            return;
        const payload = {
            version: STORE_VERSION,
            state: this.state,
        };
        await setJson(keyFor(this.pubkey), payload);
    }
    listDiaries() {
        return [...this.state.diaries].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    getDiary(id) {
        return this.state.diaries.find((diary) => diary.id === id) || null;
    }
    getSelectedDiaryId() {
        return this.state.selectedDiaryId;
    }
    async selectDiary(id) {
        this.state.selectedDiaryId = id;
        await this.persist();
    }
    async createDiary(title, isPublic = false, details) {
        const ts = nowTs();
        const diary = {
            id: diaryIdFromTitle(title),
            title: normalizeTitle(title),
            plant: normalizeOptionalField(details?.plant),
            plantSlug: normalizeOptionalField(details?.plantSlug),
            species: normalizeOptionalField(details?.species),
            cultivar: normalizeOptionalField(details?.cultivar),
            breeder: normalizeOptionalField(details?.breeder),
            plantWikiAPointer: normalizeOptionalField(details?.plantWikiAPointer),
            phase: normalizeOptionalField(details?.phase),
            createdAt: ts,
            updatedAt: ts,
            isPublic,
            syncStatus: 'local-only',
            items: [],
        };
        this.state.diaries.unshift(diary);
        this.state.selectedDiaryId = diary.id;
        await this.persist();
        return diary;
    }
    async renameDiary(id, title) {
        const diary = this.getDiary(id);
        if (!diary)
            return;
        diary.title = normalizeTitle(title);
        diary.updatedAt = nowTs();
        if (diary.syncStatus === 'synced') {
            diary.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async updateDiaryDetails(id, details) {
        const diary = this.getDiary(id);
        if (!diary)
            return;
        if (typeof details.title === 'string') {
            diary.title = normalizeTitle(details.title);
        }
        if (typeof details.plant === 'string') {
            diary.plant = normalizeOptionalField(details.plant);
        }
        if (typeof details.plantSlug === 'string') {
            diary.plantSlug = normalizeOptionalField(details.plantSlug);
        }
        if (typeof details.species === 'string') {
            diary.species = normalizeOptionalField(details.species);
        }
        if (typeof details.cultivar === 'string') {
            diary.cultivar = normalizeOptionalField(details.cultivar);
        }
        if (typeof details.breeder === 'string') {
            diary.breeder = normalizeOptionalField(details.breeder);
        }
        if (typeof details.plantWikiAPointer === 'string') {
            diary.plantWikiAPointer = normalizeOptionalField(details.plantWikiAPointer);
        }
        if (typeof details.phase === 'string') {
            diary.phase = normalizeOptionalField(details.phase);
        }
        diary.updatedAt = nowTs();
        if (diary.syncStatus === 'synced') {
            diary.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async setDiaryCoverImage(id, coverImage) {
        const diary = this.getDiary(id);
        if (!diary)
            return;
        const normalized = normalizeImageUrl(coverImage);
        if (diary.coverImage === normalized)
            return;
        diary.coverImage = normalized;
        diary.updatedAt = nowTs();
        if (diary.syncStatus === 'synced') {
            diary.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async deleteDiary(id) {
        this.state.diaries = this.state.diaries.filter((diary) => diary.id !== id);
        if (this.state.selectedDiaryId === id) {
            this.state.selectedDiaryId = this.state.diaries[0]?.id || null;
        }
        await this.persist();
    }
    async setDiaryPublic(id, isPublic) {
        const diary = this.getDiary(id);
        if (!diary)
            return;
        diary.isPublic = isPublic;
        diary.updatedAt = nowTs();
        if (!isPublic) {
            diary.syncStatus = 'local-only';
            diary.syncError = undefined;
        }
        await this.persist();
    }
    async addItemToDiary(diaryId, event, phaseLabel) {
        const diary = this.getDiary(diaryId);
        if (!diary)
            return;
        if (diary.items.some((item) => item.eventId === event.id)) {
            return;
        }
        const ref = fromEvent(event);
        ref.phaseLabel = normalizeOptionalField(phaseLabel);
        diary.items.unshift(ref);
        if (!diary.coverImage && ref.image) {
            diary.coverImage = normalizeImageUrl(ref.image);
        }
        diary.updatedAt = nowTs();
        if (diary.syncStatus === 'synced') {
            diary.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async setDiaryItemPhaseLabels(diaryId, labelsByEventId) {
        const diary = this.getDiary(diaryId);
        if (!diary)
            return;
        const labelKeys = new Set(Object.keys(labelsByEventId));
        if (labelKeys.size === 0)
            return;
        let changed = false;
        for (const item of diary.items) {
            if (!labelKeys.has(item.eventId)) {
                continue;
            }
            const next = normalizeOptionalField(labelsByEventId[item.eventId]);
            if (next !== item.phaseLabel) {
                item.phaseLabel = next;
                changed = true;
            }
        }
        if (!changed)
            return;
        diary.updatedAt = nowTs();
        if (diary.syncStatus === 'synced') {
            diary.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async setDiaryItemOrder(diaryId, orderedEventIds) {
        const diary = this.getDiary(diaryId);
        if (!diary)
            return;
        const requested = orderedEventIds.filter(Boolean);
        if (requested.length === 0)
            return;
        const itemById = new Map(diary.items.map((item) => [item.eventId, item]));
        const seen = new Set();
        const reordered = [];
        for (const eventId of requested) {
            if (seen.has(eventId))
                continue;
            const item = itemById.get(eventId);
            if (!item)
                continue;
            reordered.push(item);
            seen.add(eventId);
        }
        for (const item of diary.items) {
            if (!seen.has(item.eventId)) {
                reordered.push(item);
            }
        }
        const changed = reordered.some((item, index) => diary.items[index]?.eventId !== item.eventId);
        if (!changed)
            return;
        diary.items = reordered;
        diary.updatedAt = nowTs();
        if (diary.syncStatus === 'synced') {
            diary.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async removeItemFromDiary(diaryId, eventId) {
        const diary = this.getDiary(diaryId);
        if (!diary)
            return;
        diary.items = diary.items.filter((item) => item.eventId !== eventId);
        diary.updatedAt = nowTs();
        if (diary.syncStatus === 'synced') {
            diary.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async syncPublicDiary(diaryId, authState, relayUrls) {
        const diary = this.getDiary(diaryId);
        if (!diary || !diary.isPublic)
            return;
        diary.syncStatus = 'syncing';
        diary.syncError = undefined;
        await this.persist();
        try {
            await publishPublicDiary(diary, authState, relayUrls);
            diary.syncStatus = 'synced';
            diary.lastSyncedAt = nowTs();
            diary.syncError = undefined;
            await this.persist();
        }
        catch (error) {
            diary.syncStatus = 'error';
            diary.syncError = error instanceof Error ? error.message : 'Sync failed';
            await this.persist();
            throw error;
        }
    }
    mergeRemoteDiary(remote) {
        const existing = this.state.diaries.find((diary) => diary.id === remote.id);
        if (!existing) {
            this.state.diaries.push({
                ...remote,
                syncStatus: 'synced',
            });
            return true;
        }
        const localIsNewer = existing.updatedAt >= remote.updatedAt;
        if (localIsNewer && existing.items.length >= remote.items.length) {
            return false;
        }
        existing.title = remote.title;
        existing.plant = normalizeOptionalField(remote.plant);
        existing.plantSlug = normalizeOptionalField(remote.plantSlug);
        existing.species = normalizeOptionalField(remote.species);
        existing.cultivar = normalizeOptionalField(remote.cultivar);
        existing.breeder = normalizeOptionalField(remote.breeder);
        existing.plantWikiAPointer = normalizeOptionalField(remote.plantWikiAPointer);
        existing.phase = normalizeOptionalField(remote.phase);
        existing.coverImage = normalizeImageUrl(remote.coverImage);
        existing.items = remote.items;
        existing.updatedAt = remote.updatedAt;
        existing.isPublic = true;
        existing.syncStatus = 'synced';
        existing.lastSyncedAt = nowTs();
        existing.syncError = undefined;
        return true;
    }
    async mergePublicDiariesFromRelays(pubkey, relayUrls) {
        if (!pubkey || relayUrls.length === 0)
            return 0;
        const remote = await fetchPublicDiaries(pubkey, relayUrls);
        let changed = 0;
        for (const entry of remote) {
            if (this.mergeRemoteDiary(entry)) {
                changed++;
            }
        }
        if (changed > 0) {
            await this.persist();
        }
        return changed;
    }
}
export const diaryStore = new DiaryStore();
