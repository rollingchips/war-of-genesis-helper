# Changelog

## 2026-09-30 — Top-bar level-up ETA

- Show estimated remaining time instead of remaining EXP in the top level bar, based on recent completed runs. Display 估算中 when progress/rate evidence is unavailable; do not substitute demo rates.
- UI-only change; fusion and direct-file runtime components are unchanged. ETA boundary checks, 43 offline regressions, desktop/mobile localization and deterministic rebuild passed; no live game execution.

## 2026-09-30 — Minute-based fusion rounds

- Replace inventory-driven auto fusion with two default-off, 60-second round switches for T1–T5 equipment/accessories and jewels. Drain eligible batches sequentially; preserve jewel exclusions and receipt safeguards.
- Remove storage-material permission and both automatic deposit controls/producers. Enforce bag-only selection in the hook; retain manual storage management.
- 43 offline regressions passed, including timer/drain/stop/receipt cases, live-policy propagation, T5 jewels and forced warehouse exclusion. Full desktop/mobile localization and direct-file checks passed. No installer or live-game execution.

## 2026-09-29 — Direct files and personal interface

- Replace ZIP delivery with root-level BAT, hook, Bridge and index.html; launcher opens index.html.
- Remove LiveSync installation/download/help blocks and obsolete update announcement, retaining operational controls and error diagnostics.
- 33 offline regressions, direct-file identity checks and desktop/mobile UI/language checks passed; Bridge/hook match the preceding repair byte-for-byte. No live game operation.

## 2026-09-29 — Bridge receipt deadline repair

- Replace the 2.5-second action cutoff/profile fallback with a 12-second correlated receipt wait.
- Use unique bridge IPC IDs and ignore stale results; fail closed on missing/error replies without retries or inferred success.
- 33 offline regression tests passed, plus full UI/language/archive checks; historical live fusion outcome remains unknown.

## 2026-09-29 — T5-and-below automatic fusion

- Extend equipment/accessory input tiers to T1-T5 inclusive; keep T6+ excluded and fixed 6/3 same-tier batches.
- Update Traditional Chinese labels and gate the scheduler on the hook's supported-tier capability. Preserve jewel settings, busy checks and uncertain-result blocking.
- Passed 28 offline regressions, full language/browser/archive checks and byte-identical rebuilds. T5 live game behavior remains unverified.

## 2026-09-28 — Game workshop preflight

- Stop touching game staging/settings for explicit-material equipment fusion.
- Respect native workshop busy state across all helper workshop commands; revalidate authoritative recipe/materials before submitting.
- Capture call-time diagnostics alongside the first fault. Preserve fail-closed handling for null, timeout and unreconciled results.
- Passed 27 offline regressions, full language/browser/archive checks and a byte-identical HTML/ZIP rebuild. Historical null cause and live-game operation remain unverified.

## 2026-09-28 — Workshop fault containment

- Fix continued automatic deposit dispatch after an uncertain fusion disabled only the gear switch.
- Pause every workshop automation on blocked/uncertain state; suppress transient busy dispatch.
- Preserve the first error separately from rolling logs and expose bounded response-shape diagnostics. Do not guess the original live failure or loosen success validation.
- Passed 21 offline regressions, full localization/browser/archive checks and deterministic rebuild. Windows/game execution remains unverified.

## 2026-09-27 — T4-and-below fusion and jewel preservation

- Remove same-level restriction; include source tiers T1–T4 with fixed 6 equipment / 3 accessory batches.
- Repair rejected-first-batch starvation and explain no-action results without repeated unchanged-inventory checks.
- Port upstream jewel preservation semantics to matched UI/hook, with capability gating and no old-hook fallback.
- Retain localization, original controls placement, item protections and English launcher console. Offline browser, engine, localization, packaging and deterministic-build checks pass; live game remains unverified.


## 2026-09-22 — English launcher console

- Translate the launcher prompts and same-window bridge logs to English, while keeping the Helper UI Traditional Chinese.
- Preserve installation, process handling, game/hook behavior and protocols; generate matching embedded/archive BAT content.
- Passed 29 BAT prompt / 14 bridge log-part checks, executable-command/AST preservation, package identity, deterministic rebuild and all existing offline UI/fusion tests. No Windows installer execution or live-game verification.

## 2026-09-22 — Complete Traditional Chinese UI

- Replace historical English UI exceptions with the operator-requested Traditional Chinese presentation, covering help, notices, automation controls and dynamic statuses.
- Preserve the original Automation Settings card and its shared same-level/storage options; translate display values without changing game/protocol behavior.
- Extend offline language-coverage checks and reproducible bundled HTML verification; live-game functionality remains unverified.

- Offline validation passed: 11 fusion tests, 11 UI tabs, seven dialogs, 442 phrase pairs and 12 dynamic samples at desktop/mobile widths. Reproducible HTML/archive; hook, bridge and launcher unchanged from the previous release.

## 2026-09-22 — Restore automation card placement

- Move the unified T3/T4 equipment/accessory switch into the original Automation Settings card and restore its existing switch styling.
- Remove the separate fusion panel and duplicate same-level/storage controls; consume the existing card settings, including saved preferences, for each batch.
- Preserve the game engine and default-off automatic switch; live-game verification remains outstanding. UI language expansion is not included under the active English-label constraint.
- Pass the existing offline suite and eleven fusion regressions, including original-card placement at desktop/mobile widths, shared-option changes and persisted preferences with automatic fusion reset OFF.

## 2026-09-22 — Unified Tier 3/4 material fusion

- Add one default-off automatic control for both T3/T4 equipment and accessories and an updated LiveSync capability/engine.
- Use operator-confirmed six equipment / three accessory same-tier inputs (rating 3 or 4); preserve item protections, validate recipes in game, serialize batches and stop on uncertain outcomes.
- Bundle reproducible feature sources and offline regression checks; real game execution remains unverified.

## 2026-09-21 — Fork launcher correction

- Fix the upstream website being opened by the bundled and embedded BAT launchers.
- Bundle the fork HTML as `wog-helper.html` and open it locally; do not fall back to the upstream website if it is missing.
- Preserve upstream bridge/hook JavaScript unchanged and add archive/content regression checks.

## 2026-09-21 — Upstream synchronization

- Align the fork with upstream `8af64bf` (2026-09-20), including LiveSync 1-Click, updated forge/storage controls, and upstream assets.
- Preserve the existing localization layer and adapt it to the new upstream interface.
- Centralize the pinned upstream revision and verify the installer archive without executing it.
- Fix a translation alias cycle introduced by combining the new upstream dictionaries with fork labels; add regression checks.
- Pass offline checks for 241 unchanged functions, 77 declarations, 8,035 catalog fields, 10 tabs, three classes, four dialogs, archive identity and deterministic rebuilds.
- Live Windows/game functionality and the new installer are not certified by offline verification.

## 2026-09-15 — Traditional Chinese fork

- Localize application-authored frontend text and built-in display labels to Traditional Chinese.
- Set the document language to zh-Hant while retaining protocol identifiers and game behavior.
- Add the localization scope and verification contract in DESIGN.md.
- Preserve standalone/offline operation using an embedded presentation dictionary (1,367 entries), 1,086 display aliases, and 99 skill-description patterns.
- Support Chinese equipment, jewel and stage searches; retain original item identities and option values.
- Wrap longer header labels on mobile without horizontal overflow.
- Verify 8,035 catalog fields, 10 tabs, three classes and three dialogs in offline Chromium with no page errors or game commands.

### Unified fusion verification

- Pass eleven dedicated offline tests plus the existing localization/browser suite; deterministic HTML/archive rebuild verified.
- Add installation and verification-boundary documentation in `features/README.md`.
- Windows installer execution, actual fusion results and live inventory behavior remain unverified.
