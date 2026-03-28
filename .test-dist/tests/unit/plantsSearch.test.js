import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPlants } from '../../src/lib/plants/search';
test('search ranks latin/common prefix above substring and synonyms', () => {
    const latinPrefix = searchPlants('cannabis', 5);
    assert.ok(latinPrefix.length > 0);
    assert.equal(latinPrefix[0].item.id, 'cannabis-indica');
    const commonPrefix = searchPlants('hop', 5);
    assert.ok(commonPrefix.some((entry) => entry.item.id === 'humulus-lupulus'));
    const synonymMatch = searchPlants('c. sativa', 5);
    assert.ok(synonymMatch.some((entry) => entry.item.id === 'cannabis-sativa'));
});
