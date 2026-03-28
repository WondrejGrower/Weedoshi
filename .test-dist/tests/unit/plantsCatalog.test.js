import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlantSlug, encodeCustomPlantSlug, decodeCustomPlantSlug } from '../../src/lib/plants/catalog';
test('normalizePlantSlug converts to lowercase ascii slug', () => {
    assert.equal(normalizePlantSlug('Cannabis sativa'), 'cannabis-sativa');
    assert.equal(normalizePlantSlug('  C. Índica  '), 'c-indica');
    assert.equal(normalizePlantSlug('Humulus_lupulus'), 'humulus-lupulus');
});
test('custom plant slug encoding is stable and reversible', () => {
    const slug = encodeCustomPlantSlug('My Fancy Plant');
    assert.equal(slug, 'custom:my%20fancy%20plant');
    assert.equal(decodeCustomPlantSlug(slug), 'my fancy plant');
});
