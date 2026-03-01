# Diaries + Growmies QA Checklist

## 1) Diary persistence across tabs and refresh
1. Login with any account (nsec/signer/npub).
2. In feed, click `Add to Diary` on 3 posts.
3. In modal:
   - create a new diary (e.g. `Fast Buds BPP AF`) and add first post
   - add next posts to the same diary
4. Switch between `Feed`, `Profile`, `Settings`, `Growmies` tabs repeatedly.
5. Confirm diary and its items remain visible in `Profile -> Diary`.
6. Refresh/restart app.
7. Confirm diary still exists and item count is unchanged.

## 2) Per-pubkey isolation
1. Login as User A and create at least one diary + one growmie.
2. Logout.
3. Login as User B.
4. Confirm User A data is not shown.
5. Logout and login as User A again.
6. Confirm User A data is restored.

## 3) Offline local-only behavior
1. Login and create diary entries while online.
2. Disable network / go offline.
3. Switch tabs and refresh app.
4. Confirm local diaries and growmies still load.

## 4) Public diary sync roundtrip
1. Login with writable signer (nsec or NIP-07 sign permission).
2. Open diary in `Profile` and publish (`Publish changes`) to mark/sync public.
3. Confirm sync status transitions: `syncing -> synced`.
4. Clear local storage for current pubkey keys.
5. Login again and wait for relay merge.
6. Confirm public diary is rehydrated from relays.

## 5) Growmies feed filter
1. Add at least 2 authors via `Add to Growmies` on feed cards.
2. Open `Growmies` tab and enable `Only Growmies`.
3. Return to `Feed`.
4. Confirm only posts from growmies are shown.
