class PerfMonitor {
    constructor() {
        Object.defineProperty(this, "feedSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastLoadMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastReason", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "initialLoadMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "refreshLoadMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastFirstEventMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastEventCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "queryCalls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "subscribeCalls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "eventsReceived", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastQueryMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "querySamples", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "scrollDeltas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "lastScrollTs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    startFeedLoad(reason) {
        this.feedSession = {
            reason,
            startedAt: Date.now(),
        };
        this.lastEventCount = 0;
        this.lastFirstEventMs = null;
    }
    recordNetworkEventReceived() {
        this.eventsReceived += 1;
    }
    markFeedEventReceived() {
        this.lastEventCount += 1;
        if (!this.feedSession)
            return;
        if (this.feedSession.firstEventAt)
            return;
        this.feedSession.firstEventAt = Date.now();
        this.lastFirstEventMs = this.feedSession.firstEventAt - this.feedSession.startedAt;
    }
    finishFeedLoad() {
        if (!this.feedSession)
            return;
        const duration = Date.now() - this.feedSession.startedAt;
        this.lastLoadMs = duration;
        this.lastReason = this.feedSession.reason;
        if (this.feedSession.reason === 'initial') {
            this.initialLoadMs = duration;
        }
        if (this.feedSession.reason === 'refresh') {
            this.refreshLoadMs = duration;
        }
        this.feedSession = null;
    }
    recordQueryDuration(durationMs) {
        this.queryCalls += 1;
        this.lastQueryMs = durationMs;
        this.querySamples.push(durationMs);
        if (this.querySamples.length > 64) {
            this.querySamples.shift();
        }
    }
    recordSubscribeCall() {
        this.subscribeCalls += 1;
    }
    recordScrollSample(timestampMs) {
        if (this.lastScrollTs !== null) {
            const delta = timestampMs - this.lastScrollTs;
            if (delta > 4 && delta < 1000) {
                this.scrollDeltas.push(delta);
                if (this.scrollDeltas.length > 120) {
                    this.scrollDeltas.shift();
                }
            }
        }
        this.lastScrollTs = timestampMs;
    }
    reset() {
        this.feedSession = null;
        this.lastLoadMs = null;
        this.lastReason = null;
        this.initialLoadMs = null;
        this.refreshLoadMs = null;
        this.lastFirstEventMs = null;
        this.lastEventCount = 0;
        this.queryCalls = 0;
        this.subscribeCalls = 0;
        this.eventsReceived = 0;
        this.lastQueryMs = null;
        this.querySamples = [];
        this.scrollDeltas = [];
        this.lastScrollTs = null;
    }
    getSnapshot() {
        const avgQueryMs = this.querySamples.length > 0
            ? this.querySamples.reduce((sum, item) => sum + item, 0) / this.querySamples.length
            : null;
        let scrollFps = null;
        if (this.scrollDeltas.length > 0) {
            const avgDelta = this.scrollDeltas.reduce((sum, item) => sum + item, 0) / this.scrollDeltas.length;
            scrollFps = avgDelta > 0 ? 1000 / avgDelta : null;
        }
        return {
            feed: {
                activeReason: this.feedSession?.reason || null,
                firstEventMs: this.lastFirstEventMs,
                lastLoadMs: this.lastLoadMs,
                lastReason: this.lastReason,
                initialLoadMs: this.initialLoadMs,
                refreshLoadMs: this.refreshLoadMs,
                lastEventCount: this.lastEventCount,
            },
            network: {
                queryCalls: this.queryCalls,
                subscribeCalls: this.subscribeCalls,
                eventsReceived: this.eventsReceived,
                lastQueryMs: this.lastQueryMs,
                avgQueryMs,
            },
            ui: {
                scrollFps,
                sampleCount: this.scrollDeltas.length,
            },
        };
    }
}
export const perfMonitor = new PerfMonitor();
