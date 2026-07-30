# Slipstrike Desktop Release Build Procedure

## Overview
Slipstrike uses Tauri to package the web-based game client into a native desktop application for Windows, macOS, and Linux.

## Release Build Instructions
1. Install project dependencies:
   ```sh
   bun install --frozen-lockfile
   ```
2. Compile TypeScript source code for production:
   ```sh
   bun run build
   ```
3. Run Tauri build to generate native packages:
   ```sh
   cargo tauri build
   ```

## Packaging Verification
- The production build reads only production output (`index.html`, `dist/`, `public/`) and relies on no development-only live-server or file-watcher paths.
