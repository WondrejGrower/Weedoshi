import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DiagnosticsPanel } from '../../../components/DiagnosticsPanel';
import { SmartRelayPanel } from '../../../components/SmartRelayPanel';

export function SettingsPage(props: any) {
  const {
    styles,
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
