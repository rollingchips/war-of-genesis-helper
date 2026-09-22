# Unified Tier 3/4 automatic fusion

One automatic switch consumes **six equipment items** or **three accessories** per batch, accepting rating 3 OR 4 only. Each batch contains one tier and one category. T1, T2 and T5+ are never consumed.

## Update

1. Exit the game normally and close the old Helper/LiveSync bridge first.
2. Extract the updated `LiveSync_1Click.zip` into a separate folder, keeping all four files together. Keep the old package as a backup.
3. Run the included `cai_dat_livesync.bat` using the existing LiveSync setup process. This installs the updated game hook; replacing the HTML alone is insufficient. The existing launcher can restart the game and the bridge.
4. Use the bundled `wog-helper.html`. In Jewel Forge & Storage, find **T3 + T4 Equipment & Accessories** inside the existing **Automation Settings** card, at the former T3 switch position.
5. Wait for live capability data. Enable the single automatic switch explicitly. It starts off every time the page opens. The old T3-only automatic controls/scheduler have been replaced. The existing card's same-level checkbox and storage setting apply to every batch, using their existing saved preferences. Review those settings before enabling. No duplicate controls or separate fusion card are added.

The engine excludes locked, equipped and market-staged items, checks the game's recipe/material validator and submits one batch at a time. Missing safety APIs or a missing recipe stop execution. Uncertain results stop automation rather than automatically retrying. Check actual inventory in game before re-enabling/restarting after an uncertain result. Turning the switch off does not cancel an already-submitted batch.

## Verification boundary

Offline mocked-game, browser, parsing, archive and reproducibility checks are available through `npm test` and `npm run build`. The installer has **not** been executed against a Windows game during development. Actual game behavior, item consumption and outcome codes remain unverified on the operator's version. A disabled capability means the page has not received a compatible, fresh hook report; do not bypass this check.

Sources: `gear-fusion-engine.js` owns execution, `gear-fusion-ui.js` owns controls; `scripts/gear-fusion-extension.cjs` applies explicit patches to the pinned upstream. No new external service or dependency is needed.
