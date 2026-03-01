import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { smartRelaySelector } from '../lib/smartRelaySelector';

interface SmartRelayPanelProps {
  onSelectionChanged?: () => void;
  allowBackgroundProbe?: boolean;
}

export function SmartRelayPanel({ onSelectionChanged, allowBackgroundProbe = true }: SmartRelayPanelProps) {
  const [isAuto, setIsAuto] = useState(smartRelaySelector.isAuto());
  const [stats, setStats] = useState(smartRelaySelector.getStats());
  const [rankedRelays, setRankedRelays] = useState(smartRelaySelector.getRankedRelays());

  const refreshData = () => {
    setIsAuto(smartRelaySelector.isAuto());
    setStats(smartRelaySelector.getStats());
    setRankedRelays(smartRelaySelector.getRankedRelays());
  };

  useEffect(() => {
    let disposed = false;

    if (allowBackgroundProbe) {
      // Initial background probe on mount (non-blocking for UI)
      smartRelaySelector.refreshRelayLatency().finally(() => {
        if (!disposed) refreshData();
      });
    }

    // Refresh data and periodically apply auto smart selection
    const interval = setInterval(async () => {
      if (allowBackgroundProbe) {
        await smartRelaySelector.refreshRelayLatency();
      }
      const didUpdateSelection = smartRelaySelector.periodicUpdate();
      if (didUpdateSelection && onSelectionChanged) {
        onSelectionChanged();
      }
      refreshData();
    }, 15000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [onSelectionChanged, allowBackgroundProbe]);

  const handleToggleAuto = () => {
    if (isAuto) {
      smartRelaySelector.disableAuto();
    } else {
      smartRelaySelector.enableAuto();
      if (onSelectionChanged) {
        onSelectionChanged();
      }
    }
    refreshData();
  };

  const handleManualSelect = async () => {
    await smartRelaySelector.refreshRelayLatency(true);
    smartRelaySelector.applySmartSelection();
    if (onSelectionChanged) {
      onSelectionChanged();
    }
    refreshData();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🤖 Smart Relay Selection</Text>
          <Text style={styles.subtitle}>
            Auto-selects best 3 relays by performance
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.autoToggle, isAuto && styles.autoToggleActive]}
          onPress={handleToggleAuto}
        >
          <Text style={[styles.autoToggleText, isAuto && styles.autoToggleTextActive]}>
            {isAuto ? 'AUTO ON' : 'AUTO OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.enabledRelays}/3</Text>
          <Text style={styles.statLabel}>Enabled</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.avgLatency === '—' ? '—' : `${stats.avgLatency}ms`}</Text>
          <Text style={styles.statLabel}>Avg Latency</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.avgScore}</Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      {/* Manual trigger */}
      {!isAuto && (
        <TouchableOpacity style={styles.manualButton} onPress={handleManualSelect}>
          <Text style={styles.manualButtonText}>
            ⚡ Select Best 3 Now
          </Text>
        </TouchableOpacity>
      )}

      {/* Top relays preview */}
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Top Relays:</Text>
        {rankedRelays.slice(0, 3).map((relay, i) => (
          <View key={relay.url} style={styles.previewRelay}>
            <Text style={styles.previewRank}>#{i + 1}</Text>
            <View style={styles.previewInfo}>
              <Text style={styles.previewUrl} numberOfLines={1}>
                {relay.url.replace('wss://', '')}
              </Text>
              <Text style={styles.previewMetrics}>
                {relay.latency > 0 ? `${relay.latency.toFixed(0)}ms` : '—'} · {(relay.successRate * 100).toFixed(0)}% ·
                Score: {relay.score.toFixed(1)}
              </Text>
            </View>
            {relay.isHealthy && <Text style={styles.healthBadge}>✓</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  autoToggle: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  autoToggleActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#059669',
  },
  autoToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  autoToggleTextActive: {
    color: '#059669',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  manualButton: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  previewRelay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    gap: 8,
  },
  previewRank: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9ca3af',
    width: 28,
  },
  previewInfo: {
    flex: 1,
  },
  previewUrl: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  previewMetrics: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  healthBadge: {
    fontSize: 16,
    color: '#059669',
  },
});
