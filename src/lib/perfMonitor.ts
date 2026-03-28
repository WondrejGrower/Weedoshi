export type FeedLoadReason = 'initial' | 'refresh' | 'manual';

type FeedSession = {
  reason: FeedLoadReason;
  startedAt: number;
  firstEventAt?: number;
};

export interface PerfSnapshot {
  feed: {
    activeReason: FeedLoadReason | null;
    firstEventMs: number | null;
    lastLoadMs: number | null;
    lastReason: FeedLoadReason | null;
    initialLoadMs: number | null;
    refreshLoadMs: number | null;
    lastEventCount: number;
  };
  network: {
    queryCalls: number;
    subscribeCalls: number;
    eventsReceived: number;
    lastQueryMs: number | null;
    avgQueryMs: number | null;
  };
  ui: {
    scrollFps: number | null;
    sampleCount: number;
  };
}

class PerfMonitor {
  private feedSession: FeedSession | null = null;
  private lastLoadMs: number | null = null;
  private lastReason: FeedLoadReason | null = null;
  private initialLoadMs: number | null = null;
  private refreshLoadMs: number | null = null;
  private lastFirstEventMs: number | null = null;
  private lastEventCount = 0;

  private queryCalls = 0;
  private subscribeCalls = 0;
  private eventsReceived = 0;
  private lastQueryMs: number | null = null;
  private querySamples: number[] = [];

  private scrollDeltas: number[] = [];
  private lastScrollTs: number | null = null;

  startFeedLoad(reason: FeedLoadReason): void {
    this.feedSession = {
      reason,
      startedAt: Date.now(),
    };
    this.lastEventCount = 0;
    this.lastFirstEventMs = null;
  }

  recordNetworkEventReceived(): void {
    this.eventsReceived += 1;
  }

  markFeedEventReceived(): void {
    this.lastEventCount += 1;

    if (!this.feedSession) return;
    if (this.feedSession.firstEventAt) return;

    this.feedSession.firstEventAt = Date.now();
    this.lastFirstEventMs = this.feedSession.firstEventAt - this.feedSession.startedAt;
  }

  finishFeedLoad(): void {
    if (!this.feedSession) return;

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

  recordQueryDuration(durationMs: number): void {
    this.queryCalls += 1;
    this.lastQueryMs = durationMs;
    this.querySamples.push(durationMs);
    if (this.querySamples.length > 64) {
      this.querySamples.shift();
    }
  }

  recordSubscribeCall(): void {
    this.subscribeCalls += 1;
  }

  recordScrollSample(timestampMs: number): void {
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

  reset(): void {
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

  getSnapshot(): PerfSnapshot {
    const avgQueryMs =
      this.querySamples.length > 0
        ? this.querySamples.reduce((sum, item) => sum + item, 0) / this.querySamples.length
        : null;

    let scrollFps: number | null = null;
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
