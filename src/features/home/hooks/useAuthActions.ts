import { useCallback } from 'react';
import { authManager, type AuthState, type Nip46PairingState } from '../../../lib/authManager';
import type { NostrProfileMetadata } from '../../../lib/nostrClient';

type UseAuthActionsParams = {
  activeAuthTab: 'nsec' | 'npub';
  nsecInput: string;
  npubInput: string;
  allowNsecLogin: boolean;
  nip46PairingInput: string;
  setAuthState: (state: AuthState) => void;
  setNsecInput: (value: string) => void;
  setNpubInput: (value: string) => void;
  setError: (value: string | null) => void;
  setErrorFromUnknown: (err: unknown, fallback: string) => void;
  setDiaryEditMode: (value: boolean) => void;
  setProfileMetadata: (value: NostrProfileMetadata | null) => void;
  setLastSyncedPubkey: (value: string | null) => void;
  setNip46PairingBusy: (value: boolean) => void;
  setNip46PairingState: (state: Nip46PairingState) => void;
  disableAnonymousBrowsing: () => Promise<void>;
  enableAnonymousBrowsing: () => Promise<void>;
  resetLoginPromptDismissed: () => Promise<void>;
  refreshSignerAvailability: () => void;
  refreshNip46PairingState: () => Promise<void>;
  bootstrapLoggedInSession: (pubkey: string) => Promise<void>;
};

export function useAuthActions({
  activeAuthTab,
  nsecInput,
  npubInput,
  allowNsecLogin,
  nip46PairingInput,
  setAuthState,
  setNsecInput,
  setNpubInput,
  setError,
  setErrorFromUnknown,
  setDiaryEditMode,
  setProfileMetadata,
  setLastSyncedPubkey,
  setNip46PairingBusy,
  setNip46PairingState,
  disableAnonymousBrowsing,
  enableAnonymousBrowsing,
  resetLoginPromptDismissed,
  refreshSignerAvailability,
  refreshNip46PairingState,
  bootstrapLoggedInSession,
}: UseAuthActionsParams) {
  const handleLogin = useCallback(async () => {
    try {
      setError(null);
      if (activeAuthTab === 'nsec') {
        if (!allowNsecLogin) {
          throw new Error('nsec login is disabled in web mode. Connect a browser signer.');
        }
        if (!nsecInput.trim()) throw new Error('nsec cannot be empty');
        await authManager.loginWithNsec(nsecInput.trim());
      } else {
        if (!npubInput.trim()) throw new Error('npub cannot be empty');
        await authManager.loginWithNpub(npubInput.trim());
      }

      const newState = authManager.getState();
      setAuthState(newState);
      await disableAnonymousBrowsing();
      setNsecInput('');
      setNpubInput('');
      refreshSignerAvailability();
      await refreshNip46PairingState();
      if (newState.pubkey) {
        await bootstrapLoggedInSession(newState.pubkey);
      }
    } catch (err) {
      setErrorFromUnknown(err, 'Login failed');
    }
  }, [
    activeAuthTab,
    allowNsecLogin,
    bootstrapLoggedInSession,
    disableAnonymousBrowsing,
    npubInput,
    nsecInput,
    refreshNip46PairingState,
    refreshSignerAvailability,
    setAuthState,
    setError,
    setErrorFromUnknown,
    setNpubInput,
    setNsecInput,
  ]);

  const handleConnectSigner = useCallback(async () => {
    try {
      setError(null);
      await authManager.loginWithSignerFirst();
      const newState = authManager.getState();
      setAuthState(newState);
      await disableAnonymousBrowsing();
      refreshSignerAvailability();
      await refreshNip46PairingState();
      if (newState.pubkey) {
        await bootstrapLoggedInSession(newState.pubkey);
      }
    } catch (err) {
      setErrorFromUnknown(err, 'Failed to connect signer');
    }
  }, [
    bootstrapLoggedInSession,
    disableAnonymousBrowsing,
    refreshNip46PairingState,
    refreshSignerAvailability,
    setAuthState,
    setError,
    setErrorFromUnknown,
  ]);

  const handleConnectNip46 = useCallback(async () => {
    try {
      setError(null);
      await authManager.connectNip46Session();
      const newState = authManager.getState();
      setAuthState(newState);
      await disableAnonymousBrowsing();
      refreshSignerAvailability();
      await refreshNip46PairingState();
      if (newState.pubkey) {
        await bootstrapLoggedInSession(newState.pubkey);
      }
    } catch (err) {
      setErrorFromUnknown(err, 'Failed to connect NIP-46');
    }
  }, [
    bootstrapLoggedInSession,
    disableAnonymousBrowsing,
    refreshNip46PairingState,
    refreshSignerAvailability,
    setAuthState,
    setError,
    setErrorFromUnknown,
  ]);

  const handleDisconnectNip46 = useCallback(async () => {
    try {
      setError(null);
      await authManager.disconnectNip46Session();
      setAuthState(authManager.getState());
      refreshSignerAvailability();
      await refreshNip46PairingState();
      setDiaryEditMode(false);
      setProfileMetadata(null);
      setLastSyncedPubkey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect NIP-46');
    }
  }, [
    refreshNip46PairingState,
    refreshSignerAvailability,
    setAuthState,
    setDiaryEditMode,
    setError,
    setLastSyncedPubkey,
    setProfileMetadata,
  ]);

  const handleStartNip46Pairing = useCallback(async () => {
    try {
      setError(null);
      setNip46PairingBusy(true);
      const state = await authManager.startNip46Pairing(nip46PairingInput);
      setNip46PairingState(state);
      refreshSignerAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start NIP-46 pairing');
    } finally {
      setNip46PairingBusy(false);
    }
  }, [
    nip46PairingInput,
    refreshSignerAvailability,
    setError,
    setNip46PairingBusy,
    setNip46PairingState,
  ]);

  const handleApproveNip46Pairing = useCallback(async () => {
    try {
      setError(null);
      setNip46PairingBusy(true);
      const state = await authManager.approveNip46Pairing();
      setNip46PairingState(state);
      refreshSignerAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve NIP-46 pairing');
    } finally {
      setNip46PairingBusy(false);
    }
  }, [refreshSignerAvailability, setError, setNip46PairingBusy, setNip46PairingState]);

  const handleRefreshNip46Pairing = useCallback(async () => {
    try {
      setNip46PairingBusy(true);
      await refreshNip46PairingState();
      refreshSignerAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh NIP-46 pairing status');
    } finally {
      setNip46PairingBusy(false);
    }
  }, [
    refreshNip46PairingState,
    refreshSignerAvailability,
    setError,
    setNip46PairingBusy,
  ]);

  const handleLogout = useCallback(async () => {
    await authManager.logout();
    setAuthState(authManager.getState());
    await enableAnonymousBrowsing();
    await resetLoginPromptDismissed();
    refreshSignerAvailability();
    await refreshNip46PairingState();
    setDiaryEditMode(false);
    setProfileMetadata(null);
    setLastSyncedPubkey(null);
  }, [
    enableAnonymousBrowsing,
    refreshNip46PairingState,
    refreshSignerAvailability,
    resetLoginPromptDismissed,
    setAuthState,
    setDiaryEditMode,
    setLastSyncedPubkey,
    setProfileMetadata,
  ]);

  return {
    handleLogin,
    handleConnectSigner,
    handleConnectNip46,
    handleDisconnectNip46,
    handleStartNip46Pairing,
    handleApproveNip46Pairing,
    handleRefreshNip46Pairing,
    handleLogout,
  };
}
