import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DiagnosticsPanel } from '../../../components/DiagnosticsPanel';
import { SmartRelayPanel } from '../../../components/SmartRelayPanel';
export function SettingsPage(props: any) {
  const {
    isMobile,
    settingsSection,

    authState,
    anonymousBrowsingEnabled,
    signerAvailable,
    nip46Available,
    nip46BridgePresent,
    nip46PairingState,
    nip46PairingInput,
    nip46PairingBusy,
    setNip46PairingInput,
    handleStartNip46Pairing,
    handleRefreshNip46Pairing,
    handleApproveNip46Pairing,
    handleDisconnectNip46,
    nsecInput,
    npubInput,
    activeAuthTab,
    setActiveAuthTab,
    setNsecInput,
    setNpubInput,
    handleLogin,
    handleConnectSigner,
    enableAnonymousBrowsing,
    relayManager,
    handleToggleRelay,
    handleRemoveRelay,
    newRelay,
    setNewRelay,
    handleAddRelay,
    hashtags,
    handleRemoveHashtag,
    newHashtag,
    setNewHashtag,
    handleAddHashtag,
    features,
    onlyGrowmies,
    growmiesStore,
    hydrateGrowmiesState,
    setError,
    isReadOnlyBlocked,
    readOnlyBlockHint,
    relayUrls,
    growmies,
    feedAuthorNames,
  } = props;

  const styles = localStyles;

  return (
    <ScrollView style={styles.pageContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.pageInner, isMobile && styles.pageInnerMobile]}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Settings</Text>
          <Text style={styles.statusText}>
            {settingsSection === 'authentication' && 'Authentication'}
            {settingsSection === 'relays' && 'Relays'}
            {settingsSection === 'hashtags' && 'Hashtags'}
            {settingsSection === 'growmies' && 'Growmies'}
          </Text>
        </View>

        {settingsSection === 'authentication' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Authentication</Text>
            {!authState.isLoggedIn ? (
              <>
                {anonymousBrowsingEnabled && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      Anonymous mode active: feed browsing is enabled without login.
                    </Text>
                  </View>
                )}

                {signerAvailable ? (
                  <View>
                    <TouchableOpacity style={styles.button} onPress={handleConnectSigner}>
                      <Text style={styles.buttonText}>Login with Alby</Text>
                    </TouchableOpacity>
                    <Text style={styles.signerHint}>Preferred login path on this device.</Text>
                  </View>
                ) : (
                  <View>
                    <TouchableOpacity style={styles.button} onPress={handleConnectSigner}>
                      <Text style={styles.buttonText}>Login with Signer (NIP-07/NIP-46)</Text>
                    </TouchableOpacity>
                    <Text style={styles.signerHint}>
                      Primary path: signer-first auth.
                    </Text>
                    <Text style={styles.signerHint}>
                      Secondary path: local signer via nsec. Read-only path: npub.
                    </Text>
                  </View>
                )}

                {(nip46Available || nip46BridgePresent) && (
                  <View style={styles.nip46PairingCard}>
                    <Text style={styles.nip46PairingTitle}>NIP-46 Pairing</Text>
                    <Text style={styles.signerHint}>
                      Current status: {nip46PairingState.phase}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Paste bunker:// URI or pairing code (optional)"
                      placeholderTextColor="#999"
                      value={nip46PairingInput}
                      onChangeText={setNip46PairingInput}
                    />
                    <View style={styles.nip46PairingActions}>
                      <TouchableOpacity
                        style={styles.buttonSecondary}
                        onPress={handleStartNip46Pairing}
                        disabled={nip46PairingBusy}
                      >
                        <Text style={styles.buttonText}>
                          {nip46PairingBusy ? 'Pairing...' : 'Start Pairing'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={handleRefreshNip46Pairing}
                        disabled={nip46PairingBusy}
                      >
                        <Text style={styles.buttonText}>Refresh</Text>
                      </TouchableOpacity>
                    </View>
                    {nip46PairingState.phase === 'pairing' && (
                      <TouchableOpacity
                        style={styles.buttonSecondary}
                        onPress={handleApproveNip46Pairing}
                        disabled={nip46PairingBusy}
                      >
                        <Text style={styles.buttonText}>
                          {nip46PairingBusy ? 'Approving...' : 'Approve Pairing'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {!!nip46PairingState.connectionUri && (
                      <Text style={styles.nip46PairingMono}>{nip46PairingState.connectionUri}</Text>
                    )}
                    {!!nip46PairingState.code && (
                      <Text style={styles.nip46PairingMono}>Code: {nip46PairingState.code}</Text>
                    )}
                    {!!nip46PairingState.message && (
                      <Text style={styles.signerHint}>{nip46PairingState.message}</Text>
                    )}
                  </View>
                )}

                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, activeAuthTab === 'nsec' && styles.activeTab]}
                    onPress={() => setActiveAuthTab('nsec')}
                  >
                    <Text style={[styles.tabText, activeAuthTab === 'nsec' && styles.activeTabText]}>
                      Local signer (nsec)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeAuthTab === 'npub' && styles.activeTab]}
                    onPress={() => setActiveAuthTab('npub')}
                  >
                    <Text style={[styles.tabText, activeAuthTab === 'npub' && styles.activeTabText]}>
                      Read-only (npub)
                    </Text>
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

                <TouchableOpacity style={styles.buttonSecondary} onPress={handleLogin}>
                  <Text style={styles.buttonText}>
                    {activeAuthTab === 'nsec' ? 'Login with Local Signer' : 'Continue Read-only'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.buttonSecondary} onPress={enableAnonymousBrowsing}>
                  <Text style={styles.buttonText}>Browse as Anonymous</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View>
                <Text style={styles.statusText}>Connected as {authState.method}</Text>
                <TouchableOpacity style={styles.buttonSecondary} onPress={props.handleLogout}>
                  <Text style={styles.buttonText}>Logout to Anonymous</Text>
                </TouchableOpacity>
                {(nip46Available || nip46BridgePresent) && (
                  <TouchableOpacity style={styles.buttonSecondary} onPress={handleDisconnectNip46}>
                    <Text style={styles.buttonText}>Disconnect NIP-46</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {settingsSection === 'relays' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Relays</Text>
            {relayManager.getAllRelays().map((relay: any) => (
              <View key={relay.url} style={styles.relayItem}>
                <TouchableOpacity style={styles.checkbox} onPress={() => handleToggleRelay(relay.url)}>
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
                style={[styles.input, styles.flexInput]}
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
        )}

        {settingsSection === 'relays' && (
          <SmartRelayPanel
            allowBackgroundProbe={authState.isLoggedIn}
            onSelectionChanged={() => {
              props.setRelayUrls(relayManager.getEnabledUrls());
            }}
          />
        )}

        {settingsSection === 'hashtags' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Hashtags</Text>
            <View style={styles.hashtagContainer}>
              {hashtags.map((tag: string) => (
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
                style={[styles.input, styles.flexInput]}
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
        )}

        {!features.allowFileSystem && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Native-only features are hidden in web mode.</Text>
          </View>
        )}

        {settingsSection === 'growmies' && (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>🧑‍🌾⚙️ Growmies Settings</Text>
              <Text style={styles.statusText}>Manage your Growmies list and filtering behavior.</Text>
              <TouchableOpacity
                style={styles.buttonSecondary}
                onPress={() => {
                  growmiesStore
                    .setOnlyGrowmies(!onlyGrowmies)
                    .then(() => {
                      hydrateGrowmiesState();
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to update filter'));
                }}
              >
                <Text style={styles.buttonText}>{onlyGrowmies ? 'Disable Only Growmies' : 'Enable Only Growmies'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.buttonSecondary}
                onPress={() => {
                  if (authState.isReadOnly) {
                    setError('Growmies sync requires signer or nsec login.');
                    return;
                  }
                  growmiesStore
                    .sync(authState, relayUrls)
                    .then(() => hydrateGrowmiesState())
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Growmies sync failed'));
                }}
                disabled={isReadOnlyBlocked}
              >
                <Text style={styles.buttonText}>
                  {isReadOnlyBlocked ? 'Sync blocked (read-only)' : 'Sync Growmies to Nostr'}
                </Text>
              </TouchableOpacity>
              {readOnlyBlockHint && <Text style={styles.readOnlyGuardHint}>{readOnlyBlockHint}</Text>}
            </View>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>🧑‍🌾 Growmies Members ({growmies.length})</Text>
              {growmies.length === 0 && <Text style={styles.emptyText}>No Growmies yet. Add from feed cards.</Text>}
              {growmies.map((pubkey: string) => (
                <View key={pubkey} style={styles.relayItem}>
                  <Text style={styles.relayUrl}>{feedAuthorNames[pubkey] || pubkey}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      growmiesStore
                        .remove(pubkey)
                        .then(() => hydrateGrowmiesState())
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to remove Growmie'));
                    }}
                  >
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Credits</Text>
          <Text style={styles.statusText}>Credits: Wondrej D. Grower & LLM's</Text>
        </View>

        <DiagnosticsPanel />
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    paddingTop: 72,
    paddingBottom: 98,
  },
  pageInner: {
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  pageInnerMobile: {
    paddingHorizontal: 10,
  },
  panel: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e1d1ae',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b4d2f',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
  },
  button: {
    borderRadius: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  smallButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  signerHint: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  nip46PairingCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  nip46PairingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  nip46PairingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  nip46PairingMono: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#374151',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#1f2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dacdb3',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  flexInput: {
    flex: 1,
  },
  inputGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  relayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#059669',
    fontSize: 14,
    fontWeight: 'bold',
  },
  relayUrl: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  removeBtn: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '700',
    padding: 4,
  },
  hashtagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  hashtagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hashtagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  readOnlyGuardHint: {
    fontSize: 11,
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
