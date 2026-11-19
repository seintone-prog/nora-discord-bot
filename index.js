const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID; // Discord User ID; never put the bot token here.
const PREFIXES = ['n ', 'N '];
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'nora-data.json');
const BACKUP_FILE = path.join(DATA_DIR, 'nora-data.backup.json');

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}
if (!OWNER_ID) console.warn('OWNER_ID is not set. Owner-only commands are disabled.');

fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultData = () => ({
  players: {},
  cards: [
    { id: 'NORA001', name: 'Starlight Idol', rarity: 'Common', power: 12, image: null, ability: 'စတင်သူအတွက် အခြေခံကတ်' },
    { id: 'NORA002', name: 'Moonlight Star', rarity: 'Rare', power: 22, image: null, ability: 'ညအလင်းစွမ်းအား' },
    { id: 'NORA003', name: 'Crystal Dream', rarity: 'Epic', power: 35, image: null, ability: 'ခရစ္စတယ်စွမ်းအား' },
    { id: 'NORA004', name: 'Golden Legend', rarity: 'Legendary', power: 55, image: null, ability: 'ရွှေရောင်ဒဏ္ဍာရီ' },
    { id: 'NORA005', name: 'Celestial Myth', rarity: 'Mythic', power: 80, image: null, ability: 'ကောင်းကင်စွမ်းအား' }
  ],
  market: [],
  trades: [],
  settings: { maintenance: false, event: 'ပုံမှန် Event' },
  logs: []
});

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return { ...defaultData(), ...parsed };
    }
  } catch (err) {
    console.error('Database file could not be read:', err.message);
    try {
      if (fs.existsSync(BACKUP_FILE)) return { ...defaultData(), ...JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8')) };
    } catch (backupErr) {
      console.error('Backup recovery failed:', backupErr.message);
    }
  }
  return defaultData();
}

let db = loadData();
let saveQueue = Promise.resolve();

function saveData() {
  const snapshot = JSON.stringify(db, null, 2);
  saveQueue = saveQueue.then(async () => {
    const temp = DATA_FILE + '.tmp';
    await fs.promises.writeFile(temp, snapshot, 'utf8');
    if (fs.existsSync(DATA_FILE)) {
      await fs.promises.copyFile(DATA_FILE, BACKUP_FILE).catch(() => {});
    }
    await fs.promises.rename(temp, DATA_FILE);
  }).catch(err => console.error('Database save failed:', err));
  return saveQueue;
}

function getPlayer(id, username) {
  if (!db.players[id]) {
    db.players[id] = {
      id, username, coins: 500, xp: 0, level: 1,
      cards: {}, pity: 0, lastDaily: 0, streak: 0,
      wins: 0, losses: 0, quests: { daily: 0, lastReset: new Date().toISOString().slice(0, 10) }
    };
  }
  db.players[id].username = username;
  return db.players[id];
}

function addXp(player, amount) {
  player.xp += amount;
  let leveled = false;
  while (player.xp >= player.level * 100) {
    player.xp -= player.level * 100;
    player.level += 1;
    player.coins += 100;
    leveled = true;
  }
  return leveled;
}

function rarityColor(rarity) {
  return ({
    Common: 0x9CA3AF, Rare: 0x3B82F6, Epic: 0xA855F7,
    Legendary: 0xF59E0B, Mythic: 0xEC4899, Limited: 0xEF4444
  })[rarity] || 0xFFB6D9;
}

function rarityWeight(rarity) {
  return ({ Common: 45, Rare: 28, Epic: 16, Legendary: 7, Mythic: 3, Limited: 1 })[rarity] || 0;
}

function drawCard() {
  const total = db.cards.reduce((sum, c) => sum + rarityWeight(c.rarity), 0);
  let roll = Math.random() * total;
  for (const card of db.cards) {
    roll -= rarityWeight(card.rarity);
    if (roll < 0) return card;
  }
  return db.cards[0];
}

function giveCard(player, card) {
  player.cards[card.id] = (player.cards[card.id] || 0) + 1;
}

function ownerOnly(message) {
  return Boolean(OWNER_ID && message.author.id === OWNER_ID);
}

function logOwner(action, actor, target, detail) {
  db.logs.push({ at: new Date().toISOString(), actor, target, action, detail });
  if (db.logs.length > 300) db.logs.shift();
}

function embed(title, description, color = 0xFFB6D9) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setFooter({ text: 'Nora • Cute Anime Game World 🌸' }).setTimestamp();
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => {
  console.log(`Nora is online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'Celebrity Card Game 🌸', type: 0 }],
    status: 'online'
  });
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  const prefix = PREFIXES.find(p => message.content.startsWith(p));
  if (!prefix) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = (args.shift() || '').toLowerCase();
  if (!command) return;

  const player = getPlayer(message.author.id, message.author.username);

  if (db.settings.maintenance && !ownerOnly(message) && !['help'].includes(command)) {
    return message.reply('🛠️ Nora ကို ပြုပြင်ထိန်းသိမ်းနေပါတယ်။ ခဏနေရင် ပြန်လာခဲ့ပါ။');
  }

  try {
    if (command === 'help') {
      const e = embed('🌸 Nora — Game Help', 'Nora Game World မှာ ကြိုဆိုပါတယ်။ အောက်ပါ Commands တွေကို အသုံးပြုနိုင်ပါတယ်။')
        .addFields(
          { name: '💰 Economy', value: '`n wallet` · `n daily`', inline: true },
          { name: '👤 Player', value: '`n profile` · `n leaderboard`', inline: true },
          { name: '🃏 Cards', value: '`n cards` · `n inventory` · `n card <ID>`', inline: true },
          { name: '✨ Summon', value: '`n summon` · `n summon 10`', inline: true },
          { name: '⚔️ Game', value: '`n battle` · `n quest`', inline: true },
          { name: '🛒 Market', value: '`n market` · `n sell <CARD_ID> <PRICE>`', inline: true },
          { name: '📌 အကူအညီ', value: 'Command တစ်ခုချင်းစီရဲ့ အသုံးပြုပုံကို Nora က ပြသပေးပါမယ်။' }
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nora_help_cards').setLabel('Cards').setEmoji('🃏').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('nora_help_games').setLabel('Games').setEmoji('🎮').setStyle(ButtonStyle.Primary)
      );
      return message.reply({ embeds: [e], components: [row] });
    }

    if (command === 'wallet') {
      return message.reply({ embeds: [embed('💰 Player Wallet', `👤 ${message.author.username}\n🪙 Coins: **${player.coins.toLocaleString()}**` , 0xFBBF24)] });
    }

    if (command === 'profile') {
      const owned = Object.values(player.cards).reduce((a, b) => a + b, 0);
      return message.reply({ embeds: [embed('👤 Player Profile', `🌸 **${player.username}**\n⭐ Level: **${player.level}**\n✨ XP: **${player.xp}/${player.level * 100}**\n🪙 Coins: **${player.coins.toLocaleString()}**\n🃏 Cards: **${owned}**\n⚔️ Wins/Losses: **${player.wins}/${player.losses}**`)] });
    }

    if (command === 'daily') {
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;
      const remaining = cooldown - (now - player.lastDaily);
      if (remaining > 0) {
        const hrs = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        return message.reply(`⏳ Daily Reward ကို နောက်ထပ် **${hrs} နာရီ ${mins} မိနစ်** ကြာမှ ပြန်ယူနိုင်ပါတယ်။`);
      }
      const reward = 250;
      player.coins += reward;
      player.lastDaily = now;
      const leveled = addXp(player, 25);
      await saveData();
      return message.reply({ embeds: [embed('🎁 Daily Reward ရပါပြီ!', `🪙 **+${reward} Coins**\n✨ **+25 XP**${leveled ? '\n⭐ Level တက်သွားပါပြီ!' : ''}` , 0x34D399)] });
    }

    if (command === 'cards') {
      const lines = db.cards.map(c => `**${c.id}** — ${c.name} · ${c.rarity} · ⚔️ ${c.power}`).join('\n');
      return message.reply({ embeds: [embed('🃏 Nora Card Collection', lines || 'Card မရှိသေးပါ။')] });
    }

    if (command === 'card') {
      const id = (args[0] || '').toUpperCase();
      const card = db.cards.find(c => c.id === id);
      if (!card) return message.reply('❌ အဲဒီ Card ID ကို ရှာမတွေ့ပါ။ `n cards` နဲ့ စစ်ကြည့်ပါ။');
      const count = player.cards[id] || 0;
      const e = embed(`🃏 ${card.name}`, `**Card ID:** ${card.id}\n**Rarity:** ${card.rarity}\n**Power:** ${card.power}\n**Ability:** ${card.ability}\n**သင့်ပိုင်ဆိုင်မှု:** ${count}`, rarityColor(card.rarity));
      if (card.image) e.setImage(card.image);
      return message.reply({ embeds: [e] });
    }

    if (command === 'inventory') {
      const entries = Object.entries(player.cards).filter(([, count]) => count > 0);
      if (!entries.length) return message.reply('🎒 သင့်မှာ Card မရှိသေးပါ။ `n summon` နဲ့ စတင်ရယူနိုင်ပါတယ်။');
      const lines = entries.map(([id, count]) => {
        const c = db.cards.find(x => x.id === id);
        return `**${id}** ${c ? c.name : 'Unknown Card'} ×${count}`;
      }).join('\n');
      return message.reply({ embeds: [embed('🎒 Your Card Inventory', lines)] });
    }

    if (command === 'summon') {
      const amount = Number(args[0] || 1);
      if (![1, 10].includes(amount)) return message.reply('အသုံးပြုပုံ: `n summon` (၁ ကတ်) သို့မဟုတ် `n summon 10` (၁၀ ကတ်)');
      const cost = amount === 1 ? 1000 : 9000;
      if (player.coins < cost) return message.reply(`🪙 Coin မလုံလောက်ပါ။ လိုအပ်ချက်: **${cost.toLocaleString()} Coins**`);
      player.coins -= cost;
      const results = [];
      for (let i = 0; i < amount; i++) {
        player.pity += 1;
        let card = drawCard();
        // Guaranteed Epic+ at 30 pulls; guaranteed Legendary+ at 80 pulls.
        if (player.pity >= 80) {
          const high = db.cards.filter(c => ['Legendary', 'Mythic', 'Limited'].includes(c.rarity));
          if (high.length) card = high[Math.floor(Math.random() * high.length)];
          player.pity = 0;
        } else if (player.pity >= 30 && ['Common', 'Rare'].includes(card.rarity)) {
          const mid = db.cards.filter(c => ['Epic', 'Legendary', 'Mythic', 'Limited'].includes(c.rarity));
          if (mid.length) card = mid[Math.floor(Math.random() * mid.length)];
          player.pity = 0;
        } else if (['Legendary', 'Mythic', 'Limited'].includes(card.rarity)) {
          player.pity = 0;
        }
        giveCard(player, card);
        results.push(card);
      }
      await saveData();
      const lines = results.map((c, i) => `**${i + 1}. ${c.name}** · ${c.rarity} · \`${c.id}\``).join('\n');
      const best = results.reduce((a, b) => rarityWeight(a.rarity) < rarityWeight(b.rarity) ? a : b);
      const e = embed('✨ Summon Result', `🪙 Used: **${cost.toLocaleString()} Coins**\n\n${lines}\n\n💰 Remaining: **${player.coins.toLocaleString()} Coins**`, rarityColor(best.rarity));
      if (results.length === 1 && results[0].image) e.setImage(results[0].image);
      return message.reply({ embeds: [e] });
    }

    if (command === 'quest') {
      const day = new Date().toISOString().slice(0, 10);
      if (player.quests.lastReset !== day) player.quests = { daily: 0, lastReset: day };
      if (player.quests.daily >= 3) return message.reply('📜 ဒီနေ့ Daily Quest အားလုံး ပြီးဆုံးပါပြီ။ မနက်ဖြန် ပြန်လာခဲ့ပါ။');
      player.quests.daily += 1;
      const reward = 150;
      player.coins += reward;
      const leveled = addXp(player, 35);
      await saveData();
      return message.reply({ embeds: [embed('📜 Daily Quest ပြီးပါပြီ!', `🪙 +${reward} Coins\n✨ +35 XP\n📌 ဒီနေ့ပြီးခဲ့သော Quest: ${player.quests.daily}/3${leveled ? '\n⭐ Level Up!' : ''}`, 0x34D399)] });
    }

    if (command === 'battle') {
      const owned = Object.entries(player.cards).filter(([, n]) => n > 0);
      if (!owned.length) return message.reply('⚔️ Battle မဝင်ခင် `n summon` နဲ့ Card အနည်းဆုံးတစ်ကတ် ရယူပါ။');
      const [id] = owned[Math.floor(Math.random() * owned.length)];
      const card = db.cards.find(c => c.id === id);
      const enemyPower = 10 + Math.floor(Math.random() * 65);
      const playerPower = (card?.power || 10) + player.level * 2;
      const win = playerPower >= enemyPower;
      if (win) {
        player.wins += 1; player.coins += 200; addXp(player, 40);
      } else {
        player.losses += 1; player.coins += 50; addXp(player, 15);
      }
      await saveData();
      return message.reply({ embeds: [embed(win ? '🏆 Battle အနိုင်ရပါပြီ!' : '⚔️ ဒီတစ်ကြိမ် ရှုံးနိမ့်သွားပါတယ်', `🃏 အသုံးပြုသော Card: **${card?.name || id}**\n💪 သင့် Power: **${playerPower}**\n👾 Enemy Power: **${enemyPower}**\n${win ? '🪙 +200 Coins · +40 XP' : '🪙 +50 Coins · +15 XP'}`, win ? 0x34D399 : 0xF59E0B)] });
    }

    if (command === 'leaderboard') {
      const top = Object.values(db.players).sort((a, b) => b.level - a.level || b.coins - a.coins).slice(0, 10);
      const lines = top.map((p, i) => `**${i + 1}. ${p.username}** — Lv.${p.level} · 🪙 ${p.coins.toLocaleString()}`).join('\n');
      return message.reply({ embeds: [embed('🏆 Nora Leaderboard', lines || 'Player မရှိသေးပါ။')] });
    }

    if (command === 'market') {
      if (!db.market.length) return message.reply('🛒 Market မှာ ရောင်းချထားတဲ့ Card မရှိသေးပါ။');
      const lines = db.market.slice(0, 15).map(x => `**${x.cardId}** — ${x.cardName} · 🪙 ${x.price} · Seller <@${x.seller}> · ID \`${x.listingId}\``).join('\n');
      return message.reply({ embeds: [embed('🛒 Nora Market', lines)] });
    }

    if (command === 'sell') {
      const id = (args[0] || '').toUpperCase();
      const price = Number(args[1]);
      if (!id || !Number.isSafeInteger(price) || price < 1 || price > 1000000) return message.reply('အသုံးပြုပုံ: `n sell CARD_ID PRICE`');
      if (!db.cards.some(c => c.id === id)) return message.reply('❌ Card ID မမှန်ပါ။');
      if ((player.cards[id] || 0) < 1) return message.reply('❌ ဒီ Card ကို သင်မပိုင်ဆိုင်ပါ။');
      player.cards[id] -= 1;
      const card = db.cards.find(c => c.id === id);
      const listingId = `M${Date.now().toString(36).toUpperCase()}`;
      db.market.push({ listingId, cardId: id, cardName: card.name, seller: message.author.id, price });
      await saveData();
      return message.reply(`🛒 **${card.name}** ကို Market မှာ **${price} Coins** နဲ့ တင်ပြီးပါပြီ။ Listing ID: \`${listingId}\``);
    }

    if (command === 'buy') {
      const listingId = args[0];
      const itemIndex = db.market.findIndex(x => x.listingId === listingId);
      if (itemIndex < 0) return message.reply('❌ Listing ID မတွေ့ပါ။ `n market` နဲ့ စစ်ကြည့်ပါ။');
      const item = db.market[itemIndex];
      if (item.seller === message.author.id) return message.reply('ကိုယ့် Card ကို ကိုယ်ပြန်ဝယ်လို့မရပါ။');
      if (player.coins < item.price) return message.reply('🪙 Coin မလုံလောက်ပါ။');
      const seller = getPlayer(item.seller, db.players[item.seller]?.username || 'Player');
      player.coins -= item.price;
      seller.coins += item.price;
      giveCard(player, db.cards.find(c => c.id === item.cardId));
      db.market.splice(itemIndex, 1);
      await saveData();
      return message.reply(`✅ **${item.cardName}** ကို ဝယ်ယူပြီးပါပြီ။`);
    }

    // Owner-only commands: intentionally omitted from public help.
    if (command === 'owner') {
      if (!ownerOnly(message)) return message.reply('🔒 ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါတယ်။');
      const sub = (args.shift() || '').toLowerCase();
      if (sub === 'addcoins' || sub === 'removecoins' || sub === 'setcoins') {
        const targetId = args[0];
        const amount = Number(args[1]);
        if (!targetId || !Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) return message.reply('အသုံးပြုပုံ: `n owner addcoins USER_ID AMOUNT` (သို့) `removecoins` / `setcoins`');
        const target = getPlayer(targetId, db.players[targetId]?.username || 'Player');
        if (sub === 'addcoins') target.coins += amount;
        if (sub === 'removecoins') target.coins = Math.max(0, target.coins - amount);
        if (sub === 'setcoins') target.coins = amount;
        logOwner(sub, message.author.id, targetId, amount);
        await saveData();
        return message.reply(`🔐 Owner action ပြီးပါပြီ။ Player \`${targetId}\` ရဲ့ Coin: **${target.coins.toLocaleString()}**`);
      }
      if (sub === 'givecard') {
        const targetId = args[0], cardId = (args[1] || '').toUpperCase();
        const card = db.cards.find(c => c.id === cardId);
        if (!targetId || !card) return message.reply('အသုံးပြုပုံ: `n owner givecard USER_ID CARD_ID`');
        giveCard(getPlayer(targetId, db.players[targetId]?.username || 'Player'), card);
        logOwner(sub, message.author.id, targetId, cardId);
        await saveData();
        return message.reply(`🔐 ${card.name} ကို Player \`${targetId}\` ထံ ပေးပြီးပါပြီ။`);
      }
      if (sub === 'maintenance') {
        db.settings.maintenance = args[0] === 'on';
        logOwner(sub, message.author.id, 'all', String(db.settings.maintenance));
        await saveData();
        return message.reply(`🛠️ Maintenance: **${db.settings.maintenance ? 'ON' : 'OFF'}**`);
      }
      if (sub === 'backup') {
        await saveData();
        await fs.promises.copyFile(DATA_FILE, BACKUP_FILE);
        return message.reply('💾 Nora Database Backup ပြုလုပ်ပြီးပါပြီ။');
      }
      return message.reply('Owner Commands: `n owner addcoins USER_ID AMOUNT`, `removecoins`, `setcoins`, `givecard`, `maintenance on/off`, `backup`');
    }

    return message.reply('🌸 ဒီ Command ကို မသိသေးပါ။ `n help` ကို အသုံးပြုပါ။');
  } catch (err) {
    console.error('Command error:', err);
    return message.reply('⚠️ Command လုပ်ဆောင်ရာမှာ အမှားတစ်ခု ဖြစ်သွားပါတယ်။ နောက်တစ်ကြိမ် စမ်းကြည့်ပါ။').catch(() => {});
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'nora_help_cards') {
    return interaction.reply({ content: '🃏 `n cards` — Card စာရင်း\n`n summon` — Card တစ်ကတ်ဖွင့်ရန်\n`n inventory` — ကိုယ့် Card များကြည့်ရန်', ephemeral: true });
  }
  if (interaction.customId === 'nora_help_games') {
    return interaction.reply({ content: '🎮 `n battle` — Battle ဝင်ရန်\n`n quest` — Daily Quest လုပ်ရန်\n`n leaderboard` — ထိပ်တန်း Player များကြည့်ရန်', ephemeral: true });
  }
});

client.on('error', err => console.error('Discord client error:', err));
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));

client.login(TOKEN);
