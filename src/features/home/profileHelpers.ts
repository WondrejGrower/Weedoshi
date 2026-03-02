import type { AuthState } from '../../lib/authManager';
import type { NostrProfileMetadata } from '../../lib/nostrClient';
import type { DiaryEntry, DiaryIndex } from '../../lib/diaryManager';
const PHASE_WEEK_SEPARATOR = ' :: ';

export function getDisplayName(auth: AuthState, metadata: NostrProfileMetadata | null): string {
  if (metadata?.display_name?.trim()) return metadata.display_name.trim();
  if (metadata?.name?.trim()) return metadata.name.trim();
  if (!auth.pubkey) return 'Guest Grower';
  return `Grower ${auth.pubkey.slice(0, 6)}`;
}

export function getAvatarLabel(auth: AuthState, metadata: NostrProfileMetadata | null): string {
  if (metadata?.display_name?.trim()) return metadata.display_name.trim().slice(0, 2).toUpperCase();
  if (metadata?.name?.trim()) return metadata.name.trim().slice(0, 2).toUpperCase();
  if (!auth.pubkey) return 'WG';
  return auth.pubkey.slice(0, 2).toUpperCase();
}

export function shortPubkey(pubkey: string | null): string {
  if (!pubkey) return 'Not connected';
  return `${pubkey.slice(0, 10)}...${pubkey.slice(-8)}`;
}

export function groupDiaryEntries(
  diaryDraft: DiaryIndex | null
): Array<{ chapter: string; label: string; entries: DiaryEntry[] }> {
  if (!diaryDraft) return [];

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
    label: chapterLabelMap.get(chapter) || formatDiaryChapterLabel(chapter),
    entries: entriesInChapter,
  }));
}

function formatDiaryChapterLabel(value: string): string {
  if (!value) return 'General';
  if (!value.includes(PHASE_WEEK_SEPARATOR)) return value;
  const [phase, week] = value.split(PHASE_WEEK_SEPARATOR);
  const left = phase?.trim() || '';
  const right = week?.trim() || '';
  if (left && right) {
    return `${left} • Week ${right}`;
  }
  return left || right || 'General';
}
