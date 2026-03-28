import test from 'node:test';
import assert from 'node:assert/strict';
import { assertNoSensitiveMaterial, detectSensitiveMaterial, sanitizeForLogs, } from '../../src/lib/securityBaseline';
test('detectSensitiveMaterial is deterministic across repeated calls', () => {
    const sample = 'leak nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    const first = detectSensitiveMaterial(sample);
    const second = detectSensitiveMaterial(sample);
    const third = detectSensitiveMaterial(sample);
    assert.equal(first.hasSensitive, true);
    assert.equal(second.hasSensitive, true);
    assert.equal(third.hasSensitive, true);
    assert.ok(first.reasons.includes('nsec'));
    assert.ok(second.reasons.includes('nsec'));
    assert.ok(third.reasons.includes('nsec'));
});
test('assertNoSensitiveMaterial blocks ncryptsec and sanitizeForLogs redacts', () => {
    const secret = 'ncryptsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    assert.throws(() => assertNoSensitiveMaterial(secret, 'field'), /Blocked potential secret leak/);
    const sanitized = sanitizeForLogs({ secret });
    assert.equal(sanitized.secret, '[REDACTED_NCRYPTSEC]');
});
