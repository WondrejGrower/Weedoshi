import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayHealthMonitor } from '../../src/lib/relayHealthMonitor';
test('relay health successRate uses cumulative success/failure history', () => {
    const monitor = new RelayHealthMonitor();
    const url = 'wss://relay.example';
    monitor.initRelay(url);
    monitor.recordConnectionAttempt(url);
    monitor.recordFailure(url, 'timeout');
    monitor.recordConnectionAttempt(url);
    monitor.recordSuccess(url);
    monitor.recordConnectionAttempt(url);
    monitor.recordSuccess(url);
    const health = monitor.getHealth(url);
    assert.ok(health);
    assert.equal(health?.totalFailures, 1);
    assert.equal(health?.totalSuccesses, 2);
    assert.equal(health?.successRate, 67);
});
