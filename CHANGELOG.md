# Changelog

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
