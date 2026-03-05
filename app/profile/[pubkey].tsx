import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NostrProfileMetadata } from '../../src/lib/nostrClient';
import { nostrClient } from '../../src/lib/nostrClient';
import { relayManager } from '../../src/lib/relayManager';
import { fetchPublicDiaries, type RemoteDiary } from '../../src/lib/nostrSync';
import { shortPubkey } from '../../src/features/home/profileHelpers';
import { toErrorMessage } from '../../src/lib/errorUtils';

export default function VisitorProfilePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pubkey?: string | string[] }>();
  const pubkey = Array.isArray(params.pubkey) ? params.pubkey[0] : params.pubkey;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<NostrProfileMetadata | null>(null);
  const [diaries, setDiaries] = useState<RemoteDiary[]>([]);

  const displayName = useMemo(() => {
    if (!pubkey) return 'Unknown profile';
    const profileName = metadata?.display_name?.trim() || metadata?.name?.trim();
    return profileName || shortPubkey(pubkey);
  }, [metadata?.display_name, metadata?.name, pubkey]);

  const load = useCallback(async () => {
    if (!pubkey) {
      setError('Profile pubkey is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const relays = relayManager.getEnabledUrls();
      nostrClient.setRelays(relays);

      const [profileMetadata, publicDiaries] = await Promise.all([
        nostrClient.fetchProfileMetadata(pubkey, relays, 6500),
        fetchPublicDiaries(pubkey, relays),
      ]);
      setMetadata(profileMetadata);
      setDiaries(publicDiaries.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load public profile'));
    } finally {
      setLoading(false);
    }
  }, [pubkey]);

  useEffect(() => {
    load().catch(() => {
      // handled in callback
    });
  }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.pubkey}>{pubkey ? shortPubkey(pubkey) : 'Unknown'}</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2f6b3f" />
            <Text style={styles.helper}>Loading public profile...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && (
          <View style={styles.content}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Public diaries</Text>
              <Text style={styles.helper}>
                Visitor mode reads only diaries published as public by this user.
              </Text>
            </View>

            {diaries.length === 0 && (
              <View style={styles.panel}>
                <Text style={styles.helper}>No public diaries found.</Text>
              </View>
            )}

            {diaries.map((diary) => (
              <View key={diary.id} style={styles.diaryCard}>
                <Text style={styles.diaryTitle}>{diary.title}</Text>
                <Text style={styles.diaryMeta}>
                  {diary.plant || 'Plant not set'} • {diary.phase || 'Phase not set'}
                </Text>
                <Text style={styles.diaryMeta}>Entries: {diary.items.length}</Text>
                <TouchableOpacity
                  style={styles.openButton}
                  onPress={() =>
                    router.push(`/diary/${encodeURIComponent(diary.id)}?owner=${encodeURIComponent(pubkey || '')}` as Href)
                  }
                >
                  <Text style={styles.openButtonText}>Open diary</Text>
                </TouchableOpacity>
              </View>
            ))}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dfcfad',
    backgroundColor: '#fffdf8',
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
  backButtonText: {
    color: '#2f6b3f',
    fontWeight: '700',
    fontSize: 13,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1b4d2f',
  },
  pubkey: {
    marginTop: 4,
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'monospace',
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
    gap: 10,
  },
  panel: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 12,
    padding: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b4d2f',
  },
  diaryCard: {
    backgroundColor: '#fffefb',
    borderWidth: 1,
    borderColor: '#e2d7c2',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  diaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f5d35',
  },
  diaryMeta: {
    fontSize: 12,
    color: '#4b5563',
  },
  openButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#c6e8d2',
    borderRadius: 8,
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
});
