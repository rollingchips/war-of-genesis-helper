# T5-and-below fusion and jewel preservation

One automatic switch consumes **six equipment items** or **three accessories** per batch, accepting ratings 1 through 5. Each batch contains one tier and one category. T6+ items are never consumed. Equipment levels may differ.

## Update

1. Exit the game normally and close the old Helper/LiveSync bridge first.
2. Update the repository, keeping root-level `index.html`, `cai_dat_livesync.bat`, `install_game_hook_v2.js` and `livesync_bridge.js` together. ZIP delivery is retired.
3. Run the included `cai_dat_livesync.bat` using the existing LiveSync setup process. This installs the updated game hook; replacing the HTML alone is insufficient. The existing launcher can restart the game and the bridge.
4. Use the root `index.html`. In **寶石熔爐與倉庫**, find **T3～T5 裝備／飾品** inside the existing **自動化設定** card, at the former T3 switch position.
5. Wait for live capability data. Enable the single automatic switch explicitly. It starts off every time the page opens. The old T3-only automatic controls/scheduler have been replaced. The same-level checkbox is removed and its saved preference is ignored. The existing storage setting applies to every batch. Review those settings before enabling. No duplicate controls or separate fusion card are added.

The engine excludes locked, equipped and market-staged items, checks the game's recipe/material validator and submits one batch at a time. Missing safety APIs or a missing recipe stop execution. Uncertain results stop automation rather than automatically retrying. Check actual inventory in game before re-enabling/restarting after an uncertain result. Turning the switch off does not cancel an already-submitted batch.

## Verification boundary

Offline mocked-game, browser, parsing, direct-file and reproducibility checks are available through `npm test` and `npm run build`. The installer has **not** been executed against a Windows game during development. Actual game behavior, item consumption and outcome codes remain unverified on the operator's version. A disabled capability means the page has not received a compatible, fresh hook report; do not bypass this check.

Sources: `gear-fusion-engine.js` owns execution, `gear-fusion-ui.js` owns controls; `scripts/gear-fusion-extension.cjs` applies explicit patches to the pinned upstream. No new external service or dependency is needed.

The Helper UI is Traditional Chinese, including authored notices, help, dialogs and dynamic statuses. Product names, standard acronyms, code examples and unknown game/user data are not rewritten. This language update does not change the engine or hook.

The BAT execution window and authored LiveSync Bridge logs use English. The browser UI remains Traditional Chinese. Keep the BAT, bridge, hook and bundled HTML from the same archive together; OS/runtime errors may use the system language.

## Jewel preservation

Expand **寶石保留設定** in the existing Automation Settings card. Green buttons preserve a whole jewel type (**全部**) or its exact tier (**T1** through **T6**). The saved policy applies to manual and automatic jewel fusion and is checked again inside the game hook. Existing allowed-tier and storage settings still apply. Update both the bundled page and hook; older hooks are intentionally refused.

This release selectively ports upstream preservation matching from `d09f5f8832360e03090b414ef23139c9d36c61ba`; it does not import unrelated upstream reconnect behavior or claim a full upstream version upgrade.

## Workshop fault containment

A blocked or uncertain fusion pauses gear fusion, jewel fusion and both automatic deposit producers. The first error is retained in the hook and **鍛造首筆錯誤** panel, separate from rolling activity logs, with bounded response-type/result-code diagnostics. Clearing that display does not unlock the game. Temporary busy state merely defers dispatch. Check actual inventory before starting a fresh hook session; automation remains off until explicitly enabled. The original live failure reported on September 28 is not yet diagnosed; this update fixes continued dispatch and lost diagnostics without relaxing result validation.

## Native workshop preflight

The matched hook now respects the game's own busy flag for every workshop action. Direct equipment calls do not change workshop tabs/settings or clear staging. The selected recipe is re-read and protected materials are revalidated immediately before the API call. The capability includes `preflight: 1` for support diagnostics.

An API-entered fault stores bounded call-time recipe/busy/validation diagnostics in the same first-error panel and session storage. This does not prove a network request was sent. Null, exceptions and timeout still block subsequent operations; no automatic unlock is introduced. Offline coverage includes the operator-supplied native service body but does not establish the cause of the historical null or a successful live game run.

The gear scheduler requires the hook to advertise T5 in `gearSourceTiers`. Older hooks cannot enable the new switch. The equipment/accessory ceiling does not alter jewel tier selection or preservation.
