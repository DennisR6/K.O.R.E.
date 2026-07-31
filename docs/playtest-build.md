# Slipstrike Human Playtest Build

## Release Evidence

- Exact source commit: `176c3e38a7bcc37f2c2574f51e09cbe98a9f0461` (base `HEAD` used for this uncommitted Section 14.12 change; no commit is created by the task).
- Build command: `bun run playtest:build`.
- Platform verified: Linux x86_64.
- Executable: `src-tauri/target/release/slipstrike`.
- Debian bundle: `src-tauri/target/release/bundle/deb/Slipstrike_0.0.1_amd64.deb`.

The build wrapper first creates `dist/` and then packages that exact frontend
through Tauri. The Debian bundle is the preferred artifact for a Linux tester.

## Build Gate

Run the complete gate from the repository root:

```sh
bun test
npx tsc --noEmit
bun run build
bun run desktop:build
```

`bun run playtest:build` is the packaging shortcut for the final two build
commands. The focused artifact and documentation check is
`bun test tests/playtest_build_gate.test.ts`.

## Launch

1. Install the `.deb` with the host package manager, or run the executable directly.
2. Start `Slipstrike` from the application menu or execute `./slipstrike` from the extracted release directory.
3. On the title screen, click once to open the menu, then click **Play Local Game**.

## Canonical Match

1. In the Item phase, click **Skip item** or use the displayed **Power-Dash** once.
2. Select the active team's figure by pressing on it.
3. Drag from the figure in the desired direction and release. A longer drag gives more power; the HUD shows team, phase, selected actor, aim, power, and whether input is locked.
4. Repeat the item/shot flow for each active team until the result overlay shows a winner or draw.
5. Use **Rematch** to start another match, or **Menu** to return to the landing screen.

## Known Limitations

- This evidence covers the Linux x86_64 desktop bundle only; Windows and macOS installers require builds on their respective platforms.
- The canonical build is local hotseat. Network matchmaking is not part of this playtest journey.
- Audio assets are optional and may be absent from a clean checkout.
- The result depends on the physics simulation finishing; wait for the HUD to unlock before the next action.

## Reset And Evidence Collection

- To reset a test, choose **Menu**, close and relaunch the application, then start **Play Local Game** again. **Rematch** is sufficient when only the match state needs resetting.
- For a failure, record the exact build artifact and source commit above, the action and turn where it occurred, and the operating-system version.
- Capture a screenshot of the failing screen, including the HUD or result overlay when possible.
- Collect application logs from the terminal when launching the executable directly; for a packaged launch, collect the desktop environment's application log and attach it with the screenshot.
