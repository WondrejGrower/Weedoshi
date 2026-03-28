import { performance } from 'node:perf_hooks';

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeEvents(count, seed = 42) {
  const rnd = mulberry32(seed);
  const tags = [['t', 'weedstr'], ['t', 'plantstr'], ['p', 'author']];
  const words = ['grow', 'plant', 'feed', 'nostr', 'relay', 'flower', 'leaf', 'light', 'water', 'soil'];
  const events = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    const phrase = [];
    for (let j = 0; j < 24; j++) {
      phrase.push(words[Math.floor(rnd() * words.length)]);
    }
    if (i % 3 === 0) phrase.push('#weedstr');
    if (i % 5 === 0) phrase.push('#plantstr');
    events.push({
      id: `ev-${i}`,
      pubkey: `pk-${Math.floor(rnd() * 900)}`,
      kind: 1,
      created_at: now - i,
      tags,
      content: phrase.join(' '),
    });
  }

  return events;
}

function parseContentHashtags(content) {
  const hashtags = [];
  const regex = /#(\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  return hashtags;
}

function extractTagHashtags(event) {
  const hashtags = [];
  for (const tag of event.tags || []) {
    if (tag[0] === 't' && tag[1]) hashtags.push(String(tag[1]).toLowerCase());
  }
  return hashtags;
}

function getAllHashtags(event) {
  const tagHashtags = extractTagHashtags(event);
  if (tagHashtags.length > 0) return tagHashtags;
  return parseContentHashtags(event.content || '');
}

function deduplicateAndFormatEvents(events) {
  const seen = new Set();
  const formatted = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    formatted.push({
      ...event,
      hashtags: getAllHashtags(event),
      author: event.pubkey,
      timestamp: event.created_at,
    });
  }
  formatted.sort((a, b) => b.created_at - a.created_at);
  return formatted;
}

function benchFeedRecompute() {
  const source = makeEvents(5000);
  const sample = source.slice(0, 3500);

  const t0 = performance.now();
  const baselineStore = [];
  for (const ev of sample) {
    baselineStore.push(ev);
    deduplicateAndFormatEvents(baselineStore);
  }
  const baselineMs = performance.now() - t0;

  const t1 = performance.now();
  const optimizedStore = [];
  const batchSize = 20;
  for (let i = 0; i < sample.length; i++) {
    optimizedStore.push(sample[i]);
    if ((i + 1) % batchSize === 0 || i === sample.length - 1) {
      deduplicateAndFormatEvents(optimizedStore);
    }
  }
  const optimizedMs = performance.now() - t1;

  return {
    baselineMs,
    optimizedMs,
    speedup: baselineMs / optimizedMs,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeAsyncStorageMock(writeLatencyMs = 0.22) {
  const map = new Map();
  return {
    setItem: async (key, value) => {
      if (writeLatencyMs > 0) await delay(writeLatencyMs);
      map.set(key, value);
    },
    multiRemove: async (keys) => {
      if (writeLatencyMs > 0) await delay(writeLatencyMs);
      for (const key of keys) map.delete(key);
    },
  };
}

async function benchCacheWriteIO() {
  const events = makeEvents(1200);

  const baselineStorage = makeAsyncStorageMock();
  const t0 = performance.now();
  for (const ev of events) {
    await baselineStorage.setItem(`nostr_event_cache_${ev.id}`, JSON.stringify({ event: ev, cachedAt: Date.now() }));
  }
  const baselineMs = performance.now() - t0;

  const optimizedStorage = makeAsyncStorageMock();
  const t1 = performance.now();
  const ops = events.map((ev) =>
    optimizedStorage.setItem(`nostr_event_cache_${ev.id}`, JSON.stringify({ event: ev, cachedAt: Date.now() }))
  );
  await Promise.all(ops);
  const optimizedMs = performance.now() - t1;

  return {
    baselineMs,
    optimizedMs,
    speedup: baselineMs / optimizedMs,
  };
}

function fmt(ms) {
  return `${ms.toFixed(1)} ms`;
}

async function main() {
  const feed = benchFeedRecompute();
  const cache = await benchCacheWriteIO();

  console.log('=== WEEDOSHI PERF BENCH (synthetic) ===');
  console.log('Feed recompute:');
  console.log(`  before : ${fmt(feed.baselineMs)}`);
  console.log(`  after  : ${fmt(feed.optimizedMs)}`);
  console.log(`  speedup: ${feed.speedup.toFixed(2)}x`);

  console.log('Event cache write I/O:');
  console.log(`  before : ${fmt(cache.baselineMs)}`);
  console.log(`  after  : ${fmt(cache.optimizedMs)}`);
  console.log(`  speedup: ${cache.speedup.toFixed(2)}x`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
