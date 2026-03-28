# E2E Performance Checklist

This project now exposes runtime performance counters in `DiagnosticsPanel`.
Use this checklist for repeatable in-app benchmarks on device/emulator.

## Metrics captured
- `Initial Feed` (ms): first load duration from feed subscribe start to first settled result.
- `Refresh Feed` (ms): manual refresh duration.
- `First Event` (ms): time-to-first-event in latest feed load session.
- `Scroll FPS`: estimated FPS from feed scroll event cadence.
- `Query Calls`: number of relay `querySync` calls.
- `Subscribes`: number of relay subscription starts.
- `Net Events`: number of network events received by active subscriptions.

## Run procedure
1. Open app in dev build.
2. Open Diagnostics panel and press `Reset Perf Counters`.
3. Let initial feed load finish and note `Initial Feed` and `First Event`.
4. Press refresh once and note `Refresh Feed`.
5. Scroll feed continuously for 10-15 seconds and note `Scroll FPS`.
6. Record `Query Calls`, `Subscribes`, `Net Events` for the same run.

## Snapshot template
- Device:
- Build:
- Relay set:
- Initial Feed:
- First Event:
- Refresh Feed:
- Scroll FPS:
- Query Calls:
- Subscribes:
- Net Events:

## Notes
- Use same relay set and account mode (anon/logged-in) between runs.
- Compare deltas between branches/commits, not raw absolute numbers alone.
