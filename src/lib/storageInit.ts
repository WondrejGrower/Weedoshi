import AsyncStorage from '@react-native-async-storage/async-storage';

let isInitialized = false;

/**
 * Initialize AsyncStorage
 * This ensures storage is ready before any operations
 */
export async function initializeStorage(): Promise<void> {
  if (isInitialized) {
    console.log('📦 Storage: Already initialized, skipping');
    return;
  }

  try {
    console.log('📦 Storage: Starting initialization...');
    console.log('📦 Storage: Testing AsyncStorage availability...');

    // Test AsyncStorage is available
    const testKey = '@weedoshi:init_test';
    const testValue = 'test';

    console.log('📦 Storage: Writing test value...');
    await AsyncStorage.setItem(testKey, testValue);
    console.log('✅ Storage: Test write successful');

    console.log('📦 Storage: Reading test value...');
    const result = await AsyncStorage.getItem(testKey);
    console.log('✅ Storage: Test read successful, value:', result);

    if (result !== testValue) {
      throw new Error(`Storage test failed: expected "${testValue}", got "${result}"`);
    }

    console.log('📦 Storage: Removing test value...');
    await AsyncStorage.removeItem(testKey);
    console.log('✅ Storage: Test cleanup successful');

    isInitialized = true;
    console.log('🎉 Storage: Initialization complete!');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('🔴 Storage: Initialization failed:', errorMsg);
    console.error('🔴 Storage: Error details:', error);
    throw new Error(`AsyncStorage initialization failed: ${errorMsg}`);
  }
}

export function isStorageInitialized(): boolean {
  return isInitialized;
}