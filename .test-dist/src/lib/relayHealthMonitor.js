import { diagnostics } from './diagnostics';
/**
 * RelayHealthMonitor tracks the health and performance of Nostr relays
 * to enable intelligent relay selection and auto-disable unreliable relays.
 */
export class RelayHealthMonitor {
    constructor() {
        Object.defineProperty(this, "health", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "latencyHistory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "maxLatencyHistory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 10
        }); // Keep last 10 measurements
        Object.defineProperty(this, "slowThreshold", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 3000
        }); // 3 seconds = slow
        Object.defineProperty(this, "failureThreshold", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 5
        }); // Auto-disable after 5 consecutive failures
    }
    /**
     * Initialize health tracking for a relay
     */
    initRelay(url) {
        if (!this.health.has(url)) {
            this.health.set(url, {
                url,
                status: 'disconnected',
                avgLatency: 0,
                successRate: 100,
                lastSuccessTime: 0,
                failureCount: 0,
                totalSuccesses: 0,
                totalFailures: 0,
                eventsReceived: 0,
                connectionAttempts: 0,
            });
            this.latencyHistory.set(url, []);
            diagnostics.log(`Initialized health tracking for ${url}`, 'info');
        }
    }
    /**
     * Record connection attempt
     */
    recordConnectionAttempt(url) {
        const health = this.health.get(url);
        if (health) {
            health.connectionAttempts++;
        }
    }
    /**
     * Record successful connection with latency
     */
    recordLatency(url, latencyMs) {
        this.initRelay(url);
        const health = this.health.get(url);
        // Add to latency history
        const history = this.latencyHistory.get(url);
        history.push(latencyMs);
        // Keep only last N measurements
        if (history.length > this.maxLatencyHistory) {
            history.shift();
        }
        // Calculate average latency
        const sum = history.reduce((a, b) => a + b, 0);
        health.avgLatency = Math.round(sum / history.length);
        // Update status based on latency
        if (health.avgLatency > this.slowThreshold) {
            health.status = 'slow';
            diagnostics.log(`Relay ${url} is slow (${health.avgLatency}ms avg)`, 'warn');
        }
        else {
            health.status = 'connected';
        }
        diagnostics.log(`Relay ${url} latency: ${latencyMs}ms (avg: ${health.avgLatency}ms)`, 'info');
    }
    /**
     * Record successful event reception
     */
    recordSuccess(url) {
        this.initRelay(url);
        const health = this.health.get(url);
        health.lastSuccessTime = Date.now();
        health.failureCount = 0; // Reset failure count on success
        health.totalSuccesses++;
        health.eventsReceived++;
        // Update success rate
        this.updateSuccessRate(url);
        if (health.status === 'error' || health.status === 'disconnected') {
            health.status = 'connected';
            diagnostics.log(`Relay ${url} recovered`, 'info');
        }
    }
    /**
     * Record a failure
     */
    recordFailure(url, error) {
        this.initRelay(url);
        const health = this.health.get(url);
        health.failureCount++;
        health.totalFailures++;
        health.lastError = error;
        // Update success rate
        this.updateSuccessRate(url);
        // Mark as error if too many failures
        if (health.failureCount >= this.failureThreshold) {
            health.status = 'error';
            diagnostics.log(`Relay ${url} marked as error after ${health.failureCount} consecutive failures`, 'error');
        }
        diagnostics.log(`Relay ${url} failure #${health.failureCount}${error ? ': ' + error : ''}`, 'warn');
    }
    /**
     * Update success rate calculation
     */
    updateSuccessRate(url) {
        const health = this.health.get(url);
        if (!health || health.connectionAttempts === 0)
            return;
        const attempts = Math.max(health.totalSuccesses + health.totalFailures, health.connectionAttempts);
        if (attempts <= 0) {
            health.successRate = 100;
            return;
        }
        health.successRate = Math.round((health.totalSuccesses / attempts) * 100);
    }
    /**
     * Check if a relay should be disabled
     */
    shouldDisableRelay(url) {
        const health = this.health.get(url);
        if (!health)
            return false;
        return (health.failureCount >= this.failureThreshold ||
            health.status === 'error');
    }
    /**
     * Get the best performing relays
     */
    getBestRelays(count = 3) {
        const relays = Array.from(this.health.values())
            .filter(h => h.status !== 'error' && h.status !== 'disconnected')
            .sort((a, b) => {
            // Score = success rate / latency (higher is better)
            const scoreA = a.successRate / (a.avgLatency || 1000);
            const scoreB = b.successRate / (b.avgLatency || 1000);
            return scoreB - scoreA;
        });
        return relays.slice(0, count).map(r => r.url);
    }
    /**
     * Get health info for a specific relay
     */
    getHealth(url) {
        return this.health.get(url);
    }
    /**
     * Get all relay health info
     */
    getAllHealth() {
        return new Map(this.health);
    }
    /**
     * Get health statistics summary
     */
    getStats() {
        const relays = Array.from(this.health.values());
        const totalRelays = relays.length;
        const connectedRelays = relays.filter(r => r.status === 'connected').length;
        const slowRelays = relays.filter(r => r.status === 'slow').length;
        const errorRelays = relays.filter(r => r.status === 'error').length;
        const totalEvents = relays.reduce((sum, r) => sum + r.eventsReceived, 0);
        const relaysWithLatency = relays.filter(r => r.avgLatency > 0);
        const avgLatency = relaysWithLatency.length > 0
            ? Math.round(relaysWithLatency.reduce((sum, r) => sum + r.avgLatency, 0) / relaysWithLatency.length)
            : null;
        return {
            totalRelays,
            connectedRelays,
            slowRelays,
            errorRelays,
            totalEvents,
            avgLatency,
            bestRelay: this.getBestRelays(1)[0] || 'none',
        };
    }
    /**
     * Reset health data for a relay
     */
    resetRelay(url) {
        this.health.delete(url);
        this.latencyHistory.delete(url);
        diagnostics.log(`Reset health tracking for ${url}`, 'info');
    }
    /**
     * Clear all health data
     */
    clear() {
        this.health.clear();
        this.latencyHistory.clear();
        diagnostics.log('Cleared all relay health data', 'info');
    }
}
// Singleton instance
export const relayHealthMonitor = new RelayHealthMonitor();
