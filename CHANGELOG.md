# Changelog

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
