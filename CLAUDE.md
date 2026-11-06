# CLAUDE.md

## What this is

A tournament bracket/standings site for อาจารย์นำโชค's ROV tournament. Admin enters team names, the system generates a randomized round-robin schedule (every team plays every other team once, best-of-3 per match: win=3pts/loss=0pts), tracks results, computes live standings, and once every group match is played, automatically pairs the top 2 teams into a final match. Separate project, no shared code with `worksheet`, `online-exam`, `plus-minus`, `token-arena`, `submit-work`.

## Architecture

- `index.html` / `js/display.js` — public display page (meant for projecting in the venue): champion banner (once decided), next match up, live standings table, full match schedule, final match once generated. Polls every `CONFIG.POLL_MS` (3s).
- `admin.html` / `js/admin.js` — passcode-gated (`adminCheckPasscode`, same pattern as `plus-minus`/`token-arena`). Team setup (one team per line → `setupTeams`, which wipes any prior tournament and generates a fresh shuffled round-robin), per-match score entry (`recordResult`), and a reset button (`resetTournament`).
- `apps-script/Code.gs` — **PropertiesService-only backend, no Google Sheet** (same pattern as `token-arena`) since the whole tournament's data is small and doesn't need a permanent log — one JSON blob (`teams`, `matches`, `final`, `champion`, `status`) is enough. `doGet` returns the state plus server-computed `standings` (points desc, then set differential, then sets won — tie-break order). `handleRecordResult_` is where the auto-final-generation logic lives: after every group match write, it checks if all 21 (for 7 teams) matches are played and no final exists yet, and if so builds one from the current top-2 standings.

## Testing performed

No real browser available. Wrote a Python mock server replicating the exact Apps Script logic (round-robin generation, standings sort, auto-final trigger) and drove the real `admin.html`/`index.html` via jsdom: wrong/right passcode, 7-team setup → 21 generated matches, played all 21 with varying scores, confirmed standings computed correctly and the final was auto-generated from the actual top 2, played the final, confirmed champion declared and the public display page picked up every stage (standings, matches, final section, champion banner) correctly. Not yet tested against the real deployed Apps Script.

## Running / testing

```
python3 -m http.server 8811 --directory .
```
then open `/index.html` (public) and `/admin.html` (passcode-gated). Needs `js/config.js`'s `API_URL` pointed at a deployed Apps Script Web App — see `apps-script/README.md`.
