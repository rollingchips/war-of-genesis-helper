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
- The initial synchronization included the upstream `LiveSync_1Click.zip` unchanged; the launcher correction below supersedes archive identity. It installs a game-script hook and a local bridge; it is not merely a read-only save importer. The package must never execute during build or verification.
- Verification is offline: block external requests, game WebSockets, and Steam launches. Check the new LiveSync help/download UI and package identity in addition to existing localization checks.
- This update authorizes repository synchronization and push only, not installation, game-file modification, or live automation. Upstream security findings are not represented as fixed by synchronization.

- New upstream UI phrases not covered by the existing glossary use explicit English labels. Existing Traditional Chinese catalog terminology is retained. Supplemental output labels must be translation fixed points to prevent DOM-observer loops caused by upstream reverse aliases.

## Verified synchronization result (2026-09-21)

- Preserved 241 upstream top-level functions and 77 initial declarations verbatim. The seven allowed adapters are the four catalog/search functions, `updateDOMTranslations`, `switchLanguage`, and `__i18nTranslateMutations`. The existing incremental localization observer owns presentation updates.
- Passed offline Chromium checks for 8,035 catalog fields, 10 tabs, three classes, four dialogs (including LiveSync), and 1440px/390px layouts. Zero page errors and zero game commands occurred. Five relative LiveSync archive links were present.
- Added regression checks for supplemental-label fixed points, English reverse aliases, and preservation of the new dropdown helper. A translation alias cycle discovered during integration was corrected in the authoritative build mapping.
- Rebuilding produced identical HTML SHA-256 `748b130486dff3bcfdd1732df09f1e538c2614a7f93801b6f0d1e793ee88ee3c`. Installer SHA-256 `9034a2db42c9ce560457fe65e0c214b9802abcceec5cd06d7c67ef3049826b8b` matches the pinned upstream blob. No installer execution or Windows-game verification was performed.

## Fork launcher correction (2026-09-21)

- The launcher must open the fork's bundled local `wog-helper.html`, never the upstream website. Missing HTML produces a manual-open message rather than an upstream fallback.
- Build the archive deterministically from the pinned upstream scripts, changing only the BAT browser destination and its informational message, and adding the generated fork HTML. Preserve both upstream JavaScript files byte-for-byte.
- The embedded BAT download uses the same authoritative launcher content as the archive. Package generation never runs any installer or game code.
- Regression checks compare script identities, embedded/archive BAT identity, bundled HTML identity, browser destination, missing-file fallback and deterministic builds. Windows execution remains unverified.

### Launcher verification

Offline regression passed: both game JavaScript files match upstream, BAT changes are confined to the browser destination/message, the embedded BAT equals the archive BAT, and bundled HTML equals the generated fork page. Verified 241 unchanged functions and 76 unchanged declarations (the installer-content declaration is now intentionally replaced). The full offline UI suite passed with zero game commands/page errors. No Windows BAT execution was performed.

## Unified Tier 3/4 material fusion (operators 27268, 27275 and follow-up, 2026-09-22)

- Provide exactly one English-labeled automatic fusion switch for equipment AND accessories, consuming only Tier 3 OR Tier 4 materials. Remove the legacy T3-only automatic controls/scheduler so there is only one automatic gear/accessory path. The switch starts OFF on every page load. Same-level-only starts ON; storage inclusion starts OFF. Existing jewel and manual T3 behavior is retained; old T3 auto settings cannot run a second scheduler.
- This extension requires the updated bundled LiveSync hook; a capability field gates controls. Old hooks or unavailable/stale data cannot trigger automatic gear fusion. No new remote API, polling timer, dependency or paid service is introduced: the existing profile poll drives bounded scheduling.
- Authoritative execution resides in one injected engine source. It re-reads inventory for every batch, requires equipped/market staging checks, excludes locked/equipped/staged items, unknown levels/types and duplicate IDs, and accepts only exact rating 3 or 4, with each batch restricted to one rating and one content type. Recipe lookup uses the game's workshop tables; operator 27275 confirmed fixed input quantities of six same-tier equipment items or three same-tier accessories. Same-level grouping is optional, not a game recipe requirement. The game validator must still accept the selected batch; no quantity probing is used. Missing/unsupported recipes or checks cause no action.
- At most one validated batch per command; round-robin selection across the four rating/category combinations; same-level grouping and bag/storage filters are applied before validation. Global serialization with existing hook actions prevents overlap. Commands carry unique request identities; duplicate identities cannot cause another operation in the same hook session.
- Fusion completion requires an explicit successful response code AND observed removal of submitted materials. Timeout, ambiguous response or unreconciled state blocks further workshop actions for the hook session. A bounded timeout reports uncertainty without pretending the underlying operation was cancelled. The UI stops the unified switch on error/timeout/disconnection; it never automatically retries an uncertain command.
- UI requests are no more frequent than once per five seconds, use fresh capability data, avoid pending existing commands and alternate eligible rating/category combinations. The UI waits for the matching action receipt before scheduling another batch.
- Reproducible builds patch the upstream hook and generated HTML from repository-owned feature sources. Bridge JavaScript and launcher semantics remain unchanged; the generated archive includes matching updated hook and fork HTML. Existing byte-preservation verification is adjusted only for explicit generated extension anchors.
- Verification uses mocked game services, offline browser actions and archive/source checks. Do not execute the installer, connect to a real game, consume items or claim Windows/game validation. Deliver repository changes and the updated package; installation and enabling automation remain operator actions.

### Unified offline verification (2026-09-22)

Eleven unified fusion tests pass, covering fixed 6/3 counts even with a permissive validator, exactly one UI switch, all four tier/category combinations, no mixed-tier batches, legacy auto scheduler removal, lock/equip/market/storage/tier/level exclusions, recipe/safety API absence, duplicate inventory and commands, stale session identity, uncertain replies, timeout serialization, actual generated hook routing and offline desktop/mobile controls. The existing localization suite passes (8,035 catalog fields, ten tabs, three classes, four dialogs). Generated HTML and archive are byte-identical after rebuilding. Zero real game commands or installer executions occurred. These results do not establish actual game API correctness; real-game verification remains outstanding.
