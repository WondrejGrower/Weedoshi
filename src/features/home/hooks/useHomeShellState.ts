import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { authManager } from '../../../lib/authManager';
import type { Nip46PairingState } from '../../../lib/authManager';
import { getJson, setJson } from '../../../lib/persistentStorage';
import { getFeatures } from '../../../runtime/features';
import { getRuntimeMode } from '../../../runtime/mode';

const runtimeMode = getRuntimeMode();
const features = getFeatures(runtimeMode);

const LOGIN_PROMPT_DISMISSED_KEY = 'login_prompt_dismissed_v1';
const ANONYMOUS_BROWSING_ENABLED_KEY = 'anonymous_browsing_enabled_v1';
const APP_THEME_MODE_KEY = 'app_theme_mode_v1';

export type MainPage = 'feed' | 'profile' | 'growmies' | 'settings';
export type SettingsSection = 'authentication' | 'relays' | 'hashtags' | 'growmies';
export type ThemeMode = 'day' | 'night';

type UseHomeShellStateParams = {
  isLoggedIn: boolean;
};

export function useHomeShellState({ isLoggedIn }: UseHomeShellStateParams) {
  const [activePage, setActivePage] = useState<MainPage>('feed');
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('growmies');
  const [loginPromptDismissed, setLoginPromptDismissed] = useState(false);
  const [loginPromptLoaded, setLoginPromptLoaded] = useState(false);
  const [loginPromptMenuOpen, setLoginPromptMenuOpen] = useState(false);
  const [anonymousBrowsingEnabled, setAnonymousBrowsingEnabled] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('day');
  const settingsMenuAnim = useRef(new Animated.Value(0)).current;

  const [signerAvailable, setSignerAvailable] = useState(authManager.isBrowserSignerAvailable());
  const [nip46Available, setNip46Available] = useState(authManager.isNip46SignerAvailable());
  const [nip46BridgePresent, setNip46BridgePresent] = useState(authManager.isNip46BridgePresent());
  const [nip46PairingInput, setNip46PairingInput] = useState('');
  const [nip46PairingBusy, setNip46PairingBusy] = useState(false);
  const [nip46PairingState, setNip46PairingState] = useState<Nip46PairingState>({
    phase: 'unavailable',
    connectionUri: null,
    code: null,
    message: null,
  });

  const refreshSignerAvailability = useCallback(() => {
    setSignerAvailable(authManager.isBrowserSignerAvailable());
    setNip46Available(authManager.isNip46SignerAvailable());
    setNip46BridgePresent(authManager.isNip46BridgePresent());
  }, []);

  const persistLoginPromptDismissed = useCallback(async () => {
    setLoginPromptDismissed(true);
    await setJson(LOGIN_PROMPT_DISMISSED_KEY, true);
  }, []);

  const refreshNip46PairingState = useCallback(async () => {
    const state = await authManager.getNip46PairingState();
    setNip46PairingState(state);
  }, []);

  const enableAnonymousBrowsing = useCallback(async () => {
    setAnonymousBrowsingEnabled(true);
    await setJson(ANONYMOUS_BROWSING_ENABLED_KEY, true);
    await persistLoginPromptDismissed();
    setLoginPromptMenuOpen(false);
    setActivePage('feed');
    setSettingsSection('authentication');
  }, [persistLoginPromptDismissed]);

  const disableAnonymousBrowsing = useCallback(async () => {
    setAnonymousBrowsingEnabled(false);
    await setJson(ANONYMOUS_BROWSING_ENABLED_KEY, false);
  }, []);

  const resetLoginPromptDismissed = useCallback(async () => {
    setLoginPromptDismissed(false);
    setLoginPromptMenuOpen(false);
    await setJson(LOGIN_PROMPT_DISMISSED_KEY, false);
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => {
      const next: ThemeMode = prev === 'day' ? 'night' : 'day';
      setJson(APP_THEME_MODE_KEY, next).catch(() => {
        // best-effort persistence only
      });
      return next;
    });
  }, []);

  useEffect(() => {
    refreshSignerAvailability();
  }, [refreshSignerAvailability]);

  useEffect(() => {
    let canceled = false;
    Promise.all([
      getJson<boolean>(LOGIN_PROMPT_DISMISSED_KEY, false),
      getJson<boolean>(ANONYMOUS_BROWSING_ENABLED_KEY, false),
      getJson<ThemeMode>(APP_THEME_MODE_KEY, 'day'),
    ])
      .then(([promptDismissed, anonymousEnabled, storedTheme]) => {
        if (canceled) return;
        setLoginPromptDismissed(Boolean(promptDismissed));
        setAnonymousBrowsingEnabled(Boolean(anonymousEnabled));
        setThemeMode(storedTheme === 'night' ? 'night' : 'day');
      })
      .finally(() => {
        if (canceled) return;
        setLoginPromptLoaded(true);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    Animated.timing(settingsMenuAnim, {
      toValue: settingsMenuOpen ? 1 : 0,
      duration: settingsMenuOpen ? 160 : 120,
      useNativeDriver: true,
    }).start();
  }, [settingsMenuAnim, settingsMenuOpen]);

  useEffect(() => {
    refreshNip46PairingState().catch(() => {
      // best-effort status load
    });
  }, [refreshNip46PairingState]);

  useEffect(() => {
    if (!isLoggedIn || loginPromptDismissed) return;
    persistLoginPromptDismissed().catch(() => {
      // best-effort persistence only
    });
  }, [isLoggedIn, loginPromptDismissed, persistLoginPromptDismissed]);

  useEffect(() => {
    if (!loginPromptLoaded) return;
    if (isLoggedIn) return;
    if (!anonymousBrowsingEnabled) return;
    setActivePage('feed');
  }, [anonymousBrowsingEnabled, isLoggedIn, loginPromptLoaded]);

  return {
    activePage,
    setActivePage,
    settingsMenuOpen,
    setSettingsMenuOpen,
    settingsSection,
    setSettingsSection,
    loginPromptDismissed,
    setLoginPromptDismissed,
    loginPromptLoaded,
    loginPromptMenuOpen,
    setLoginPromptMenuOpen,
    anonymousBrowsingEnabled,
    themeMode,
    toggleThemeMode,
    settingsMenuAnim,
    signerAvailable,
    nip46Available,
    nip46BridgePresent,
    nip46PairingState,
    setNip46PairingState,
    nip46PairingInput,
    setNip46PairingInput,
    nip46PairingBusy,
    setNip46PairingBusy,
    enableAnonymousBrowsing,
    disableAnonymousBrowsing,
    refreshSignerAvailability,
    refreshNip46PairingState,
    resetLoginPromptDismissed,
    allowNsecLogin: features.allowNsecLogin,
  };
}
