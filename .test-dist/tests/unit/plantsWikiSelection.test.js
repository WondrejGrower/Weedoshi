import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBestWikiArticle } from '../../src/lib/plants/wiki';
function article(partial) {
    return {
        id: partial.id || 'id',
        pubkey: partial.pubkey || 'a'.repeat(64),
        createdAt: partial.createdAt || 1,
        content: partial.content || '# title',
        dTag: partial.dTag || 'cannabis-sativa',
        relayUrl: partial.relayUrl,
        tags: partial.tags || [],
        aPointer: partial.aPointer || `30818:${partial.pubkey || 'a'.repeat(64)}:cannabis-sativa`,
    };
}
test('best wiki selection prefers curated author', () => {
    const curatedPubkey = 'c'.repeat(64);
    const newer = article({ id: 'newer', pubkey: 'b'.repeat(64), createdAt: 200 });
    const curated = article({ id: 'curated', pubkey: curatedPubkey, createdAt: 100 });
    const selected = selectBestWikiArticle([newer, curated], {
        preferredAuthors: new Set([curatedPubkey]),
        preferredRelays: new Set(),
    });
    assert.equal(selected.bestArticle?.id, 'curated');
});
test('best wiki selection falls back to newest when no curator preferences', () => {
    const older = article({ id: 'older', createdAt: 100 });
    const newer = article({ id: 'newer', createdAt: 200 });
    const selected = selectBestWikiArticle([older, newer], {
        preferredAuthors: new Set(),
        preferredRelays: new Set(),
    });
    assert.equal(selected.bestArticle?.id, 'newer');
    assert.equal(selected.alternatives.length, 1);
});
