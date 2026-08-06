# Slipstrike Desktop Release Build Procedure

## Overview
Slipstrike uses Tauri v2 to package the web-based game client into a native desktop application for Linux (`.deb` / binary), Windows, and macOS.

## Required Project Scaffold
- `src-tauri/Cargo.toml`: Tauri 2.0 Rust project manifest.
- `src-tauri/src/main.rs`: Native desktop Rust application entry point.
- `src-tauri/build.rs`: Tauri build script generator.
- `src-tauri/tauri.conf.json`: Tauri v2 configuration (`frontendDist: "../dist"`).
- `src-tauri/.pkgconfig/`: Local `pkg-config` definitions for GTK3 / WebKit2GTK / libsoup integration on Debian Linux.

## Release Build Instructions
1. Install project dependencies:
   ```sh
   bun install --frozen-lockfile
   ```
2. Verify Rust project configuration:
   ```sh
   cargo check --manifest-path src-tauri/Cargo.toml
   ```
3. Compile frontend bundle and run native Tauri desktop build:
   ```sh
   bun run build
   bun run desktop:build
   ```

## Generated Artifacts
- Binary Executable: `src-tauri/target/release/slipstrike`
- Debian Package: `src-tauri/target/release/bundle/deb/Slipstrike_0.0.1_amd64.deb`

## Packaging Verification
- The production desktop build reads compiled web assets from `dist/` (`index.html`, `main.js`, and `public/` assets).
- Running `bun run desktop:build` compiles native binary executable and package bundles cleanly.
