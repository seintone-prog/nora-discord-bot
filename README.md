# Nora Discord Game Bot — Version 1.0

## Files
- `index.js` — bot and game commands
- `package.json` — dependencies and start script
- `data/` — created automatically; stores player data and backup

## Required environment variables
- `DISCORD_TOKEN` — Discord bot token
- `OWNER_ID` — your Discord user ID (not the bot ID)

Never publish either secret in GitHub code or screenshots.

## Install / start
Run `npm install`, then `npm start`.

Enable **Message Content Intent** in Discord Developer Portal.
Use Node.js 18.17+.

## Commands
Public:
- `n help`
- `n wallet`, `n profile`, `n daily`
- `n cards`, `n card CARD_ID`, `n inventory`
- `n summon`, `n summon 10`
- `n quest`, `n battle`, `n leaderboard`
- `n market`, `n sell CARD_ID PRICE`, `n buy LISTING_ID`

Owner-only (not shown in public help):
- `n owner addcoins USER_ID AMOUNT`
- `n owner removecoins USER_ID AMOUNT`
- `n owner setcoins USER_ID AMOUNT`
- `n owner givecard USER_ID CARD_ID`
- `n owner maintenance on` / `off`
- `n owner backup`

## Important deployment note
The JSON database is stored in `data/nora-data.json` with a backup file. This is persistent only if the hosting provider preserves the deployment's writable filesystem across restarts/redeploys. Before updating code, download or back up the `data` folder. If the host has an ephemeral filesystem, attach persistent storage or use an external database before inviting players at scale.

## Card images
Starter cards are placeholders without celebrity photos. Only add celebrity photographs that you have permission or a suitable license to use. Card stats and abilities are fictional game attributes and do not imply celebrity endorsement.
