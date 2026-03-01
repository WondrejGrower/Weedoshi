import { diagnostics } from './diagnostics';

interface RetryState {
  retryCount: number;
  lastAttempt: number;
  isRetrying: boolean;
}

/**
 * ConnectionRetry handles automatic reconnection with exponential backoff
 * for failed relay connections.
 */
export class ConnectionRetry {
  private retryState: Map<string, RetryState> = new Map();
  private maxRetries = 5;
  private baseDelay = 1000; // 1 second
  private maxDelay = 32000; // 32 seconds

  /**
   * Execute a connection with retry logic
   */
  async connectWithRetry<T>(
    relay: string,
    connectFn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    const state = this.getOrCreateState(relay);

    try {
      diagnostics.log(`Connecting to ${relay} (attempt ${attempt + 1}/${this.maxRetries + 1})`, 'info');
      
      const result = await connectFn();
      
      // Success - reset retry state
      this.resetRetry(relay);
      diagnostics.log(`✅ Connected to ${relay}`, 'info');
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.log(`❌ Connection failed for ${relay}: ${errorMsg}`, 'warn');

      // Check if we should retry
      if (attempt >= this.maxRetries) {
        diagnostics.log(`Max retries (${this.maxRetries}) exceeded for ${relay}`, 'error');
        state.isRetrying = false;
        throw new Error(`Max retries exceeded for ${relay}: ${errorMsg}`);
      }

      // Calculate backoff delay with exponential growth
      const delay = this.calculateBackoff(attempt);
      diagnostics.log(`Retrying ${relay} in ${delay}ms...`, 'info');

      // Update state
      state.retryCount = attempt + 1;
      state.lastAttempt = Date.now();
      state.isRetrying = true;

      // Wait before retry
      await this.sleep(delay);

      // Retry
      return this.connectWithRetry(relay, connectFn, attempt + 1);
    }
  }

  /**
   * Calculate exponential backoff delay
   * Formula: min(baseDelay * 2^attempt, maxDelay) with jitter
   */
  private calculateBackoff(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    
    // Add jitter (±20%) to prevent thundering herd
    const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get or create retry state for a relay
   */
  private getOrCreateState(relay: string): RetryState {
    if (!this.retryState.has(relay)) {
      this.retryState.set(relay, {
        retryCount: 0,
        lastAttempt: 0,
        isRetrying: false,
      });
    }
    return this.retryState.get(relay)!;
  }

  /**
   * Reset retry state after successful connection
   */
  resetRetry(relay: string): void {
    this.retryState.delete(relay);
    diagnostics.log(`Reset retry state for ${relay}`, 'info');
  }

  /**
   * Check if a relay is currently retrying
   */
  isRetrying(relay: string): boolean {
    return this.retryState.get(relay)?.isRetrying || false;
  }

  /**
   * Get retry statistics for a relay
   */
  getRetryStats(relay: string) {
    const state = this.retryState.get(relay);
    if (!state) {
      return {
        retryCount: 0,
        isRetrying: false,
        lastAttempt: null,
      };
    }

    return {
      retryCount: state.retryCount,
      isRetrying: state.isRetrying,
      lastAttempt: state.lastAttempt > 0 ? new Date(state.lastAttempt) : null,
    };
  }

  /**
   * Get all retry states
   */
  getAllRetryStats() {
    const stats: Record<string, any> = {};
    for (const [relay, state] of this.retryState) {
      stats[relay] = {
        retryCount: state.retryCount,
        isRetrying: state.isRetrying,
        lastAttempt: new Date(state.lastAttempt),
      };
    }
    return stats;
  }

  /**
   * Clear all retry states
   */
  clear(): void {
    this.retryState.clear();
    diagnostics.log('Cleared all retry states', 'info');
  }
}

// Singleton instance
export const connectionRetry = new ConnectionRetry();
