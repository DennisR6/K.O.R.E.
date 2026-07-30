# Discord Integration and Rich Presence Setup

## Overview
Slipstrike supports optional Discord Rich Presence and game invites. When disabled, Discord integration is a complete no-op and runs safely without client credentials or external network requests.

## Configuration Steps
1. Create an application on the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy your application **Client ID**.
3. Set the environment variables in your deployment or local `.env`:
   ```env
   DISCORD_ENABLED=true
   DISCORD_CLIENT_ID=your_client_id_here
   ```
4. If `DISCORD_CLIENT_ID` is omitted or `DISCORD_ENABLED` is false, Discord rich presence reporting and invites are automatically disabled (no-op).
