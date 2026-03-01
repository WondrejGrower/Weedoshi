// CRITICAL: Polyfills must be imported FIRST before anything else
// This ensures WebSocket and crypto are available for nostr-tools on iOS
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { initializeStorage } from '../src/lib/storageInit';
import { authManager } from '../src/lib/authManager';
import { relayManager } from '../src/lib/relayManager';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { getRuntimeMode } from '../src/runtime/mode';
import { getFeatures } from '../src/runtime/features';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      console.log('🚀 App: Starting initialization...');
      console.log('🚀 App: Platform:', require('react-native').Platform.OS);
      console.log('🚀 App: React Native version:', require('react-native').Platform.Version);

      // Verify polyfills are loaded
      console.log('🔍 App: Checking polyfills...');
      console.log('🔍 App: WebSocket available:', typeof WebSocket !== 'undefined' ? '✅ YES' : '🔴 NO');
      console.log('🔍 App: crypto.getRandomValues available:', 
        typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' ? '✅ YES' : '🔴 NO'
      );
      const runtimeMode = getRuntimeMode();
      const runtimeFeatures = getFeatures(runtimeMode);
      console.log(`🧭 Runtime self-check: mode=${runtimeMode}`, runtimeFeatures);

      // Timeout fallback - if init takes too long, proceed anyway
      const initTimeout = setTimeout(() => {
        console.warn('⚠️ App: Initialization timeout (5s) - proceeding anyway');
        setInitError('Initialization timeout - some features may not work');
        setIsReady(true);
      }, 5000);
      try {
        console.log('📦 App: Step 1/3 - Initializing storage...');
        await initializeStorage();
        console.log('✅ App: Storage initialized successfully');

        console.log('🔐 App: Step 2/3 - Loading auth state...');
        await authManager.loadState();
        console.log('✅ App: Auth state loaded');

        console.log('🔄 App: Step 3/3 - Loading relay state...');
        await relayManager.loadState();
        console.log('✅ App: Relay state loaded');

        clearTimeout(initTimeout);
        console.log('🎉 App: Initialization complete!');
        setIsReady(true);
      } catch (e) {
        clearTimeout(initTimeout);
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('🔴 App: Initialization error:', errorMsg);
        console.error('🔴 App: Error stack:', e instanceof Error ? e.stack : 'No stack');
        setInitError(errorMsg);
        setIsReady(true); // Still proceed even if storage fails
      } finally {
        try {
          console.log('👋 App: Hiding splash screen...');
          await SplashScreen.hideAsync();
          console.log('✅ App: Splash screen hidden');
        } catch (splashError) {
          console.error('⚠️ App: Failed to hide splash screen:', splashError);
        }
      }
    }

    prepare();
  }, []);

  if (!isReady) {
    console.log('⏳ App: Showing loading screen...');
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={{ marginTop: 16, color: '#6b7280' }}>Loading Weedoshi...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  console.log('✅ App: Rendering main app...');
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {initError && (
          <View style={{ backgroundColor: '#fee2e2', padding: 12 }}>
            <Text style={{ color: '#991b1b', fontSize: 12 }}>
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
        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
