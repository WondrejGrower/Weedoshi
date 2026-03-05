import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { relayManager } from '../../src/lib/relayManager';
import { authManager } from '../../src/lib/authManager';
import { getPlantDisplayFromSlug, normalizePlantDTagSlug } from '../../src/lib/plants/catalog';
import { getWikiArticlesBySlugWithCache } from '../../src/lib/plants/wiki';
import type { WikiArticle } from '../../src/lib/plants/types';

type Params = {
  slug?: string | string[];
  name?: string | string[];
};

function markdownToLines(markdown: string): Array<{ text: string; kind: 'h1' | 'h2' | 'bullet' | 'body' }> {
  return markdown.split(/\r?\n/).map((line) => {
    const value = line.replace(/\*\*/g, '').trim();
    if (value.startsWith('## ')) {
      return { text: value.slice(3), kind: 'h2' };
    }
    if (value.startsWith('# ')) {
      return { text: value.slice(2), kind: 'h1' };
    }
    if (value.startsWith('- ') || value.startsWith('* ')) {
      return { text: `• ${value.slice(2)}`, kind: 'bullet' };
    }
    return { text: value, kind: 'body' };
  });
}

export default function PlantDetailsPage() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const rawSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const slug = normalizePlantDTagSlug(rawSlug || '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [article, setArticle] = useState<WikiArticle | null>(null);
  const [alternatives, setAlternatives] = useState<WikiArticle[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const displayName = useMemo(() => getPlantDisplayFromSlug(rawSlug, rawName), [rawName, rawSlug]);
  const markdownLines = useMemo(() => markdownToLines(article?.content || ''), [article?.content]);

  const loadWiki = useCallback(
    async (forceRefresh: boolean = false) => {
      setLoading(true);
      setError(null);
      try {
        const relays = relayManager.getEnabledUrls();
        const auth = authManager.getState();
        const result = await getWikiArticlesBySlugWithCache(slug, relays, {
          curatorPubkey: auth.pubkey || undefined,
          forceRefresh,
        });
        setArticle(result.result.bestArticle);
        setAlternatives(result.result.alternatives);
        setOfflineOnly(result.fromCache);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plant details');
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('Plant slug is missing.');
      return;
    }
    loadWiki(false).catch(() => {
      // handled in callback
    });
  }, [loadWiki, slug]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadWiki(true)}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.slug}>subject: {slug || 'n/a'}</Text>

        {loading && (
          <View style={styles.centerRow}>
            <ActivityIndicator size="small" color="#2f6b3f" />
            <Text style={styles.metaText}>Loading wiki content...</Text>
          </View>
        )}

        {!loading && error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !article && !error && (
          <Text style={styles.metaText}>No decentralized wiki article found for this plant yet.</Text>
        )}

        {offlineOnly && !loading && (
          <Text style={styles.offlineBadge}>Showing cached content (offline or relay unavailable)</Text>
        )}

        {article && (
          <View style={styles.articleCard}>
            <Text style={styles.metaText}>Source: {article.pubkey.slice(0, 12)}... • {new Date(article.createdAt * 1000).toLocaleString()}</Text>
            <Text style={styles.metaText}>a: {article.aPointer}</Text>
            <View style={styles.markdownWrap}>
              {markdownLines.map((line, index) => {
                if (!line.text) return null;
                return (
                  <Text
                    key={`${index}-${line.kind}`}
                    style={line.kind === 'h1' ? styles.h1 : line.kind === 'h2' ? styles.h2 : line.kind === 'bullet' ? styles.bullet : styles.body}
                  >
                    {line.text}
                  </Text>
                );
              })}
            </View>
          </View>
        )}

        {alternatives.length > 0 && (
          <View style={styles.altWrap}>
            <TouchableOpacity style={styles.moreButton} onPress={() => setShowAlternatives((value) => !value)}>
              <Text style={styles.moreButtonText}>{showAlternatives ? 'Hide sources' : `More sources (${alternatives.length})`}</Text>
            </TouchableOpacity>
            {showAlternatives && alternatives.map((item) => (
              <View key={item.id} style={styles.altItem}>
                <Text style={styles.metaText}>{item.pubkey.slice(0, 12)}... • {new Date(item.createdAt * 1000).toLocaleString()}</Text>
                <Text style={styles.metaText}>a: {item.aPointer}</Text>
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
    backgroundColor: '#f5f7f1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  slug: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  articleCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
    gap: 8,
  },
  markdownWrap: {
    gap: 6,
  },
  h1: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  h2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 6,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  metaText: {
    fontSize: 12,
    color: '#4b5563',
  },
  offlineBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  altWrap: {
    gap: 8,
  },
  moreButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  moreButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  altItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 10,
    gap: 4,
  },
});
