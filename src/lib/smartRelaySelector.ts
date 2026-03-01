import { relayHealthMonitor } from './relayHealthMonitor';
import { relayManager } from './relayManager';
import { diagnostics } from './diagnostics';
import { relayLatencyProbe } from './relayLatencyProbe';

interface RelayScore {
  url: string;
  score: number;
  latency: number;
  successRate: number;
  isHealthy: boolean;
}

/**
 * SmartRelaySelector automatically chooses the best relays
 * based on performance metrics (latency, success rate, stability)
 */
export class SmartRelaySelector {
  private isAutoEnabled: boolean = false;
  private maxRelays: number = 3;
  private lastSelectionTime: number = 0;
  private selectionIntervalMs: number = 60000; // Re-evaluate every minute
  private lastProbeTime: number = 0;
  private probeIntervalMs: number = 120000; // Probe at most every 2 minutes
  private probeTimeoutMs: number = 1500;
  private probeInProgress: boolean = false;

  /**
   * Calculate a performance score for a relay
   * Score = (100 - latency_penalty) * success_rate
   */
  private calculateScore(url: string): RelayScore {
    const health = relayHealthMonitor.getHealth(url);
    // Default poor score if no data
    if (!health || health.connectionAttempts === 0) {
      return {
        url,
        score: 0,
        latency: 9999,
        successRate: 0,
        isHealthy: false,
      };
    }

    const successRate = health.successRate / 100; // Convert to 0-1
    const latency = health.avgLatency;
    const isHealthy = health.status === 'connected';

    // Latency penalty: 0ms = 0 penalty, 1000ms = 50 penalty, 5000ms+ = 100 penalty
    const latencyPenalty = Math.min((latency / 100), 100);
    // Base score from latency (0-100)
    const latencyScore = Math.max(0, 100 - latencyPenalty);
    // Final score: latency score weighted by success rate
    const finalScore = latencyScore * successRate;

    // Bonus for healthy relays
    const healthBonus = isHealthy ? 1.2 : 1.0;

    return {
      url,
      score: finalScore * healthBonus,
      latency,
      successRate,
      isHealthy,
    };
  }

  /**
   * Get all relays ranked by performance
   */
  getRankedRelays(): RelayScore[] {
    const allRelays = relayManager.getAllRelays();
    const scores = allRelays.map(relay => this.calculateScore(relay.url));
    // Sort by score (highest first)
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Select the best N relays
   */
  selectBestRelays(count: number = this.maxRelays): string[] {
    const ranked = this.getRankedRelays();
    // Filter out relays with zero score (never responded)
    const viable = ranked.filter(r => r.score > 0);
    // Take top N
    const selected = viable.slice(0, count).map(r => r.url);
    diagnostics.log(
      `Smart Relay Selection: Selected ${selected.length}/${count} relays`,
      'info'
    );
    console.log('📊 Smart Relay Selection:');
    viable.slice(0, count).forEach((relay, i) => {
      console.log(
        `  ${i + 1}. ${relay.url} - Score: ${relay.score.toFixed(1)} ` +
        `(${relay.latency.toFixed(0)}ms, ${(relay.successRate * 100).toFixed(0)}%)`
      );
    });

    return selected;
  }

  /**
   * Apply smart selection (enable best relays, disable others)
   */
  applySmartSelection(): string[] {
    const bestRelays = this.selectBestRelays(this.maxRelays);
    if (bestRelays.length === 0) {
      diagnostics.log('⚠️ No viable relays found for smart selection', 'warn');
      return [];
    }

    const allRelays = relayManager.getAllRelays();
    // Enable best relays, disable others
    for (const relay of allRelays) {
      if (bestRelays.includes(relay.url)) {
        if (!relay.enabled) {
          relayManager.enableRelay(relay.url);
        }
      } else {
        if (relay.enabled) {
          relayManager.disableRelay(relay.url);
        }
      }
    }

    this.lastSelectionTime = Date.now();
    diagnostics.log(
      `✅ Applied smart selection: ${bestRelays.length} relays enabled`,
      'info'
    );

    return bestRelays;
  }

  /**
   * Enable automatic smart relay selection
   */
  enableAuto(): void {
    this.isAutoEnabled = true;
    this.applySmartSelection();
    diagnostics.log('🤖 Auto relay selection enabled', 'info');
  }

  /**
   * Disable automatic smart relay selection
   */
  disableAuto(): void {
    this.isAutoEnabled = false;
    diagnostics.log('🤖 Auto relay selection disabled', 'info');
  }

  /**
   * Check if auto selection is enabled
   */
  isAuto(): boolean {
    return this.isAutoEnabled;
  }

  /**
   * Check if it's time to re-evaluate relay selection
   */
  shouldReEvaluate(): boolean {
    if (!this.isAutoEnabled) return false;
    const timeSinceLastSelection = Date.now() - this.lastSelectionTime;
    return timeSinceLastSelection >= this.selectionIntervalMs;
  }

  /**
   * Periodic re-evaluation (call this periodically if auto is enabled)
   */
  periodicUpdate(): boolean {
    if (this.shouldReEvaluate()) {
      console.log('🔄 Re-evaluating relay selection...');
      this.applySmartSelection();
      return true;
    }
    return false;
  }

  /**
   * Probe relays in the background using WebSocket open latency.
   * Results are cached by RelayLatencyProbe and throttled here.
   */
  async refreshRelayLatency(force: boolean = false): Promise<boolean> {
    if (this.probeInProgress) {
      return false;
    }

    const now = Date.now();
    if (!force && now - this.lastProbeTime < this.probeIntervalMs) {
      return false;
    }

    this.probeInProgress = true;
    try {
      const relayUrls = relayManager.getAllRelays().map(relay => relay.url);
      if (relayUrls.length === 0) return false;

      diagnostics.log(`Probing ${relayUrls.length} relays (timeout ${this.probeTimeoutMs}ms)`, 'info');
      const results = await relayLatencyProbe.measureRelays(relayUrls, this.probeTimeoutMs);
      this.lastProbeTime = Date.now();

      for (const result of results) {
        relayHealthMonitor.initRelay(result.url);
        relayHealthMonitor.recordConnectionAttempt(result.url);

        if (result.ok && result.latency !== null) {
          relayHealthMonitor.recordLatency(result.url, result.latency);
        } else {
          relayHealthMonitor.recordFailure(result.url, result.error || 'Probe failed');
        }
      }

      const successCount = results.filter(r => r.ok).length;
      diagnostics.log(`Relay probe complete: ${successCount}/${results.length} successful`, 'info');
      return true;
    } catch (error) {
      diagnostics.log(`Relay probe failed: ${error}`, 'warn');
      return false;
    } finally {
      this.probeInProgress = false;
    }
  }

  /**
   * Set maximum number of relays to select
   */
  setMaxRelays(count: number): void {
    this.maxRelays = Math.max(1, Math.min(10, count)); // Between 1-10
    diagnostics.log(`Smart selector: max relays set to ${this.maxRelays}`, 'info');
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      isAutoEnabled: this.isAutoEnabled,
      maxRelays: this.maxRelays,
      lastSelectionTime: this.lastSelectionTime,
      timeSinceLastSelection: Date.now() - this.lastSelectionTime,
      lastProbeTime: this.lastProbeTime,
      timeSinceLastProbe: Date.now() - this.lastProbeTime,
      probeInProgress: this.probeInProgress,
    };
  }

  /**
   * Get statistics about current relay selection
   */
  getStats() {
    const ranked = this.getRankedRelays();
    const viable = ranked.filter(r => r.score > 0);
    const enabled = relayManager.getEnabledUrls();
    const avgLatency =
      viable.length > 0
        ? Math.round(viable.reduce((sum, r) => sum + r.latency, 0) / viable.length)
        : null;

    return {
      totalRelays: ranked.length,
      viableRelays: viable.length,
      enabledRelays: enabled.length,
      autoEnabled: this.isAutoEnabled,
      avgScore: viable.length > 0
        ? (viable.reduce((sum, r) => sum + r.score, 0) / viable.length).toFixed(1)
        : '—',
      avgLatency: avgLatency === null ? '—' : `${avgLatency}`,
    };
  }
}

// Singleton instance
export const smartRelaySelector = new SmartRelaySelector();
