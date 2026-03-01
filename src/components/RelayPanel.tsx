import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { relayManager } from '../lib/relayManager';
import type { Relay } from '../lib/relayManager';

interface RelayPanelProps {
  onRelaysChange: () => void;
}

export function RelayPanel({ onRelaysChange }: RelayPanelProps) {
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleToggleRelay = (url: string) => {
    const isEnabled = relayManager.getEnabledUrls().includes(url);
    if (isEnabled) {
      relayManager.disableRelay(url);
    } else {
      relayManager.enableRelay(url);
    }
    onRelaysChange();
  };

  const handleAddRelay = () => {
    setError(null);
    try {
      if (!newRelayUrl.trim()) {
        setError('Relay URL cannot be empty');
        return;
      }
      if (!newRelayUrl.startsWith('wss://')) {
        setError('Relay URL must start with wss://');
        return;
      }
      relayManager.addRelay(newRelayUrl.trim());
      setNewRelayUrl('');
      onRelaysChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add relay');
    }
  };

  const handleRemoveRelay = (url: string) => {
    relayManager.removeRelay(url);
    onRelaysChange();
  };

  const relays = relayManager.getAllRelays();
  const enabledUrls = relayManager.getEnabledUrls();
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>🔄 Relays</Text>

      <ScrollView style={styles.relayList} showsVerticalScrollIndicator={false}>
        {relays.map((relay: Relay) => (
          <View key={relay.url} style={styles.relayItem}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => handleToggleRelay(relay.url)}
            >
              {enabledUrls.includes(relay.url) && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.relayUrl}>{relay.url}</Text>
            {relay.custom && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveRelay(relay.url)}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          placeholder="Add relay (wss://...)"
          placeholderTextColor="#999"
          value={newRelayUrl}
          onChangeText={setNewRelayUrl}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddRelay}>
          <Text style={styles.buttonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  relayList: {
    maxHeight: 200,
    marginBottom: 12,
  },
  relayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    marginBottom: 6,
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
  removeButton: {
    marginLeft: 8,
  },
  removeText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
  },
  inputGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  addButton: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});