
'use strict';

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

const PREFIXES = ['n ', 'N '];
const VERSION = '3.0.0';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const CONFIG = {
  API_URL: (process.env.NORA_API_URL || '').replace(/\/+$/, ''),
  API_SECRET: process.env.NORA_API_SECRET || '',
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  OWNER_ID: process.env.OWNER_ID || '',
  SAVE_DELAY: 1200
};

if (!CONFIG.API_URL || !CONFIG.API_SECRET || !CONFIG.DISCORD_TOKEN) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const now = () => Date.now();
const random = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const number = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const money = value =>
  `${Math.floor(number(value)).toLocaleString('en-US')} NW`;

const safe = value =>
  String(value ?? '').replace(/[<@&>]/g, '');

const crops = {
  wheat: {
    name: 'ဂျုံ', emoji: '🌾', time: 30 * 60 * 1000,
    seed: 12, price: 35, xp: 8, water: 1
  },
  rice: {
    name: 'စပါး', emoji: '🌱', time: 45 * 60 * 1000,
    seed: 15, price: 42, xp: 10, water: 2
  },
  corn: {
    name: 'ပြောင်း', emoji: '🌽', time: 60 * 60 * 1000,
    seed: 20, price: 58, xp: 12, water: 2
  },
  tomato: {
    name: 'ခရမ်းချဉ်သီး', emoji: '🍅', time: 90 * 60 * 1000,
    seed: 25, price: 75, xp: 15, water: 2
  },
  potato: {
    name: 'အာလူး', emoji: '🥔', time: 120 * 60 * 1000,
    seed: 30, price: 95, xp: 18, water: 2
  },
  strawberry: {
    name: 'စတော်ဘယ်ရီ', emoji: '🍓', time: 150 * 60 * 1000,
    seed: 40, price: 125, xp: 22, water: 3
  },
  carrot: {
    name: 'မုန်လာဥနီ', emoji: '🥕', time: 50 * 60 * 1000,
    seed: 18, price: 50, xp: 10, water: 1
  },
  cabbage: {
    name: 'ဂေါ်ဖီ', emoji: '🥬', time: 80 * 60 * 1000,
    seed: 22, price: 68, xp: 13, water: 2
  },
  pumpkin: {
    name: 'ဖရုံသီး', emoji: '🎃', time: 180 * 60 * 1000,
    seed: 45, price: 150, xp: 25, water: 3
  },
  watermelon: {
    name: 'ဖရဲသီး', emoji: '🍉', time: 210 * 60 * 1000,
    seed: 50, price: 175, xp: 28, water: 3
  },
  grape: {
    name: 'စပျစ်သီး', emoji: '🍇', time: 240 * 60 * 1000,
    seed: 60, price: 210, xp: 32, water: 2
  },
  soybean: {
    name: 'ပဲပုပ်', emoji: '🫘', time: 100 * 60 * 1000,
    seed: 28, price: 85, xp: 16, water: 2
  }
};

const animals = {
  chicken: {
    name: 'ကြက်', emoji: '🐔', price: 250,
    product: 'egg', productName: 'ကြက်ဥ',
    interval: 60 * 60 * 1000, amount: 2
  },
  cow: {
    name: 'နွား', emoji: '🐄', price: 1200,
    product: 'milk', productName: 'နို့',
    interval: 3 * 60 * 60 * 1000, amount: 3
  },
  sheep: {
    name: 'သိုး', emoji: '🐑', price: 900,
    product: 'wool', productName: 'သိုးမွေး',
    interval: 5 * 60 * 60 * 1000, amount: 2
  },
  goat: {
    name: 'ဆိတ်', emoji: '🐐', price: 700,
    product: 'goat_milk', productName: 'ဆိတ်နို့',
    interval: 2 * 60 * 60 * 1000, amount: 2
  },
  duck: {
    name: 'ဘဲ', emoji: '🦆', price: 350,
    product: 'duck_egg', productName: 'ဘဲဥ',
    interval: 90 * 60 * 1000, amount: 2
  },
  pig: {
    name: 'ဝက်', emoji: '🐖', price: 800,
    product: 'manure', productName: 'မြေဩဇာ',
    interval: 4 * 60 * 60 * 1000, amount: 2
  },
  rabbit: {
    name: 'ယုန်', emoji: '🐇', price: 500,
    product: 'rabbit_fur', productName: 'ယုန်မွေး',
    interval: 3 * 60 * 60 * 1000, amount: 1
  },
  buffalo: {
    name: 'ကျွဲ', emoji: '🐃', price: 1600,
    product: 'buffalo_milk', productName: 'ကျွဲနို့',
    interval: 4 * 60 * 60 * 1000, amount: 3
  },
  bee: {
    name: 'ပျားအုံ', emoji: '🐝', price: 650,
    product: 'honey', productName: 'ပျားရည်',
    interval: 4 * 60 * 60 * 1000, amount: 2
  },
  horse: {
    name: 'မြင်း', emoji: '🐎', price: 2200,
    product: 'manure', productName: 'မြေဩဇာ',
    interval: 6 * 60 * 60 * 1000, amount: 2
  }
};

const products = {
  egg: { name: 'ကြက်ဥ', price: 25 },
  milk: { name: 'နို့', price: 45 },
  wool: { name: 'သိုးမွေး', price: 65 },
  goat_milk: { name: 'ဆိတ်နို့', price: 55 },
  duck_egg: { name: 'ဘဲဥ', price: 32 },
  manure: { name: 'မြေဩဇာ', price: 20 },
  rabbit_fur: { name: 'ယုန်မွေး', price: 60 },
  buffalo_milk: { name: 'ကျွဲနို့', price: 70 },
  honey: { name: 'ပျားရည်', price: 90 },
  flour: { name: 'ဂျုံမှုန့်', price: 90 },
  bread: { name: 'ပေါင်မုန့်', price: 180 },
  cheese: { name: 'ချိစ်', price: 220 },
  butter: { name: 'ထောပတ်', price: 150 },
  strawberry_jam: { name: 'စတော်ဘယ်ရီယို', price: 260 },
  fabric: { name: 'အထည်', price: 250 },
  plank: { name: 'သစ်သားပြား', price: 80 }
};

const recipes = {
  flour: {
    name: 'ဂျုံမှုန့်', time: 5 * 60 * 1000,
    inputs: { wheat: 3 }, output: 1
  },
  bread: {
    name: 'ပေါင်မုန့်', time: 10 * 60 * 1000,
    inputs: { flour: 2, egg: 1 }, output: 1
  },
  cheese: {
    name: 'ချိစ်', time: 20 * 60 * 1000,
    inputs: { milk: 3 }, output: 1
  },
  butter: {
    name: 'ထောပတ်', time: 15 * 60 * 1000,
    inputs: { milk: 2 }, output: 1
  },
  strawberry_jam: {
    name: 'စတော်ဘယ်ရီယို', time: 15 * 60 * 1000,
    inputs: { strawberry: 4 }, output: 1
  },
  fabric: {
    name: 'အထည်', time: 20 * 60 * 1000,
    inputs: { wool: 3 }, output: 1
  }
};

const buildings = {
  house: { name: 'အိမ်', price: 1500, level: 1 },
  shop: { name: 'ဆိုင်', price: 3000, level: 1 },
  bakery: { name: 'မုန့်ဖို', price: 5000, level: 1 },
  dairy: { name: 'နို့ထွက်ပစ္စည်းစက်ရုံ', price: 7000, level: 1 },
  warehouse: { name: 'ဂိုဒေါင်', price: 2500, level: 1 },
  greenhouse: { name: 'ဖန်လုံအိမ်', price: 4000, level: 1 },
  water_tower: { name: 'ရေမျှော်စင်', price: 3500, level: 1 },
  power_plant: { name: 'လျှပ်စစ်စက်ရုံ', price: 6000, level: 1 },
  hospital: { name: 'ဆေးရုံ', price: 8000, level: 1 },
  school: { name: 'ကျောင်း', price: 6500, level: 1 }
};

const zones = [
  '🌾 Farming District',
  '🐄 Livestock District',
  '🏡 Residential District',
  '🏭 Industrial District',
  '🏪 Commercial District',
  '🌳 Nature & Exploration District'
];

// -------------------- DATABASE --------------------

let state = {
  players: {},
  cards: {},
  market: {},
  settings: {},
  logs: []
};

let saveTimer = null;
let saveQueue = Promise.resolve();
let dirty = false;

async function api(path, options = {}) {
  const response = await fetch(`${CONFIG.API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CONFIG.API_SECRET,
      ...(options.headers || {})
    }
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`NORA API ${response.status}: ${body}`);
  }

  return body ? JSON.parse(body) : {};
}

async function loadState() {
  const result = await api('/state');

  if (result && result.data && typeof result.data === 'object') {
    state = result.data;
  } else if (result && typeof result === 'object') {
    state = result;
  }

  state.players ||= {};
  state.cards ||= {};
  state.market ||= {};
  state.settings ||= {};
  state.logs ||= [];

  for (const player of Object.values(state.players)) {
    migratePlayer(player);
  }

  console.log('NORA database loaded.');
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveState().catch(console.error);
  }, CONFIG.SAVE_DELAY);
}

async function saveState() {
  if (!dirty) return saveQueue;

  dirty = false;
  const snapshot = JSON.stringify(state);

  saveQueue = saveQueue.then(async () => {
    await api('/state', {
      method: 'PUT',
      body: snapshot
    });
    console.log('NORA data saved.');
  }).catch(error => {
    dirty = true;
    console.error('Database save failed:', error);
  });

  return saveQueue;
}

function migratePlayer(p) {
  p.wallet = number(p.wallet, 0);
  p.bank = number(p.bank, 0);
  p.xp = number(p.xp, 0);
  p.level = Math.max(1, number(p.level, 1));
  p.inventory ||= {};
  p.inventory.seeds ||= {};
  p.inventory.crops ||= {};
  p.inventory.products ||= {};
  p.inventory.materials ||= {};
  p.farm ||= { plots: [] };
  p.farm.plots ||= [];
  p.farm.maxPlots = number(p.farm.maxPlots, 4);
  p.animals ||= {};
  p.factories ||= {};
  p.buildings ||= {};
  p.finance ||= { revenue: 0, expenses: 0, transactions: [] };
  p.finance.transactions ||= [];
  p.quests ||= {};
  p.achievements ||= [];
  p.reputation = number(p.reputation, 0);
  p.createdAt ||= now();
  p.lastDaily = number(p.lastDaily, 0);
  p.lastSeen = number(p.lastSeen, now());
  p.village ||= {
    name: 'Nora Village',
    population: 1,
    happiness: 50,
    rating: 1
  };
}

function getPlayer(id) {
  if (!state.players[id]) {
    state.players[id] = {
      wallet: 500,
      bank: 0,
      xp: 0,
      level: 1,
      inventory: {
        seeds: { wheat: 5, rice: 3, carrot: 2 },
        crops: {},
        products: {},
        materials: {}
      },
      farm: { plots: [], maxPlots: 4 },
      animals: {},
      factories: {},
      buildings: {},
      finance: { revenue: 0, expenses: 0, transactions: [] },
      quests: {},
      achievements: [],
      reputation: 0,
      createdAt: now(),
      lastDaily: 0,
      lastSeen: now(),
      village: {
        name: 'Nora Village',
        population: 1,
        happiness: 50,
        rating: 1
      }
    };
  }

  migratePlayer(state.players[id]);
  return state.players[id];
}

function addItem(p, category, item, amount) {
  p.inventory[category] ||= {};
  p.inventory[category][item] =
    number(p.inventory[category][item]) + amount;
}

function removeItem(p, category, item, amount) {
  const current = number(p.inventory[category]?.[item]);

  if (current < amount) return false;

  p.inventory[category][item] = current - amount;
  if (p.inventory[category][item] <= 0) {
    delete p.inventory[category][item];
  }
  return true;
}

function earn(p, amount, reason) {
  p.wallet += amount;
  p.finance.revenue += amount;
  p.finance.transactions.push({
    type: 'income',
    amount,
    reason,
    time: now()
  });
  p.finance.transactions = p.finance.transactions.slice(-100);
}

function spend(p, amount, reason) {
  if (p.wallet < amount) return false;

  p.wallet -= amount;
  p.finance.expenses += amount;
  p.finance.transactions.push({
    type: 'expense',
    amount,
    reason,
    time: now()
  });
  p.finance.transactions = p.finance.transactions.slice(-100);
  return true;
}

function addXP(p, amount) {
  p.xp += amount;
  let leveled = false;

  while (p.xp >= p.level * 100) {
    p.xp -= p.level * 100;
    p.level++;
    p.wallet += 100 * p.level;
    leveled = true;
  }

  return leveled;
}

// -------------------- UI HELPERS --------------------

function embed(title, description, color = 0xF5A9C8) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `NORA FARM & VILLAGE • v${VERSION}` })
    .setTimestamp();
}

function errorEmbed(message) {
  return embed('❌ လုပ်ဆောင်မှု မအောင်မြင်ပါ', message, 0xE74C3C);
}

function successEmbed(message) {
  return embed('✨ အောင်မြင်ပါပြီ', message, 0x2ECC71);
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('nora_farm')
      .setLabel('🌾 Farm')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('nora_wallet')
      .setLabel('💰 Wallet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('nora_animals')
      .setLabel('🐄 Animals')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('nora_village')
      .setLabel('🏡 Village')
      .setStyle(ButtonStyle.Secondary)
  );
}

function getPrice(item) {
  const base = crops[item]?.price || products[item]?.price || 10;
  const supply = number(state.market[item]?.supply, 100);
  const demand = number(state.market[item]?.demand, 100);
  const factor = Math.max(0.55, Math.min(1.8, 1 + (demand - supply) / 250));
  return Math.max(1, Math.round(base * factor));
}

function cropProgress(plot) {
  const crop = crops[plot.crop];
  if (!crop) return 0;

  return Math.min(
    100,
    Math.floor(((now() - plot.plantedAt) / crop.time) * 100)
  );
}

function plotReady(plot) {
  return cropProgress(plot) >= 100;
}

function getInventoryLines(items, definitions) {
  const entries = Object.entries(items || {})
    .filter(([, amount]) => number(amount) > 0);

  if (!entries.length) return 'မရှိသေးပါ။';

  return entries.map(([key, amount]) => {
    const item = definitions[key];
    return `${item?.emoji || '📦'} **${item?.name || products[key]?.name || key}** × ${amount}`;
  }).join('\n');
}

// -------------------- COMMANDS --------------------

async function command(message, raw) {
  const args = raw.trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();
  const p = getPlayer(message.author.id);
  const arg = args[0]?.toLowerCase();

  p.lastSeen = now();

  const send = (e, extra = {}) =>
    message.reply({ embeds: [e], ...extra });

  // HELP
  if (['help', 'h', 'commands'].includes(cmd)) {
    return send(embed(
      '🌸 NORA FARM & VILLAGE',
      [
        '**💰 Economy**',
        '`n wallet` / `nw` — ပိုက်ဆံ',
        '`n daily` / `nd` — နေ့စဉ်ဆု',
        '`n profile` / `np` — Profile',
        '`n inventory` / `ni` — ပစ္စည်းစာရင်း',
        '`n finance` / `nfi` — စာရင်းကိုင်',
        '',
        '**🌾 Farming**',
        '`nfarm` — လယ်ယာကြည့်ရန်',
        '`nplant wheat 1` — မျိုးစေ့စိုက်ရန်',
        '`nwater 1` — ရေလောင်းရန်',
        '`nharvest` — ရိတ်သိမ်းရန်',
        '`nseed` — မျိုးစေ့ဈေးနှုန်း',
        '',
        '**🐄 Livestock**',
        '`nanimals` — တိရစ္ဆာန်များ',
        '`nbuyanimal chicken 1` — ဝယ်ရန်',
        '`nfeed chicken` — အစာကျွေးရန်',
        '`ncollect` — ထွက်ကုန်စုရန်',
        '',
        '**🏭 Production**',
        '`nfactories` — စက်ရုံများ',
        '`nproduce flour` — ထုတ်လုပ်ရန်',
        '`nqueue` — ထုတ်လုပ်မှုစာရင်း',
        '',
        '**🏪 Market & Village**',
        '`nmarket` — ဈေးကွက်',
        '`nprices wheat` — ဈေးနှုန်း',
        '`nsell wheat 5` — ရောင်းရန်',
        '`nbuild house` — အဆောက်အအုံ',
        '`nvillage` — ရွာအခြေအနေ',
        '`nexplore` — စူးစမ်းရှာဖွေရန်',
        '',
        '**Commands ကို `n` နဲ့ဖြစ်စေ၊ အတိုကောက်နဲ့ဖြစ်စေ သုံးနိုင်ပါတယ်။**'
      ].join('\n')
    ), { components: [buttons()] });
  }

  // WALLET
  if (['wallet', 'w', 'balance', 'nw'].includes(cmd)) {
    return send(embed(
      '💰 NORA Wallet',
      `👛 Wallet: **${money(p.wallet)}**\n🏦 Bank: **${money(p.bank)}**\n⭐ Level: **${p.level}**\n✨ XP: **${p.xp}/${p.level * 100}**`
    ));
  }

  // PROFILE
  if (['profile', 'p', 'np'].includes(cmd)) {
    return send(embed(
      `🌸 ${safe(message.author.username)} ရဲ့ Profile`,
      `⭐ Level: **${p.level}**\n✨ XP: **${p.xp}/${p.level * 100}**\n💰 Wallet: **${money(p.wallet)}**\n🏦 Bank: **${money(p.bank)}**\n🌾 Farm Plots: **${p.farm.plots.length}/${p.farm.maxPlots}**\n🐄 Animal Types: **${Object.keys(p.animals).length}**\n🏡 Buildings: **${Object.keys(p.buildings).length}**\n🌟 Reputation: **${p.reputation}**`
    ));
  }

  // DAILY
  if (['daily', 'd', 'nd'].includes(cmd)) {
    const cooldown = 24 * 60 * 60 * 1000;
    const remaining = cooldown - (now() - p.lastDaily);

    if (remaining > 0) {
      const hours = Math.floor(remaining / 3600000);
      const mins = Math.ceil((remaining % 3600000) / 60000);
      return send(errorEmbed(`Daily ဆု ပြန်ယူရန် **${hours} နာရီ ${mins} မိနစ်** စောင့်ပါ။`));
    }

    const reward = 300 + p.level * 30;
    p.lastDaily = now();
    earn(p, reward, 'Daily Reward');
    addXP(p, 20);
    scheduleSave();

    return send(successEmbed(`🎁 Daily Reward ရရှိပါပြီ။\n💰 **${money(reward)}**\n✨ +20 XP`));
  }

  // INVENTORY
  if (['inventory', 'inv', 'i', 'ni'].includes(cmd)) {
    return send(embed(
      '🎒 Inventory',
      [
        '**🌱 Seeds**',
        getInventoryLines(p.inventory.seeds, crops),
        '',
        '**🌾 Harvested Crops**',
        getInventoryLines(p.inventory.crops, crops),
        '',
        '**🥛 Animal Products & Goods**',
        getInventoryLines(p.inventory.products, products),
        '',
        '**🪵 Materials**',
        getInventoryLines(p.inventory.materials, products)
      ].join('\n')
    ));
  }

  // FARM
  if (['farm', 'f', 'nf'].includes(cmd)) {
    const lines = [];

    for (let i = 0; i < p.farm.maxPlots; i++) {
      const plot = p.farm.plots[i];

      if (!plot) {
        lines.push(`**Plot ${i + 1}** — 🟫 မြေလွတ်`);
        continue;
      }

      const crop = crops[plot.crop];
      const progress = cropProgress(plot);
      lines.push(
        `**Plot ${i + 1}** — ${crop?.emoji || '🌱'} ${crop?.name || plot.crop}\n` +
        `${plotReady(plot) ? '✅ ရိတ်သိမ်းရန် အသင့်' : `⏳ Growth: ${progress}%`}\n` +
        `💧 Water: ${plot.watered ? 'ရေလောင်းပြီး' : 'ရေလောင်းရန်လို'}`
      );
    }

    return send(embed('🌾 Your Farm', lines.join('\n\n')));
  }

  // SEED SHOP
  if (['seed', 'seeds', 'seedshop'].includes(cmd)) {
    const lines = Object.entries(crops).map(([key, crop]) =>
      `${crop.emoji} **${crop.name}** — \`${key}\`\n` +
      `🌱 Seed: ${money(crop.seed)} | 💵 Sell: ${money(getPrice(key))} | ⏱ ${Math.round(crop.time / 60000)}m`
    );

    return send(embed('🌱 Seed Catalogue', lines.join('\n\n')));
  }

  // PLANT
  if (['plant', 'pl', 'npl'].includes(cmd)) {
    const cropKey = arg;
    const quantity = Math.max(1, Math.min(10, number(args[1], 1)));
    const crop = crops[cropKey];

    if (!crop) return send(errorEmbed('Crop အမည်မမှန်ပါ။ `n seed` ဖြင့် ရွေးချယ်ပါ။'));

    const empty = p.farm.maxPlots - p.farm.plots.length;
    if (empty < quantity) {
      return send(errorEmbed(`လွတ်နေတဲ့ Plot ${empty} ခုသာရှိပါတယ်။`));
    }

    if (number(p.inventory.seeds[cropKey]) < quantity) {
      return send(errorEmbed(`${crop.name} မျိုးစေ့ မလုံလောက်ပါ။`));
    }

    removeItem(p, 'seeds', cropKey, quantity);

    for (let i = 0; i < quantity; i++) {
      p.farm.plots.push({
        crop: cropKey,
        plantedAt: now(),
        watered: false,
        fertility: 100,
        quality: 'B'
      });
    }

    addXP(p, crop.xp * quantity);
    scheduleSave();

    return send(successEmbed(
      `${crop.emoji} **${crop.name} ${quantity} Plot** စိုက်ပြီးပါပြီ။\n⏱ ကြာချိန်: ${Math.round(crop.time / 60000)} မိနစ်`
    ));
  }

  // WATER
  if (['water', 'wa', 'nwa'].includes(cmd)) {
    const plotNo = number(arg, 1);
    const plot = p.farm.plots[plotNo - 1];

    if (!plot) return send(errorEmbed('အဲဒီ Plot မရှိပါ။'));
    if (plot.watered) return send(errorEmbed('ဒီ Plot ကို ရေလောင်းပြီးပါပြီ။'));

    plot.watered = true;
    plot.plantedAt -= Math.floor(crops[plot.crop].time * 0.05);
    addXP(p, 3);
    scheduleSave();

    return send(successEmbed(`💧 Plot ${plotNo} ကို ရေလောင်းပြီးပါပြီ။ Growth အနည်းငယ် မြန်သွားပါပြီ။`));
  }

  // HARVEST
  if (['harvest', 'ha', 'nh'].includes(cmd)) {
    const plotNo = arg ? number(arg, 0) : 0;

    const targets = plotNo
      ? [{ plot: p.farm.plots[plotNo - 1], index: plotNo - 1 }]
      : p.farm.plots.map((plot, index) => ({ plot, index }));

    if (!targets.length || targets.some(x => !x.plot)) {
      return send(errorEmbed('ရိတ်သိမ်းမည့် Plot မရှိပါ။'));
    }

    let harvested = 0;
    const results = [];

    for (const target of [...targets].sort((a, b) => b.index - a.index)) {
      const plot = target.plot;
      if (!plotReady(plot)) continue;

      const crop = crops[plot.crop];
      const amount = random(2, 4) + (plot.watered ? 1 : 0);

      addItem(p, 'crops', plot.crop, amount);
      addXP(p, crop.xp);
      harvested++;
      results.push(`${crop.emoji} ${crop.name} × ${amount}`);
      p.farm
