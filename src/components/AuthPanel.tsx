import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { authManager } from '../lib/authManager';
import type { AuthState } from '../lib/authManager';

interface AuthPanelProps {
  authState: AuthState;
  onAuthChange: () => void;
}

export function AuthPanel({ authState, onAuthChange }: AuthPanelProps) {
  const [nsecInput, setNsecInput] = useState('');
  const [npubInput, setNpubInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'nsec' | 'npub'>('nsec');

  const handleNsecLogin = async () => {
    setError(null);
    try {
      if (!nsecInput.trim()) {
        setError('Please enter your nsec key');
        return;
      }
      await authManager.loginWithNsec(nsecInput);
      setNsecInput('');
      onAuthChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    }
  };

  const handleNpubLogin = async () => {
    setError(null);
    try {
      if (!npubInput.trim()) {
        setError('Please enter your npub key');
        return;
      }
      await authManager.loginWithNpub(npubInput);
      setNpubInput('');
      onAuthChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    }
  };

  const handleLogout = async () => {
    await authManager.logout();
    onAuthChange();
  };

  if (authState.isLoggedIn) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>🔐 Authentication</Text>
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Logged in {authState.isReadOnly ? '(read-only)' : ''}</Text>
          <Text style={styles.pubkey}>{authState.pubkey?.substring(0, 16)}...</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.btnText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>🔐 Authentication</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'nsec' && styles.activeTab]}
          onPress={() => setActiveTab('nsec')}
        >
          <Text style={styles.tabText}>nsec</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'npub' && styles.activeTab]}
          onPress={() => setActiveTab('npub')}
        >
          <Text style={styles.tabText}>npub (read-only)</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'nsec' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Paste your nsec key here..."
            placeholderTextColor="#999"
            value={nsecInput}
            onChangeText={setNsecInput}
            secureTextEntry
            multiline
          />
          <TouchableOpacity style={styles.button} onPress={handleNsecLogin}>
            <Text style={styles.btnText}>Login with nsec</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Paste your npub key here..."
            placeholderTextColor="#999"
            value={npubInput}
            onChangeText={setNpubInput}
            multiline
          />
          <Text style={styles.hint}>Read-only access. Cannot publish notes.</Text>
          <TouchableOpacity style={styles.button} onPress={handleNpubLogin}>
            <Text style={styles.btnText}>Login with npub</Text>
          </TouchableOpacity>
        </>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
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
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 5,
  },
  activeTab: {
    backgroundColor: '#059669',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
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
    minHeight: 60,
  },
  button: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statusBox: {
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: '#059669',
    marginBottom: 4,
  },
  pubkey: {
    fontSize: 11,
    color: '#059669',
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
  },
});