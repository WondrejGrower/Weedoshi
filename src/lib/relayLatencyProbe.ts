import { diagnostics } from './diagnostics';

export interface RelayProbeResult {
  url: string;
  latency: number | null;
  ok: boolean;
  error?: string;
  measuredAt: number;
  fromCache?: boolean;
}

interface CacheEntry {
  result: RelayProbeResult;
  expiresAt: number;
}

export class RelayLatencyProbe {
  private cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;
  private readonly defaultTimeoutMs: number;

  constructor(cacheTtlMs: number = 120000, defaultTimeoutMs: number = 1500) {
    this.cacheTtlMs = cacheTtlMs;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async measureRelay(url: string, timeoutMs: number = this.defaultTimeoutMs): Promise<RelayProbeResult> {
    const cached = this.getCached(url);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    const startedAt = Date.now();

    return await new Promise<RelayProbeResult>((resolve) => {
      let done = false;
      let socket: WebSocket | null = null;

      const finalize = (result: RelayProbeResult) => {
        if (done) return;
        done = true;
        try {
          socket?.close();
        } catch {
          // no-op
        }

        this.cache.set(url, {
          result,
          expiresAt: Date.now() + this.cacheTtlMs,
        });

        resolve(result);
      };

      const timer = setTimeout(() => {
        finalize({
          url,
          latency: null,
          ok: false,
          error: `timeout ${timeoutMs}ms`,
          measuredAt: Date.now(),
        });
      }, timeoutMs);

      try {
        socket = new WebSocket(url);
      } catch (error) {
        clearTimeout(timer);
        finalize({
          url,
          latency: null,
          ok: false,
          error: error instanceof Error ? error.message : 'WebSocket init failed',
          measuredAt: Date.now(),
        });
        return;
      }

      socket.onopen = () => {
        clearTimeout(timer);
        finalize({
          url,
          latency: Date.now() - startedAt,
          ok: true,
          measuredAt: Date.now(),
        });
      };

      socket.onerror = () => {
        clearTimeout(timer);
        finalize({
          url,
          latency: null,
          ok: false,
          error: 'websocket error',
          measuredAt: Date.now(),
        });
      };
    });
  }

  async measureRelays(urls: string[], timeoutMs: number = this.defaultTimeoutMs): Promise<RelayProbeResult[]> {
    const tasks = urls.map((url) => this.measureRelay(url, timeoutMs));
    const settled = await Promise.allSettled(tasks);

    return settled.map((item, index) => {
      if (item.status === 'fulfilled') {
        return item.value;
      }

      const fallback: RelayProbeResult = {
        url: urls[index],
        latency: null,
        ok: false,
        error: item.reason instanceof Error ? item.reason.message : 'probe failed',
        measuredAt: Date.now(),
      };

      diagnostics.log(`Relay probe failed for ${urls[index]}: ${fallback.error}`, 'warn');
      return fallback;
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  private getCached(url: string): RelayProbeResult | null {
    const entry = this.cache.get(url);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(url);
      return null;
    }
    return entry.result;
  }
}

export const relayLatencyProbe = new RelayLatencyProbe();
