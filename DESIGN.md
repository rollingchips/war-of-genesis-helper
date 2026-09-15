# Traditional Chinese Frontend Contract

## Scope

This fork localizes all application-authored visible frontend text to Traditional Chinese (zh-Hant): navigation, forms, help, tooltips, dialogs, notifications, dynamic templates, and built-in catalog display names. User-imported values and messages originating in the game are not rewritten. Technical identifiers, proper product names, abbreviations, URLs, file paths, protocol keys, storage keys, and code examples remain compatible.

## Invariants

Preserve upstream calculations, game connection behavior, automation, assets, item identities, and persistence formats. Translate presentation values, not machine-facing identifiers. Preserve the MIT license and attribution. The application remains a standalone HTML file without build-time or runtime translation services.

## Verification

Check JavaScript parsing and static/dynamic UI coverage. Exercise the offline interface without connecting to a game or enabling automation. Record any unavailable live-game verification explicitly. No deployment or game operation is included in this localization task.

## Implemented localization boundary

- `localization/zh-Hant.tsv` owns presentation terminology; `skill-patterns.json` owns parameterized skill descriptions with explicit numeric placeholders.
- `scripts/build-localization.cjs` regenerates `index.html` from upstream commit `068353206c5f043c6a45b49ac2df636fca96af48`. It embeds the translator and all assets; no translation endpoint is used.
- The fork selects `zh-Hant` on startup even if a previous English preference exists. The original non-English data branch is retained internally. Source catalog fields, option values, protocols and original gameplay functions remain unchanged.
- An incremental DOM observer translates new display nodes and accessibility attributes. Native dialog messages use the same translator. Player nicknames, input values, code blocks and paths are not translated; the built-in novice placeholder is localized.
- Chinese catalog searches also match the translated display names. Responsive header wrapping accommodates longer labels.

## Verified result (2026-09-15)

Offline Chromium verification passed for 10 tabs, all 3 classes, 3 dialogs, Chinese equipment search, dynamic updates, dialog return semantics, nickname preservation, and 1440px/390px layouts. All 8,035 inspected catalog display fields have localized names/descriptions. All 140 unchanged top-level functions and 41 data/state declarations are byte-for-byte preserved against the pinned upstream; six functions intentionally change only locale handling or search matching. No game commands were sent. Live game sync, forging and automation are not claimed as tested.
