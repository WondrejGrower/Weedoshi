import { diagnostics } from './diagnostics';
export class RelayLatencyProbe {
    constructor(cacheTtlMs = 120000, defaultTimeoutMs = 1500) {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "cacheTtlMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultTimeoutMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cacheTtlMs = cacheTtlMs;
        this.defaultTimeoutMs = defaultTimeoutMs;
    }
    async measureRelay(url, timeoutMs = this.defaultTimeoutMs) {
        const cached = this.getCached(url);
        if (cached) {
            return { ...cached, fromCache: true };
        }
        const startedAt = Date.now();
        return await new Promise((resolve) => {
            let done = false;
            let socket = null;
            const finalize = (result) => {
                if (done)
                    return;
                done = true;
                try {
                    socket?.close();
                }
                catch {
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
            }
            catch (error) {
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
    async measureRelays(urls, timeoutMs = this.defaultTimeoutMs) {
        const tasks = urls.map((url) => this.measureRelay(url, timeoutMs));
        const settled = await Promise.allSettled(tasks);
        return settled.map((item, index) => {
            if (item.status === 'fulfilled') {
                return item.value;
            }
            const fallback = {
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
    clearCache() {
        this.cache.clear();
    }
    getCached(url) {
        const entry = this.cache.get(url);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(url);
            return null;
        }
        return entry.result;
    }
}
export const relayLatencyProbe = new RelayLatencyProbe();
