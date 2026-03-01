import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { nostrClient } from '../src/lib/nostrClient';
import { authManager } from '../src/lib/authManager';
import { relayManager } from '../src/lib/relayManager';
import { filterAndDeduplicateEvents } from '../src/lib/eventFilter';
import { DiagnosticsPanel } from '../src/components/DiagnosticsPanel';
import { ReactionBar } from '../src/components/ReactionBar';
import { ThreadIndicator } from '../src/components/ThreadIndicator';
import { SmartRelayPanel } from '../src/components/SmartRelayPanel';
import { reactionManager } from '../src/lib/reactionManager';
import { threadManager } from '../src/lib/threadManager';
import type { NostrEvent } from '../src/lib/nostrClient';
import type { AuthState } from '../src/lib/authManager';
import type { FilteredEvent } from '../src/lib/eventFilter';

const DEFAULT_HASHTAGS = ['weedstr', 'weed', 'cannabis', 'grow', 'livingsoil'];

export default function HomeScreen() {
  const [authState, setAuthState] = useState<AuthState>(authManager.getState());
  const [relayUrls, setRelayUrls] = useState<string[]>(relayManager.getEnabledUrls());
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS);
  const [events, setEvents] = useState<FilteredEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSubId, setCurrentSubId] = useState<string | null>(null);

  // Inputs for new relay and hashtag
  const [newRelay, setNewRelay] = useState('');
  const [newHashtag, setNewHashtag] = useState('');
  const [nsecInput, setNsecInput] = useState('');
  const [npubInput, setNpubInput] = useState('');
  const [activeAuthTab, setActiveAuthTab] = useState<'nsec' | 'npub'>('nsec');

  // Component mount logging
  useEffect(() => {
    console.log('🏠 HomeScreen: Component mounted');
    console.log('🏠 HomeScreen: Auth state:', authState.isLoggedIn ? 'Logged in' : 'Logged out');
    console.log('🏠 HomeScreen: Relay URLs:', relayUrls);
    console.log('🏠 HomeScreen: Hashtags:', hashtags);

    return () => {
      console.log('🏠 HomeScreen: Component unmounting');
    };
  }, []);

  // Subscribe to feed - only on manual Refresh click
  const subscribeFeed = async () => {
    console.log('📡 HomeScreen: subscribeFeed called');
    try {
      setIsLoading(true);
      setError(null);

      if (relayUrls.length === 0) {
        console.warn('⚠️ HomeScreen: No relays enabled');
        throw new Error('No relays enabled. Please enable at least one relay.');
      }

      console.log('📡 HomeScreen: Setting relays:', relayUrls);
      nostrClient.setRelays(relayUrls);
      if (currentSubId) {
        console.log('📡 HomeScreen: Unsubscribing previous subscription:', currentSubId);
        nostrClient.unsubscribe(currentSubId);
      }

      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      const allEvents: NostrEvent[] = [];

      console.log('📡 HomeScreen: Starting subscription...');
      // Overall timeout (10 seconds)
      const overallTimeout = setTimeout(() => {
        console.warn('⚠️ HomeScreen: Overall timeout reached (10s)');
        if (allEvents.length === 0) {
          setError('⚠️ Relays not responding. Check your connection or try different relays.');
          setIsLoading(false);
        }
      }, 10000);

      const subId = await nostrClient.subscribeFeed(
        hashtags,
        sevenDaysAgo,
        (event) => {
          clearTimeout(overallTimeout);
          allEvents.push(event);
          const filtered = filterAndDeduplicateEvents(allEvents, hashtags);
          setEvents(filtered);
          setIsLoading(false);
          // Process events for threading
          threadManager.addEvents(allEvents);

          // Fetch reactions for these events
          const eventIds = filtered.map(e => e.id);
          if (eventIds.length > 0 && relayUrls.length > 0) {
            reactionManager.fetchReactions(eventIds, relayUrls).catch(err => {
              console.warn('Failed to fetch reactions:', err);
            });
          }
        },
        () => {
          // onTimeout callback from nostrClient
          console.warn('⚠️ Subscription timeout - relays may be slow or unreachable');
          if (allEvents.length === 0) {
            setError('⚠️ Relays are slow to respond. Please wait or refresh.');
          }
        }
      );

      console.log('✅ HomeScreen: Subscription created:', subId);
      setCurrentSubId(subId);

      // Stop loading after first events or timeout
      setTimeout(() => {
        if (allEvents.length > 0) {
          setIsLoading(false);
        }
      }, 3000);
    } catch (err) {
      console.error('🔴 HomeScreen: subscribeFeed error:', err);
      console.error('🔴 HomeScreen: Error stack:', err instanceof Error ? err.stack : 'No stack');
      setError(err instanceof Error ? err.message : 'Failed to subscribe to feed');
      setIsLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentSubId) {
        nostrClient.unsubscribe(currentSubId);
      }
    };
  }, [currentSubId]);

  const handleLogin = () => {
    try {
      if (activeAuthTab === 'nsec') {
        if (!nsecInput.trim()) throw new Error('nsec cannot be empty');
        authManager.loginWithNsec(nsecInput.trim());
      } else {
        if (!npubInput.trim()) throw new Error('npub cannot be empty');
        authManager.loginWithNpub(npubInput.trim());
      }
      const newState = authManager.getState();
      setAuthState(newState);
      setNsecInput('');
      setNpubInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleLogout = () => {
    authManager.logout();
    setAuthState(authManager.getState());
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
    subscribeFeed();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🌿 Weedoshi Diaries</Text>
        <Text style={styles.subtitle}>Decentralized Cannabis Community</Text>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Error Display */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Auth Panel */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>🔐 Authentication</Text>

          {authState.isLoggedIn ? (
            <View>
              <Text style={styles.statusText}>
                Logged in as {authState.isReadOnly ? '(read-only)' : '(full access)'}
              </Text>
              <Text style={styles.pubkeyText}>
                {authState.pubkey?.substring(0, 16)}...
              </Text>
              <TouchableOpacity style={styles.button} onPress={handleLogout}>
                <Text style={styles.buttonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeAuthTab === 'nsec' && styles.activeTab]}
                  onPress={() => setActiveAuthTab('nsec')}
                >
                  <Text style={[styles.tabText, activeAuthTab === 'nsec' && styles.activeTabText]}>nsec (Full)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeAuthTab === 'npub' && styles.activeTab]}
                  onPress={() => setActiveAuthTab('npub')}
                >
                  <Text style={[styles.tabText, activeAuthTab === 'npub' && styles.activeTabText]}>npub (Read-only)</Text>
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

        {/* Relay Panel */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>🔄 Relays</Text>

          {relayManager.getAllRelays().map((relay) => (
            <View key={relay.url} style={styles.relayItem}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => handleToggleRelay(relay.url)}
              >
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
              style={styles.input}
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

        {/* Smart Relay Panel */}
        <SmartRelayPanel 
          onSelectionChanged={() => {
            setRelayUrls(relayManager.getEnabledUrls());
          }}
        />
        {/* Hashtag Panel */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>#️⃣ Hashtags</Text>

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
              style={styles.input}
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

        {/* Diagnostics Panel */}
        <DiagnosticsPanel />
        {/* Feed */}
        <View style={styles.panel}>
          <View style={styles.feedHeader}>
            <Text style={styles.panelTitle}>📰 Feed</Text>
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

          {error && relayUrls.length === 0 && (
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>No relays enabled</Text>
            </View>
          )}

          {!isLoading && events.length === 0 && relayUrls.length > 0 && (
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          )}

          {events.map((event) => (
            <View key={event.id} style={styles.feedItem}>
              <Text style={styles.author}>{event.author.substring(0, 12)}...</Text>
              <Text style={styles.timestamp}>{event.timestamp}</Text>
              <Text style={styles.content}>{event.content}</Text>
              <View style={styles.tagsContainer}>
                {event.hashtags.map((tag) => (
                  <Text key={tag} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
              </View>

              {/* Reactions */}
              <ReactionBar
                eventId={event.id}
                eventAuthor={event.author}
                authState={authState}
                relayUrls={relayUrls}
                onReactionAdded={() => {
                  // Re-fetch reactions after a short delay
                  setTimeout(() => {
                    const eventIds = events.map(e => e.id);
                    reactionManager.fetchReactions(eventIds, relayUrls).catch(err => {
                      console.warn('Failed to refresh reactions:', err);
                    });
                  }, 500);
                }}
              />

              {/* Thread indicator */}
              <ThreadIndicator eventId={event.id} />
            </View>
          ))}
        </View>
      </ScrollView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
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
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 60,
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
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
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
    fontSize: 14,
    color: '#1f2937',
    marginTop: 8,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
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
});