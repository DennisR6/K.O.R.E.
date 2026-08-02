# Slipstrike (KORE)

[![Bun](https://img.shields.io/badge/Bun-v1.1+-black.svg)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC107.svg)](https://tauri.app/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Slipstrike** (code package `game`, browser title `KORE`) is a turn-based 2D arena tactics game. Players drag and release circular figures across slippery arena surfaces, resolving movement, impulses, and collisions through a deterministic frame-counted physics simulation.

---

## Features

- **Custom Physics Engine:** 2D circle/circle and circle/rectangle collisions, friction, impulse vectors, rotation hazards, and force fields rendered with p5.js.
- **Staged & Live Turn Rules:** Data-driven `RuleInterpreter` with item allowances, active team progression, and staged turn phases (`aim`, `charge`, `push`, `physics`).
- **Declarative Item Economy:** Modular items (Anker, Magnet, Power-Dash, Switch, Freeze-Shot, etc.) with strict declarative schema validation and modding safety.
- **AI Opponents:** Multiple difficulty levels (Easy seeded random, Medium heuristic strategy, Hard simulation search) supporting local offline and server-authoritative matches.
- **Authoritative Multiplayer:** Bun HTTP/WebSocket server (`server.ts`) with SQLite database persistence, reconnect restoration, and match lobby system.
- **Replays & Persistence:** Action recording, seed-based replay playback, local save slots, and settings export/import.
- **Cross-Platform:** Browser web client, standalone HTML/JS Map Editor, native Linux/Desktop app via Tauri 2.0, and PWA mobile offline support.

---

## Quickstart

### Prerequisites

- [Bun](https://bun.sh/) `v1.1+` (recommended runtime and package manager)
- TypeScript `5.9+` (included via project dependencies)

### Installation

```sh
# Clone repository
git clone https://github.com/DennisR6/Game.git kore
cd kore

# Install dependencies
bun install --frozen-lockfile
```

---

## Usage Commands

```sh
# Run tests
bun test

# Strict TypeScript typecheck
npx tsc --noEmit

# Start development mode (server + compiler watcher)
bun run dev

# Start authoritative WebSocket server
bun run start

# Compile production web build
bun run build

# Serve browser client locally
bun run serve

# Build native Tauri desktop package
bun run desktop:build

# Generate TypeDoc API documentation in docs/
bun run docs
```

---

## Gameplay Modes

1. **Local Hotseat Play:** Serve static client with `bun run serve` or open `index.html?skipmenu=1` in your browser.
2. **KI vs KI Battle:** Press **KI vs KI** in the main menu to watch an
   autonomous spectator battle: both teams are played by the bounded
   hard-AI driver on the canonical arena, with no pointer input required.
3. **Authoritative Network Multiplayer:** Run `bun run start`, open the page
   and press **Play Online** in the main menu. The server advertises its public
   base URL through `/config`; join a second browser tab to get matched into a
   game. The advertised URL defaults to `https://lupricht.net/kore` and is
   overridable with the `KORE_BASE_URL` environment variable. Manual override
   remains available: `http://localhost:4001/?skipmenu=1&url=ws://localhost:4001`.
4. **Map Editor:** Open `src-website/index.html` to create and export customized arena maps.
5. **Desktop Native App:** Launch or build the native desktop binary with `bun run desktop:build`.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` (root `.env` sets `4001`) | HTTP/WebSocket server port |
| `GAME_DB_PATH` | `./data/kore.db` | SQLite match database path |
| `KORE_BASE_URL` | `https://lupricht.net/kore` | Public base URL advertised via `/config` and used by the menu's "Play Online" join action (http(s); the WebSocket URL is derived) |

---

## Project Structure

```text
kore/
├── src/                      # TypeScript Engine, Physics, Rules, Items, AI, Server Source
├── src-tauri/                # Tauri 2.0 Desktop Packaging Scaffold
├── src-website/              # Standalone Map Editor Prototype
├── docs/                     # TypeDoc API Reference & Technical Release Guides
├── tests/                    # Bun Test Suite (317+ passing tests)
├── public/                   # Web assets (p5.js vendor, sprites, audio)
└── server.ts                 # Authoritative Bun Server Entry Point
```

---

## Documentation

For full architecture details, API specifications, and release guides:
- [General Documentation & Architecture Guide](docs/README.md)
- [Desktop Packaging & Build Guide](docs/desktop-release.md)
- [Release Verification Ledger](docs/release-verification.md)
- [Game Design Document (German)](gdd.md)
- [Agent & Contributor Rules](AGENTS.md)
