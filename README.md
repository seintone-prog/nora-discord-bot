# Nora Discord Game Bot — Final Build 2.0

## Architecture
- Discord bot: Node.js 18.17+ / discord.js 14
- Persistent storage: Cloudflare D1
- API: Cloudflare Worker
- Prefixes: `n ` and `N `
- Compact aliases: `nw`, `np`, `nd`, `nc`, `ni`, `ns`, `nq`, `nb`, `nm`, `nlb`
- All player-facing messages are Burmese; visual style is Cute Anime.

## Deploy Cloudflare D1
1. Create a D1 database named `nora-game-db`.
2. Copy its database ID into `wrangler.toml`.
3. Run `npm install -g wrangler` and `wrangler login`.
4. Run `npx wrangler d1 execute nora-game-db --remote --file=./schema.sql`.
5. Run `npx wrangler secret put API_SECRET` and enter a long random secret.
6. Run `npx wrangler deploy`. Copy the Worker URL.

## Run the Discord bot
Set these environment variables on the bot host:
- `DISCORD_TOKEN`
- `OWNER_ID`
- `NORA_API_URL` (Worker URL without trailing slash)
- `NORA_API_SECRET` (same value as Worker API_SECRET)

Then run `npm install` and `npm start`.

Enable Message Content Intent in Discord Developer Portal. Invite with `bot` scope and permissions to View Channels, Send Messages, Embed Links, and Read Message History.

## Commands
- Help: `n help`
- Wallet: `n wallet` / `nw`
- Profile: `n profile` / `np`
- Daily: `n daily` / `nd`
- Cards: `n cards` / `nc`; details: `n card CARD_ID`
- Inventory: `n inventory` / `ni`
- Summon: `n summon` / `ns`; ten-pull: `n summon 10`
- Quest: `n quest` / `nq`
- Battle: `n battle` / `nb`
- Leaderboard: `n leaderboard` / `nlb`
- Market: `n market` / `nm`; `n sell CARD_ID PRICE`; `n buy LISTING_ID`
- Owner: `n owner addcoins USER_ID AMOUNT`, `removecoins`, `setcoins`, `givecard USER_ID CARD_ID`, `maintenance on/off`, `backup`

## Included mechanics
Player profile, level/XP, coins, daily streak reward, daily quests, collectible cards, six rarities, 30-pull Epic+ pity, 80-pull Legendary+ pity, battle, market buy/sell, leaderboard, owner tools, D1 persistence.

## Important limits
This is a functional first public-launch build, not a finished commercial-grade MMO. The current market and game state are saved as one JSON document in D1; simultaneous high-volume trading can race. Before a large public launch, normalize player/inventory/market data into separate tables and use D1 transactions. Starter cards use original fictional designs; use only art you own or are licensed to use. Never commit tokens or secrets.
