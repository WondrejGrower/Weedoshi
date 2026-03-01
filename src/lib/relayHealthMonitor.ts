import { diagnostics } from './diagnostics';

export interface RelayHealth {
  url: string;
  status: 'connected' | 'disconnected' | 'slow' | 'error';
  avgLatency: number;
  successRate: number;
  lastSuccessTime: number;
  failureCount: number;
  eventsReceived: number;
  connectionAttempts: number;
  lastError?: string;
}

/**
 * RelayHealthMonitor tracks the health and performance of Nostr relays
 * to enable intelligent relay selection and auto-disable unreliable relays.
 */
export class RelayHealthMonitor {
  private health: Map<string, RelayHealth> = new Map();
  private latencyHistory: Map<string, number[]> = new Map();
  private readonly maxLatencyHistory = 10; // Keep last 10 measurements
  private readonly slowThreshold = 3000; // 3 seconds = slow
  private readonly failureThreshold = 5; // Auto-disable after 5 consecutive failures

  /**
   * Initialize health tracking for a relay
   */
  initRelay(url: string): void {
    if (!this.health.has(url)) {
      this.health.set(url, {
        url,
        status: 'disconnected',
        avgLatency: 0,
        successRate: 100,
        lastSuccessTime: 0,
        failureCount: 0,
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
  recordConnectionAttempt(url: string): void {
    const health = this.health.get(url);
    if (health) {
      health.connectionAttempts++;
    }
  }

  /**
   * Record successful connection with latency
   */
  recordLatency(url: string, latencyMs: number): void {
    this.initRelay(url);
    const health = this.health.get(url)!;
    
    // Add to latency history
    const history = this.latencyHistory.get(url)!;
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
    } else {
      health.status = 'connected';
    }
    
    diagnostics.log(`Relay ${url} latency: ${latencyMs}ms (avg: ${health.avgLatency}ms)`, 'info');
  }

  /**
   * Record successful event reception
   */
  recordSuccess(url: string): void {
    this.initRelay(url);
    const health = this.health.get(url)!;
    
    health.lastSuccessTime = Date.now();
    health.failureCount = 0; // Reset failure count on success
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
  recordFailure(url: string, error?: string): void {
    this.initRelay(url);
    const health = this.health.get(url)!;
    
    health.failureCount++;
    health.lastError = error;
    
    // Update success rate
    this.updateSuccessRate(url);
    
    // Mark as error if too many failures
    if (health.failureCount >= this.failureThreshold) {
      health.status = 'error';
      diagnostics.log(
        `Relay ${url} marked as error after ${health.failureCount} consecutive failures`,
        'error'
      );
    }
    
    diagnostics.log(`Relay ${url} failure #${health.failureCount}${error ? ': ' + error : ''}`, 'warn');
  }

  /**
   * Update success rate calculation
   */
  private updateSuccessRate(url: string): void {
    const health = this.health.get(url);
    if (!health || health.connectionAttempts === 0) return;
    
    const successCount = health.connectionAttempts - health.failureCount;
    health.successRate = Math.round((successCount / health.connectionAttempts) * 100);
  }

  /**
   * Check if a relay should be disabled
   */
  shouldDisableRelay(url: string): boolean {
    const health = this.health.get(url);
    if (!health) return false;
    
    return (
      health.failureCount >= this.failureThreshold ||
      health.status === 'error'
    );
  }

  /**
   * Get the best performing relays
   */
  getBestRelays(count: number = 3): string[] {
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
  getHealth(url: string): RelayHealth | undefined {
    return this.health.get(url);
  }

  /**
   * Get all relay health info
   */
  getAllHealth(): Map<string, RelayHealth> {
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
  resetRelay(url: string): void {
    this.health.delete(url);
    this.latencyHistory.delete(url);
    diagnostics.log(`Reset health tracking for ${url}`, 'info');
  }

  /**
   * Clear all health data
   */
  clear(): void {
    this.health.clear();
    this.latencyHistory.clear();
    diagnostics.log('Cleared all relay health data', 'info');
  }
}

// Singleton instance
export const relayHealthMonitor = new RelayHealthMonitor();
