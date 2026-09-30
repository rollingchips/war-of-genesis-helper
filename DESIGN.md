# Traditional Chinese Frontend Contract

## Minute-based bag-only fusion rounds (2026-09-30, operator 27645)

- Supersedes profile/count-driven automation and optional storage inclusion. Provide exactly two fusion switches in the original automation card: T5 及以下裝備／飾品 and T5 及以下寶石. Both start OFF on load and after disconnect/fault; old saved auto/deposit/storage preferences cannot enable them. Source tiers are T1–T5 inclusive; T6+ never consumed by these automatic rounds.
- Each enabled category becomes due every 60 seconds after enabling. One shared timer admits a round; profile updates refresh health only, never trigger fusion or count-based scheduling. A round drains each tier/category via sequential single-batch requests until an authoritative no-action receipt, then advances. Successful lower-tier products may feed the subsequent tier. Gear retains six equipment / three accessory batches; jewels use six per same-tier batch. No concurrent requests or accumulated missed rounds. Busy/missing-fresh-data pauses dispatch; a round has a five-minute/1000-command budget to avoid unbounded farming loops. A disabled switch prevents further commands for that category; it does not cancel an already dispatched operation.
- Remove storage inclusion, automatic jewel deposit and automatic gear deposit rows, target selectors and their automatic producers, not just their visibility. Bag location 1 is enforced in both browser and hook even if a stale setting/command requests storage. Manual storage management remains separate. Remove obsolete automatic jewel tier selectors: automatic input tiers are fixed T1–T5; jewel preservation still uses its existing base-type/exact-tier persistent policy for automatic and manual fusion.
- Frontend material-count gating is removed. The hook still selects fresh eligible material IDs, enforces locked/equipped/market protections, and uses native recipe validation. No request bypasses the game API. Preserve single-batch receipt deadlines/correlation, duplicate rejection, uncertain-result interlock and first-fault storage. Never drain an entire round inside one bridge request.
- A new hook capability advertises bag-only minute-round policy; mismatched old hooks cannot enable either automatic switch. Direct repository runtime files remain the delivery format; no ZIP or game/installer execution. Verify timers, drain/skip semantics, toggles during pending calls, preserved jewels, storage exclusion, stale data, overlapping deadlines and uncertainty offline before publication.

Verification: 43 offline regression tests and the full direct-file/UI/language suite passed, including real generated-page clock tests at 1440px and 390px. Existing manual T6 jewel requests retain their prior scope; automatic rounds are strictly T1–T5. No game/installer was executed.

## T5-and-below source materials (2026-09-29, operator 27579)

- Supersedes the T1-T4 input ceiling: automatic equipment/accessory fusion includes source tiers T1 through T5 inclusive, not merely outputs up to T5. T6 and above are excluded. Keep exact batches of six equipment items or three accessories, no mixed tiers/categories, mixed levels allowed, and every existing protection/preflight/uncertainty rule. Jewel preservation and jewel tier settings are unchanged.
- Keep one default-off switch in the original card, labeled "T5 及以下裝備／飾品". The game engine owns the supported source-tier list and exposes it in capability; the browser uses that list, bounded to this requested ceiling, for counts and round-robin scheduling. A hook lacking T5 capability cannot enable the new automatic switch.
- Update matching HTML/hook archive together. Verify all ten tier/category combinations, T5 protection and quantities, T6 exclusion, no mixed T4/T5 batch, old-hook refusal, and deterministic packaging. No live game/installer execution.

Verification: 28 offline regressions passed, including all ten browser-scheduled tier/category combinations at desktop/mobile widths, T5 quantities/protections and T6 exclusion. Full language/archive checks passed; HTML/ZIP rebuilt byte-identically. Live game compatibility remains unverified.

## Game workshop preflight and non-invasive equipment calls (2026-09-28)

- Live operator diagnostics show valid mixed-level T3 equipment and accessory recipes. The supplied game `reqFusionAsync` returns null before its network call when busy, the recipe is absent or materials fail validation; the supplied network method otherwise returns a response or throws. This narrows investigation but does not prove which branch caused the historical fault.
- Direct equipment fusion passes an explicit FusionID and material array. Do not change workshop content/settings or clear staging on this path: those calls publish game UI events and are unnecessary for the explicit-material API. Never bypass the workshop API or call the network endpoint directly.
- Respect the game's `_bRequesting` in capability and the shared hook dispatch guard, in addition to the helper lock. Require an observable boolean busy state; unavailable safety checks fail closed. Busy is a transient no-action state, not proof of an uncertain submission. Recheck it immediately before each gear/jewel request. Do not clear a game busy flag, retry within a command, or unlock a prior uncertain operation.
- Re-read the selected FusionID through the game database and validate that authoritative row plus fresh protected inventory immediately before gear submission. Missing recipe or changed/rejected materials cause zero API calls. Keep fixed 6/3 quantities, T1-T4 scope and item protections unchanged.
- Persist bounded call-time diagnostics (phase, requesting, recipe ID/group/content/rating/count, validation outcome, source tier/category and material count) with the first fault, in receipts and browser session storage. No account data or item IDs. A null after entering the API remains blocked: do not infer non-submission solely from a later inventory snapshot or reinterpret it as success.
- Test with the operator-provided game service method body, including busy/recipe/material guards, network rejection, null/timeout containment and native successful inventory reconciliation. Verify packaged hook guarding for deposits as well as fusions. Offline tests do not certify the historical root cause or live compatibility.

Verification: 27 offline regressions passed. All 11 UI tabs, seven dialogs, 452 phrase pairs and desktop/mobile checks passed with zero real game commands and zero page errors. Rebuilt HTML and ZIP are byte-identical. No live game or installer was run.


## Workshop fault containment (2026-09-28)

- A blocked or uncertain workshop pauses every browser automation producer (gear, jewel fusion, jewel deposit and T3 deposit), not only the gear switch. Busy capability suppresses dispatch without changing user preferences; blocked capability turns automatic preferences off. Never clear an uncertain game lock automatically.
- Preserve the first post-submission fault in the hook capability and a separate browser diagnostic panel/session storage; repeated busy responses cannot overwrite it. Distinguish transient busy from blocked. Record only bounded response shape and result code, never inventory/account payloads.
- Clear the diagnostic display explicitly without unlocking execution. A fresh hook instance can clear the browser interlock, but must not re-enable automatic switches. Existing success criteria remain unchanged: the original live failure cannot be inferred from the screenshot.
- Validate a blocked capability against all command types, repeated polling, persistent diagnostics, transient busy and hook fault receipts in offline tests. No live installer or game operations.

Verification: 21 offline regressions passed, including 600 attempted dispatches under a blocked workshop producing zero sends, all automatic producers disabled, diagnostic persistence across reload and transient-busy recovery. The HTML/archive remain reproducible; no live game was accessed.

## T4-and-below fusion and jewel preservation (2026-09-27)

- Supersedes the previous T3/T4 and shared same-level contract. Automatic gear fusion consumes exact source tiers 1 through 4, with six equipment items or three accessories per batch. Never mix tiers or categories; levels may differ. Remove the same-level checkbox and ignore its old persisted preference, including manual legacy T3 requests. Keep one switch in the original automation card, default OFF, and the existing storage preference. Label the feature "T4 及以下裝備／飾品".
- Keep lock/equipped/market protections and authoritative game recipe validation. Deterministically try bounded alternative candidate batches instead of repeatedly selecting only the first rejected batch. Cache a rejected inventory/options fingerprint; changed inventory/options triggers reevaluation. Distinguish insufficient quantity, missing recipe and validator rejection in receipts/UI. Do not bypass game validation to satisfy the quantity threshold.
- Selectively port jewel preservation from upstream d09f5f8832360e03090b414ef23139c9d36c61ba (base-type or exact tier item-TID matching, T1–T6 controls, staged selection excluding preserved jewels). Do not import unrelated auto-reconnect/popup actions or claim a full upstream merge. Keep the base upstream revision unchanged and record feature provenance.
- Persist preservation locally using upstream's genesis_autofuse_preserved_jewel_types key. Protect preserved jewels in BOTH automatic and manual jewel fusion. An explicit capability/version guard prevents old hooks from executing a protected fusion. No preservation-unaware fallback. Jewel batches must be selected from a fresh inventory, stage only the chosen six, and stop on uncertainty. Keep existing allowed-tier and storage settings.
- Serialize all workshop actions. A timed-out request remains uncertain and blocks further submissions; never retry it automatically. UI uses receipts and version-2 capability data. Browser UI is Traditional Chinese; launcher/bridge console remains English.
- Verify mocked execution, candidate rejection/reselection, eight tier/category combinations, mixed levels, protections, stale/old hook rejection, jewel base/exact-tier preservation, storage, persisted options, timeout and packaging. Build and archive deterministically. No installer execution, game connection or real item consumption is authorized by offline checks.


Verification: mocked engine and packaged-hook lifecycle tests cover both gear and jewel fusion, preservation, exclusions, request correlation, timeout blocking and alternative batches. Offline Chromium checks cover all eight gear tier/category combinations, saved preferences, old-hook rejection, Traditional Chinese UI and desktop/mobile layout. HTML and ZIP rebuild identically. No Windows installer or live-game operation was executed.

## English launcher console (2026-09-22)

- Operator requests English for the BAT execution window only; the Helper browser UI remains Traditional Chinese.
- Translate authored BAT echo messages and bridge console log text displayed in that window. Preserve filenames, paths, variables, commands, labels, control flow, ports, protocol values, game hooks and embedded template expressions. Windows/Node-provided errors retain their original language.
- Use one build-time console translation mapping; the archive and browser-downloaded BAT must remain identical. Keep launcher output ASCII English and avoid new batch metacharacters. Translate bridge log arguments only, never response bodies or game data.
- Verify unchanged executable BAT lines and bridge AST outside allowlisted log text; check packaging, parsing and deterministic builds without executing the installer, launching Steam or connecting to the game. Windows execution remains unverified.

Verification: 29 BAT prompts and 14 bridge log template parts translate to English. All non-echo BAT lines remain identical to the existing fork launcher; the bridge AST matches upstream except those log parts, including unchanged template expressions. Embedded/archive BAT identity, CRLF output, unchanged game hook, deterministic rebuild and the full offline browser/fusion suite pass. No Windows execution was performed.

## Full Traditional Chinese UI completion (2026-09-22)

- The operator explicitly requests Traditional Chinese for the entire WOG Helper UI. This supersedes all historical English-label exceptions below. Labels, explanations, placeholders, tooltips, accessibility labels, dialogs, notifications and application-authored dynamic statuses must be Traditional Chinese. Product names, standard abbreviations, commands, paths, URLs and game/user-provided data retain their identities.
- Reuse the existing embedded localization layer and glossary; add reviewed full-phrase and parameterized translations instead of another translation service. English and Vietnamese source aliases must converge to the same stable Traditional Chinese output without mixed-language fragments or observer loops.
- Keep the one T3 + T4 equipment/accessory switch in the original Automation Settings card. Use its existing same-level checkbox and storage setting. Do not add controls, change layouts or modify automation/recipe logic for this language change.
- Translate application-owned fusion failure reasons at the presentation boundary; preserve raw protocol values and unknown game errors. Game hook, bridge and launcher execution behavior remain unchanged. Source code, comments and technical documentation remain English.
- Audit all tabs, hidden/help dialogs, dynamic templates and attributes in offline Chromium; exercise fusion statuses and shared controls, preserve nicknames and command examples, verify deterministic HTML/archive output. No installer or game operation is part of validation.

Verification: the full offline suite passes, including 11 fusion regressions, all 11 UI tabs, seven dialogs, 442 reviewed phrase/fixed-point pairs, 12 representative dynamic messages, textarea/user-value preservation and desktop/mobile card checks (1440px/390px). Existing 241 functions, 76 declarations and 8,035 catalog fields remain verified. Rebuilding the HTML and ZIP is byte-identical; the hook, bridge and launcher match the preceding package exactly. No live-game operation or Windows installer execution was performed.

## Automation card correction (2026-09-22)

- Replace the two original T3 automatic rows in the existing Automation Settings card with one T3 + T4 equipment/accessory switch, using the existing switch styling. No separate feature card, heading or top-of-page panel.
- Reuse the card's existing same-level checkbox and storage setting as the sole authoritative options for every automatic batch. Preserve their saved preferences and other consumers; remove duplicate extension options. This supersedes the extension-specific same-level/storage startup defaults below. The unified automatic switch still starts OFF regardless of old saved automatic settings.
- Keep the execution engine, capability guard, item exclusions and receipt handling unchanged. New or modified application labels remain English under the active workspace language constraint; the existing localization is not broadened or removed in this correction.
- Verify placement in the original card on desktop/mobile, single-option ownership, persisted settings, and option changes reaching the next command. No live-game operation is authorized by these checks.

Verification: the existing offline suite and all eleven fusion regressions pass. At 1440px and 390px the single native-style switch occupies the original T3 rows between jewel fusion and the existing same-level checkbox. The next batch reflects changes to the shared same-level/storage options, and their preferences survive reload while automatic fusion resets OFF. No engine, bridge or hook code changed in this correction; only the bundled Helper HTML changes in the archive. No actual game commands were sent.

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

## Correlated bridge action receipts (2026-09-29)

The bridge must wait up to 12 seconds for the hook (whose fusion deadline is 10 seconds), within the browser 15-second receipt deadline. Each dispatched action has a bridge-generated IPC identity; only its matching result can settle it. Never substitute a profile for an action result. Missing/error results emit an explicit uncertain transport receipt and latch the bridge action queue closed until restart, without claiming cancellation or retrying. Queued actions are rejected while blocked. No game success is inferred from fresh profiles. Verify the generated bridge queue offline with fake files/timers, including replies after 2.5 seconds, stale IDs, errors and timeout containment.

Verification: 33 offline regressions passed (including five generated-bridge IPC cases), full desktop/mobile localization and archive checks passed. No Windows installer or live game action was executed.

## Direct repository runtime files and personal UI (2026-09-29, operator 27604)

Ship index.html, cai_dat_livesync.bat, install_game_hook_v2.js and livesync_bridge.js directly at the repository root; retire the distributed ZIP and embedded BAT download. The launcher opens adjacent index.html. The pinned historical upstream archive remains a build-only input, not a delivered artifact. Preserve hook/bridge behavior, receipt repair and item safeguards. Remove LiveSync setup/download banners, help dialogs/buttons and obsolete script-update announcement; retain connection controls, disconnect state, automation controls and first-fault diagnostics. Apply removals at build time rather than hiding DOM nodes. Verify root outputs, retained controls, removed help entrypoints and deterministic rebuild without executing the installer.

Direct-file verification: 33 offline regressions passed; desktop/mobile controls and removal assertions passed with no page errors. Bridge and hook match the previous receipt-repair release byte-for-byte. All four outputs rebuild deterministically. No installer execution or live-game verification.
