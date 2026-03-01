# Fix report

## Hotovo ✅

- Implementovaný Nostr-native Weedoshi Diary index (NIP-33 pattern):
  - [src/lib/diaryManager.ts](/home/wondrejbtc/Stažené/WEEDOSHI VIBECODE/src/lib/diaryManager.ts)
  - `kind: 30078`, tagy `['d', diaryId]` + `['t','weedoshi']`
  - přidané TS typy:
    - `DiaryEntry`
    - `DiaryChapter`
    - `DiaryIndex`
  - utility:
    - `parseDiaryIndexEvent(event)`
    - `buildDiaryIndexEvent(diaryIndex, pubkey)`
    - `publishDiaryIndexEvent(event, signer, relays)`
    - `getLatestDiaryIndex(pool, relays, pubkey, diaryId?)`
    - `defaultDiaryId()`
    - `fetchEventsByIds(...)` pro batched načtení poznámek podle `entry.id`

- Opravený publish flow diary eventu:
  - [src/lib/diaryManager.ts](/home/wondrejbtc/Stažené/WEEDOSHI VIBECODE/src/lib/diaryManager.ts)
  - publish běží přes `SimplePool.publish(relays, event)` paralelně, úspěch je při alespoň jednom `fulfilled` výsledku (`Promise.allSettled`).

- UI integrace Weedoshi Diary:
  - [app/index.tsx](/home/wondrejbtc/Stažené/WEEDOSHI VIBECODE/app/index.tsx)
  - Feed zachován pro hashtagy `#weedoshi #growlog #weedstr #weed`.
  - Každý feed post má pro přihlášeného zapisujícího uživatele tlačítko `Add to Diary`.
  - Přidaný diary editor:
    - chapter volba (`vegW01..vegW10`, `flowerW01..flowerW10` + custom key)
    - seznam entries v pořadí
    - reorder přes `Up/Down`
    - remove entry
    - `Publish changes` (replaceable update téhož `kind+pubkey+d`)
  - Přidané profilové taby:
    - `Diary` (kurátorovaný výběr podle `entries` pořadí)
    - `All Posts` (klasické autorovy poznámky)
  - Empty state:
    - pokud index neexistuje, UI ukáže `Start your diary` a umožní založit první draft.

- Signer integrace bez centrálního backendu:
  - [app/index.tsx](/home/wondrejbtc/Stažené/WEEDOSHI VIBECODE/app/index.tsx)
  - publish diary funguje přes:
    - NIP-07 signer (`window.nostr.signEvent`) nebo
    - nsec signer v app mode (`nsecHexToSigner`)

## Zbývá 🧩

- Vylepšit chapter model na samostatné eventy (např. `kind 30079`) místo uložení všeho v index content.
- Přidat automatickou detekci chapter/week z hashtagů v obsahu eventu.
- Dodat robustnější relay selection pro diary fetch (priorita podle relay health + relay hints v entry).
- Rozšířit metadata obrázků (NIP-94/NIP-96) pro lepší diary card preview.
- Přidat multi-run selector (více `diaryId` na profilu s přepínáním).

## Jak otestovat

1. Spusť projekt:
   - `npm run build`
   - `npm run preview`
2. Přihlas se (ideálně Alby/NIP-07).
3. Na Feedu klikni u několika postů na `Add to Diary`.
4. V panelu `Profile -> Diary`:
   - zkontroluj přidané položky
   - změň pořadí (`Up/Down`) a případně odstraň položku
   - klikni `Publish changes`
5. Refresh stránky:
   - Diary tab musí načíst poslední index event a znovu vykreslit stejné pořadí
   - All Posts musí ukázat klasický seznam všech autorových poznámek.

## Rizika

- Relay coverage: některé `entry.id` eventy nemusejí být dostupné na aktuálně zapnutých relay (UI dává placeholder místo pádu).
- Signer dostupnost: bez aktivního signeru (nebo nsec v app mode) nelze diary změny publikovat.
- Při slabé konektivitě může `getLatestDiaryIndex` vrátit starší verzi nebo nic, pokud relay nestihnou odpovědět v timeoutu.
