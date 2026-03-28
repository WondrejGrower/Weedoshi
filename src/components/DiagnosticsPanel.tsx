import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { nostrClient } from '../lib/nostrClient';
import { eventDeduplicator } from '../lib/eventDeduplicator';
import { eventValidator } from '../lib/eventValidator';
import { eventCache } from '../lib/eventCache';
import { batchRequestManager } from '../lib/batchRequestManager';
import type { RelayHealth } from '../lib/relayHealthMonitor';
import { perfMonitor } from '../lib/perfMonitor';

export function DiagnosticsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setTick] = useState(0);

  const relayHealth = nostrClient.getRelayHealth();
  const relayStats = nostrClient.getRelayStats();
  const dedupStats = eventDeduplicator.getStats();
  const validatorStats = eventValidator.getStats();
  const cacheStats = eventCache.getStats();
  const batchStats = batchRequestManager.getStats();
  const perfStats = perfMonitor.getSnapshot();

  useEffect(() => {
    if (!isExpanded) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isExpanded]);

  const getStatusEmoji = (status: RelayHealth['status']) => {
    switch (status) {
      case 'connected':
        return '✅';
      case 'slow':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  if (!isExpanded) {
    return (
      <TouchableOpacity
        style={styles.collapsedPanel}
        onPress={() => setIsExpanded(true)}
      >
        <Text style={styles.collapsedTitle}>📊 Diagnostics</Text>
        <Text style={styles.collapsedSummary}>
          {relayStats.connectedRelays}/{relayStats.totalRelays} relays • {dedupStats.uniqueEvents} events
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Diagnostics Dashboard</Text>
        <TouchableOpacity
          style={styles.collapseBtn}
          onPress={() => setIsExpanded(false)}
        >
          <Text style={styles.collapseBtnText}>Collapse</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Relay Stats Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Relay Network</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{relayStats.connectedRelays}</Text>
              <Text style={styles.statLabel}>Connected</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{relayStats.slowRelays}</Text>
              <Text style={styles.statLabel}>Slow</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{relayStats.errorRelays}</Text>
              <Text style={styles.statLabel}>Errors</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {relayStats.avgLatency === null ? '—' : `${relayStats.avgLatency}ms`}
              </Text>
              <Text style={styles.statLabel}>Avg Latency</Text>
            </View>
          </View>
        </View>

        {/* Individual Relay Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔌 Individual Relays</Text>
          {Array.from(relayHealth.values()).map((health) => (
            <View key={health.url} style={styles.relayCard}>
              <View style={styles.relayHeader}>
                <Text style={styles.relayEmoji}>{getStatusEmoji(health.status)}</Text>
                <Text style={styles.relayUrl} numberOfLines={1}>
                  {health.url.replace('wss://', '').replace('ws://', '')}
                </Text>
              </View>
              <View style={styles.relayStats}>
                <Text style={styles.relayStatText}>
                  Latency: {health.avgLatency > 0 ? `${health.avgLatency}ms` : '—'}
                </Text>
                <Text style={styles.relayStatText}>
                  Events: {health.eventsReceived}
                </Text>
                <Text style={styles.relayStatText}>
                  Success: {health.successRate}%
                </Text>
              </View>
              {health.lastError && (
                <Text style={styles.errorText} numberOfLines={1}>
                  {health.lastError}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Deduplication Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Deduplication</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{dedupStats.uniqueEvents}</Text>
              <Text style={styles.statLabel}>Unique</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{dedupStats.duplicatesFiltered}</Text>
              <Text style={styles.statLabel}>Filtered</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{dedupStats.filterRate}</Text>
              <Text style={styles.statLabel}>Filter Rate</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{dedupStats.cacheSize}</Text>
              <Text style={styles.statLabel}>Cache Size</Text>
            </View>
          </View>
        </View>

        {/* Validation Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔒 Event Validation</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{validatorStats.validEvents}</Text>
              <Text style={styles.statLabel}>Valid</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{validatorStats.invalidEvents}</Text>
              <Text style={styles.statLabel}>Invalid</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{validatorStats.validRate}</Text>
              <Text style={styles.statLabel}>Valid Rate</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{validatorStats.totalProcessed}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Cache Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Event Cache</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{cacheStats.validEvents}</Text>
              <Text style={styles.statLabel}>Valid</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{cacheStats.expiredEvents}</Text>
              <Text style={styles.statLabel}>Expired</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{cacheStats.maxSize}</Text>
              <Text style={styles.statLabel}>Max Size</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{cacheStats.ttlHours}h</Text>
              <Text style={styles.statLabel}>TTL</Text>
            </View>
          </View>
        </View>

        {/* Batch Request Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Request Batching</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{batchStats.totalBatches}</Text>
              <Text style={styles.statLabel}>Batches</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{batchStats.totalRequests}</Text>
              <Text style={styles.statLabel}>Requests</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{batchStats.avgBatchSize.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Avg Size</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{batchStats.avgLatency}ms</Text>
              <Text style={styles.statLabel}>Avg Latency</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{batchStats.totalEventsFetched}</Text>
              <Text style={styles.statLabel}>Events Fetched</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{batchRequestManager.getPendingCount()}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱ Runtime Perf</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {perfStats.feed.initialLoadMs === null ? '—' : `${perfStats.feed.initialLoadMs}ms`}
              </Text>
              <Text style={styles.statLabel}>Initial Feed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {perfStats.feed.refreshLoadMs === null ? '—' : `${perfStats.feed.refreshLoadMs}ms`}
              </Text>
              <Text style={styles.statLabel}>Refresh Feed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {perfStats.feed.firstEventMs === null ? '—' : `${perfStats.feed.firstEventMs}ms`}
              </Text>
              <Text style={styles.statLabel}>First Event</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {perfStats.ui.scrollFps === null ? '—' : perfStats.ui.scrollFps.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Scroll FPS</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{perfStats.network.queryCalls}</Text>
              <Text style={styles.statLabel}>Query Calls</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{perfStats.network.subscribeCalls}</Text>
              <Text style={styles.statLabel}>Subscribes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{perfStats.network.eventsReceived}</Text>
              <Text style={styles.statLabel}>Net Events</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {perfStats.network.avgQueryMs === null ? '—' : `${perfStats.network.avgQueryMs.toFixed(0)}ms`}
              </Text>
              <Text style={styles.statLabel}>Avg Query</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.clearBtn} onPress={() => perfMonitor.reset()}>
            <Text style={styles.clearBtnText}>Reset Perf Counters</Text>
          </TouchableOpacity>
        </View>
        {/* Best Relay */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Best Relay</Text>
          <View style={styles.bestRelayBox}>
            <Text style={styles.bestRelayText}>
              {relayStats.bestRelay !== 'none' 
                ? relayStats.bestRelay.replace('wss://', '').replace('ws://', '')
                : 'No relays connected'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedPanel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  collapsedSummary: {
    fontSize: 12,
    color: '#6b7280',
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    maxHeight: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  collapseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  },
  collapseBtnText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  clearBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#f9fafb',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  relayCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  relayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  relayEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  relayUrl: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  relayStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  relayStatText: {
    fontSize: 10,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 4,
  },
  bestRelayBox: {
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  bestRelayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
});
