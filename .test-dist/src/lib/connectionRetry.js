import { diagnostics } from './diagnostics';
/**
 * ConnectionRetry handles automatic reconnection with exponential backoff
 * for failed relay connections.
 */
export class ConnectionRetry {
    constructor() {
        Object.defineProperty(this, "retryState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "maxRetries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 5
        });
        Object.defineProperty(this, "maxDelay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 30000
        }); // 30 seconds
    }
    /**
     * Execute a connection with retry logic
     */
    async connectWithRetry(relay, connectFn, attempt = 0) {
        const state = this.getOrCreateState(relay);
        try {
            diagnostics.log(`Connecting to ${relay} (attempt ${attempt + 1}/${this.maxRetries + 1})`, 'info');
            const result = await connectFn();
            // Success - reset retry state
            this.resetRetry(relay);
            diagnostics.log(`✅ Connected to ${relay}`, 'info');
            return result;
        }
        catch (error) {
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
    calculateBackoff(attempt) {
        // Practical stepped backoff: 2s, 5s, 10s, 20s, 30s...
        const schedule = [2000, 5000, 10000, 20000, 30000];
        const baseDelay = schedule[Math.min(attempt, schedule.length - 1)];
        const cappedDelay = Math.min(baseDelay, this.maxDelay);
        // Add jitter (±20%) to prevent thundering herd
        const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
        return Math.floor(cappedDelay + jitter);
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get or create retry state for a relay
     */
    getOrCreateState(relay) {
        if (!this.retryState.has(relay)) {
            this.retryState.set(relay, {
                retryCount: 0,
                lastAttempt: 0,
                isRetrying: false,
            });
        }
        return this.retryState.get(relay);
    }
    /**
     * Reset retry state after successful connection
     */
    resetRetry(relay) {
        this.retryState.delete(relay);
        diagnostics.log(`Reset retry state for ${relay}`, 'info');
    }
    /**
     * Check if a relay is currently retrying
     */
    isRetrying(relay) {
        return this.retryState.get(relay)?.isRetrying || false;
    }
    /**
     * Get retry statistics for a relay
     */
    getRetryStats(relay) {
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
        const stats = {};
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
    clear() {
        this.retryState.clear();
        diagnostics.log('Cleared all retry states', 'info');
    }
}
// Singleton instance
export const connectionRetry = new ConnectionRetry();
