# Traditional Chinese Edition

This fork provides a Traditional Chinese (`zh-Hant`) frontend. Download `index.html` from this repository and open it locally. No translation service or runtime package installation is required. The GitHub Pages link below belongs to the original upstream project, not this localized fork.

Upstream attribution and MIT licensing are retained. Game identifiers, calculations, assets and automation behavior are preserved. The localization was verified offline; live game automation was not exercised.

## Localization maintenance

- `npm ci` installs development-only tooling.
- `npm run build` regenerates the standalone HTML from the pinned upstream Git commit and the `localization/` sources.
- `npx playwright install chromium` installs the browser for verification.
- `npm test` runs the offline localization, data-preservation and UI checks without connecting to the game.

See DESIGN.md for scope and CHANGELOG.md for verification details.

---

# ⚔️ War of Genesis: Idle Loot — All-in-One Companion & Database Explorer

> **The ultimate web-based companion, database explorer, and optimization suite for *The War of Genesis: Idle Loot* (Steam / PC).**  
> 100% client-side, zero setup required, works directly in any browser on PC and mobile.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Web%20App-success?logo=github&style=flat-square)](https://github.com/)
[![Game](https://img.shields.io/badge/Game-The%20War%20of%20Genesis%3A%20Idle%20Loot-blue?style=flat-square&logo=steam)](https://store.steampowered.com/)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Windows%20%7C%20Mobile-lightgrey?style=flat-square)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

## 🌐 Live Web Version

Access the web version instantly without installing anything:  
👉 **`https://titlee2111.github.io/war-of-genesis-helper/`**

---

## 🌟 Key Features

### 🌳 1. Multi-Class Skill Tree Simulator & Point Allocator
- **Interactive Skill Trees:** Full visual skill progression trees for all 3 classes: **Ranged (Archer)**, **Melee (Knight)**, and **Mage**.
- **Level-Based Skill Points:** Automatically calculates maximum allowable skill points based on current character level.
- **Auto-Save Persistence:** Skill allocations are saved instantly to your browser's `localStorage`.
- **One-Click In-Game Reset:** Revert back to your actual in-game skill allocation with the *"↩️ Restore from Game"* button.

### 🏆 2. 400+ Stage AFK Farming Efficiency Leaderboard
- **Money/s & EXP/s Analytics:** Real-time yield benchmarks covering 400+ stages across Chapters 1 through 4 (Easy, Normal, Hard, Very Hard).
- **Exact Clear Time Modeling:** Calculated using total stage monster HP, monster spawn densities, and your actual DPS.
- **Smart Filtering:** Filter by your character's current unlocked stage range, manual DPS slider, or real measured in-game DPS.

### ⚔️ 3. Real-Time DPS & Combat Breakdown
- **Granular DPS Decomposition:** Deconstructs your total damage output into normal attacks vs. individual skill casts.
- **Dual Combat Modes:** Toggle between **Mob Sweeping (AoE)** and **Boss Killing (Single-Target)** for accurate simulation.
- **Cross-Class DPS Comparison Table:** Side-by-side performance matrix comparing Attack Speed, Critical Rate/Damage, Normal Attack DPS, Skill DPS, and Top Burst Skill across all 3 classes.

### 🛡️ 4. Complete 1,872 Equipment Database
- **Comprehensive Catalog:** Every single weapon, sub-weapon, helmet, chest armor, gloves, boots, pauldrons, cloak, and 6 accessory types.
- **Multi-Facet Filtering:**
  - **Slot Filter:** 14 distinct equipment positions.
  - **Tier Filter:** Tier 1 (Common) through Tier 6 (Divine) with verified in-game color borders and tier glow.
  - **Required Level:** Levels 1 to 105 in 10-level increments.
  - **Sorting:** Sort by Level, Tier, Gold Price, or Name (A-Z).
- **Fast Pagination:** 100 items per page with instant search in Vietnamese and English.

### 🏋️ 5. Training Skills Optimizer
- Full gold-cost scaling database for core stat upgrades (Attack, Defense, HP, Crit Rate, Gold Boost, EXP Boost).
- Accurately displays stat increments and percentage scaling matching the live game tables.

### 💎 6. Automated Jewel Forge & Storage Management (Auto Fuse)
- **Verified Fusion Rule:** Automatically fuses any **6 jewels of the same tier** into a higher tier (same-type not required).
- **Per-Tier Selectors:** 7 tier checkboxes (Tier 1 through Tier 7) allowing you to fuse only desired tiers while protecting higher-level gems.
- **Storage & Bag Management:** Automated deposit and withdrawal queue between player inventory and personal warehouse.

### 🔍 7. Save Game Locator & Profile Sync
- **Windows / Steam Path Suggestions:** Built-in guidance with one-click path copying for Windows File Explorer:
  - AppData Directory: `%LOCALAPPDATA%Low\Newnormal Soft\War of Genesis Idle Loot\`
  - Steam Default: `C:\Program Files (x86)\Steam\steamapps\common\War of Genesis Idle Loot\`
- **Drag & Drop Import:** Simply drag any profile `.json` file into the web app to load character name, level, combat power, and equipped gear.
- **Offline Persistence:** Automatically caches custom imported profiles in your browser for future visits.

---

## 🔄 Real-Time Game Sync (Puerts V8 Engine)

This tool features a live WebSocket client designed to interface directly with the game's internal Puerts V8 inspector at `ws://127.0.0.1:10998`:

### Option A: Open Locally (Recommended for Live Sync)
1. Download `index.html` to your local PC.
2. Double-click to open it in Chrome, Edge, or Brave (`file:///...`).
3. When *Genesis.exe* is running, the app automatically establishes a WebSocket connection and polls live Combat Power, Level, EXP/s, Gold/s, and Skill Levels in real-time!

### Option B: Hosted Web Version (GitHub Pages)
Modern browsers enforce strict Mixed Content policies that block unencrypted `ws://` connections from `https://` websites:
1. Open the hosted GitHub Pages URL.
2. Click the 🔒 lock icon next to the address bar → Select **Site settings**.
3. Locate **Insecure content** and set it to **Allow**.
4. Refresh the page (F5) — Live Sync will now connect to your local game process!

---

## 🛠️ Technology Stack
- **Architecture:** Zero-dependency, single-file modern HTML5, ES6+ JavaScript, and responsive CSS3.
- **Asset Pipeline:** 570+ game icons (skills, equipment, accessories, jewels) losslessly compressed and embedded as Base64 WebP.
- **Quality Assurance:** Developed via **Test-Driven Development (TDD)** and validated using automated headless Chrome CDP test suites.

---

## ⚖️ Disclaimer
*The War of Genesis: Idle Loot* is developed and published by **Newnormal Soft**. All game assets, trademarks, icons, and copyrighted materials belong to their respective owners. This project is an open-source, non-profit community tool created solely for game analysis, character optimization, and informational purposes.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).

## Fork update: 2026-09-21

This fork includes upstream commit `8af64bf7da1e89ff90f2193005b85bf6ff6b0d0c`. Existing Traditional Chinese catalog/search localization is retained; newly uncovered upstream controls use explicit English labels. The build and tests share `localization/upstream.json`.

The [LiveSync 1-Click package](LiveSync_1Click.zip) includes the unchanged upstream bridge/hook JavaScript, a fork-aware BAT launcher, and the generated fork page `wog-helper.html`. This is **not a read-only save importer**: its installer modifies the game's AppData `scripts/src/init.bundle.mjs`, may install Node.js, forcibly restarts Genesis.exe, and starts a local bridge. The injected hook supports game actions. Back up affected game data and scripts before considering installation. This repository update does not execute the installer, certify its safety, or establish live-game compatibility.

The README's older direct-inspector instructions above describe the previous connection path; the new package is the upstream replacement for the reported September 18 port closure. See DESIGN.md and CHANGELOG.md for the fork's verification scope.

Development: `npm ci`, `npm run build`, `npm test`. Tests use an offline browser with mocked game WebSockets; do not run installer scripts as part of verification.

### Open the fork instead of the upstream page

After pulling this update, extract **all four files** from the updated ZIP into the same folder. The BAT opens the adjacent `wog-helper.html` locally. A missing HTML file prints a manual-open notice; it does not open the upstream site. The page's standalone BAT download uses the same launcher, but it cannot supply the HTML or JavaScript files by itself.

If the bridge is already running, keep its terminal open and open the updated repository `index.html` directly. There is no need to reinstall the game hook just to switch browser pages. Close the upstream page to avoid running two automation interfaces against the same bridge. The bundled HTML is a snapshot; replace it from the freshly built ZIP when updating.
