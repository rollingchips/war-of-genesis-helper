# Traditional Chinese Frontend Contract

## Scope

This fork localizes all application-authored visible frontend text to Traditional Chinese (zh-Hant): navigation, forms, help, tooltips, dialogs, notifications, dynamic templates, and built-in catalog display names. User-imported values and messages originating in the game are not rewritten. Technical identifiers, proper product names, abbreviations, URLs, file paths, protocol keys, storage keys, and code examples remain compatible.

## Invariants

Preserve upstream calculations, game connection behavior, automation, assets, item identities, and persistence formats. Translate presentation values, not machine-facing identifiers. Preserve the MIT license and attribution. The application remains a standalone HTML file without build-time or runtime translation services.

## Verification

Check JavaScript parsing and static/dynamic UI coverage. Exercise the offline interface without connecting to a game or enabling automation. Record any unavailable live-game verification explicitly. No deployment or game operation is included in this localization task.

## Implemented localization boundary

- `localization/zh-Hant.tsv` owns presentation terminology; `skill-patterns.json` owns parameterized skill descriptions with explicit numeric placeholders.
- `scripts/build-localization.cjs` regenerates `index.html` from upstream commit `8af64bf7da1e89ff90f2193005b85bf6ff6b0d0c`. It embeds the translator and all assets; no translation endpoint is used.
- The fork selects `zh-Hant` on startup even if a previous English preference exists. The original non-English data branch is retained internally. Source catalog fields, option values, protocols and original gameplay functions remain unchanged.
- An incremental DOM observer translates new display nodes and accessibility attributes. Native dialog messages use the same translator. Player nicknames, input values, code blocks and paths are not translated; the built-in novice placeholder is localized.
- Chinese catalog searches also match the translated display names. Responsive header wrapping accommodates longer labels.

## Verified result (2026-09-15)

Offline Chromium verification passed for 10 tabs, all 3 classes, 3 dialogs, Chinese equipment search, dynamic updates, dialog return semantics, nickname preservation, and 1440px/390px layouts. All 8,035 inspected catalog display fields have localized names/descriptions. All 140 unchanged top-level functions and 41 data/state declarations are byte-for-byte preserved against the pinned upstream; six functions intentionally change only locale handling or search matching. No game commands were sent. Live game sync, forging and automation are not claimed as tested.

## Upstream synchronization contract (2026-09-21)

- Merge upstream `8af64bf7da1e89ff90f2193005b85bf6ff6b0d0c` into the fork, retaining localization, search support, attribution, and reproducible builds.
- Track the upstream revision in one manifest consumed by both build and verification. Preserve upstream gameplay functions and initial state except the documented presentation/search adapters.
- Include the upstream `LiveSync_1Click.zip` unchanged. It installs a game-script hook and a local bridge; it is not merely a read-only save importer. The package must never execute during build or verification.
- Verification is offline: block external requests, game WebSockets, and Steam launches. Check the new LiveSync help/download UI and package identity in addition to existing localization checks.
- This update authorizes repository synchronization and push only, not installation, game-file modification, or live automation. Upstream security findings are not represented as fixed by synchronization.

- New upstream UI phrases not covered by the existing glossary use explicit English labels. Existing Traditional Chinese catalog terminology is retained. Supplemental output labels must be translation fixed points to prevent DOM-observer loops caused by upstream reverse aliases.

## Verified synchronization result (2026-09-21)

- Preserved 241 upstream top-level functions and 77 initial declarations verbatim. The seven allowed adapters are the four catalog/search functions, `updateDOMTranslations`, `switchLanguage`, and `__i18nTranslateMutations`. The existing incremental localization observer owns presentation updates.
- Passed offline Chromium checks for 8,035 catalog fields, 10 tabs, three classes, four dialogs (including LiveSync), and 1440px/390px layouts. Zero page errors and zero game commands occurred. Five relative LiveSync archive links were present.
- Added regression checks for supplemental-label fixed points, English reverse aliases, and preservation of the new dropdown helper. A translation alias cycle discovered during integration was corrected in the authoritative build mapping.
- Rebuilding produced identical HTML SHA-256 `748b130486dff3bcfdd1732df09f1e538c2614a7f93801b6f0d1e793ee88ee3c`. Installer SHA-256 `9034a2db42c9ce560457fe65e0c214b9802abcceec5cd06d7c67ef3049826b8b` matches the pinned upstream blob. No installer execution or Windows-game verification was performed.
