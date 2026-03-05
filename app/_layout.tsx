// CRITICAL: Polyfills must be imported FIRST before anything else
// This ensures WebSocket and crypto are available for nostr-tools on iOS
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { initializeStorage } from '../src/lib/storageInit';
import { authManager } from '../src/lib/authManager';
import { relayManager } from '../src/lib/relayManager';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { getRuntimeMode } from '../src/runtime/mode';
import { getFeatures } from '../src/runtime/features';
import { logger } from '../src/lib/logger';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      logger.info('🚀 App: Starting initialization...');
      logger.info('🚀 App: Platform:', require('react-native').Platform.OS);
      logger.info('🚀 App: React Native version:', require('react-native').Platform.Version);

      // Verify polyfills are loaded
      logger.info('🔍 App: Checking polyfills...');
      logger.info('🔍 App: WebSocket available:', typeof WebSocket !== 'undefined' ? '✅ YES' : '🔴 NO');
      logger.info('🔍 App: crypto.getRandomValues available:', 
        typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' ? '✅ YES' : '🔴 NO'
      );
      const runtimeMode = getRuntimeMode();
      const runtimeFeatures = getFeatures(runtimeMode);
      logger.info(`🧭 Runtime self-check: mode=${runtimeMode}`, runtimeFeatures);

      // Timeout fallback - if init takes too long, proceed anyway
      const initTimeout = setTimeout(() => {
        logger.warn('⚠️ App: Initialization timeout (5s) - proceeding anyway');
        setInitError('Initialization timeout - some features may not work');
        setIsReady(true);
      }, 5000);
      try {
        logger.info('📦 App: Step 1/3 - Initializing storage...');
        await initializeStorage();
        logger.info('✅ App: Storage initialized successfully');

        logger.info('🔐 App: Step 2/3 - Loading auth state...');
        await authManager.loadState();
        logger.info('✅ App: Auth state loaded');

        logger.info('🔄 App: Step 3/3 - Loading relay state...');
        await relayManager.loadState();
        logger.info('✅ App: Relay state loaded');

        clearTimeout(initTimeout);
        logger.info('🎉 App: Initialization complete!');
        setIsReady(true);
      } catch (e) {
        clearTimeout(initTimeout);
        const errorMsg = e instanceof Error ? e.message : String(e);
        logger.error('🔴 App: Initialization error:', errorMsg);
        logger.error('🔴 App: Error stack:', e instanceof Error ? e.stack : 'No stack');
        setInitError(errorMsg);
        setIsReady(true); // Still proceed even if storage fails
      } finally {
        try {
          logger.info('👋 App: Hiding splash screen...');
          await SplashScreen.hideAsync();
          logger.info('✅ App: Splash screen hidden');
        } catch (splashError) {
          logger.error('⚠️ App: Failed to hide splash screen:', splashError);
        }
      }
    }

    prepare();
  }, []);

  if (!isReady) {
    logger.info('⏳ App: Showing loading screen...');
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Loading Weedoshi...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  logger.info('✅ App: Rendering main app...');
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        {initError && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ Init warning: {initError}
            </Text>
          </View>
        )}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#fff' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="diary/[id]" />
          <Stack.Screen name="plant/[slug]" />
        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
  },
  warningBanner: {
    backgroundColor: '#fee2e2',
    padding: 12,
  },
  warningText: {
    color: '#991b1b',
    fontSize: 12,
  },
});
