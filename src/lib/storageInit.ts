import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

let isInitialized = false;

/**
 * Initialize AsyncStorage
 * This ensures storage is ready before any operations
 */
export async function initializeStorage(): Promise<void> {
  if (isInitialized) {
    logger.info('📦 Storage: Already initialized, skipping');
    return;
  }

  try {
    logger.info('📦 Storage: Starting initialization...');
    logger.info('📦 Storage: Testing AsyncStorage availability...');

    // Test AsyncStorage is available
    const testKey = '@weedoshi:init_test';
    const testValue = 'test';

    logger.info('📦 Storage: Writing test value...');
    await AsyncStorage.setItem(testKey, testValue);
    logger.info('✅ Storage: Test write successful');

    logger.info('📦 Storage: Reading test value...');
    const result = await AsyncStorage.getItem(testKey);
    logger.info('✅ Storage: Test read successful, value:', result);

    if (result !== testValue) {
      throw new Error(`Storage test failed: expected "${testValue}", got "${result}"`);
    }

    logger.info('📦 Storage: Removing test value...');
    await AsyncStorage.removeItem(testKey);
    logger.info('✅ Storage: Test cleanup successful');

    isInitialized = true;
    logger.info('🎉 Storage: Initialization complete!');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('🔴 Storage: Initialization failed:', errorMsg);
    logger.error('🔴 Storage: Error details:', error);
    throw new Error(`AsyncStorage initialization failed: ${errorMsg}`);
  }
}

export function isStorageInitialized(): boolean {
  return isInitialized;
}