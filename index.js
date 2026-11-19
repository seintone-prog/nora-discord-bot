const {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const http = require("node:http");

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const API = (process.env.NORA_API_URL || "").replace(/\/+$/, "");
const SECRET = process.env.NORA_API_SECRET || process.env.API_SECRET;
const PORT = Number(process.env.PORT || 3000);

let dbLoaded = false, botReady = false, db;
let saveQueue = Promise.resolve();

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && ["/", "/health"].includes(req.url)) {
    const ok = dbLoaded && botReady;
    res.writeHead(req.url === "/health" && !ok ? 503 : 200);
    return res.end(JSON.stringify({
      ok, service: "Nora Discord Bot", version: "2.1.0",
      bot: botReady ? "online" : "starting",
      database: dbLoaded ? "connected" : "loading"
    }));
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});
server.listen(PORT, "0.0.0.0", () => console.log(`Nora HTTP server listening on ${PORT}`));

if (!TOKEN || !API || !SECRET) {
  console.error("Missing DISCORD_TOKEN, NORA_API_URL or NORA_API_SECRET.");
  process.exit(1);
}

const aliases = {
  nw:"wallet", np:"profile", nd:"daily", nc:"cards", ni:"inventory",
  ns:"summon", nq:"quest", nb:"battle", nm:"market", nlb:"leaderboard",
  na:"owner", nh:"help"
};
const rarityWeight = { Common:45, Rare:28, Epic:16, Legendary:7, Mythic:3, Limited:1 };
const rarityColor = {
  Common:0x9ca3af, Rare:0x3b82f6, Epic:0xa855f7,
  Legendary:0xf59e0b, Mythic:0xec4899, Limited:0xef4444
};
const defaults = {
  players:{}, cards:[], market:[],
  settings:{ maintenance:false, event:"ပုံမှန် Event" }, logs:[]
};

async function api(method="GET", body) {
  const res = await fetch(API + "/state", {
    method, headers:{"X-API-Key":SECRET,"Content-Type":"application/json"},
    body:body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Nora API ${res.status}: ${(await res.text()).slice(0,250)}`);
  return res.json();
}
async function load() {
  const data = await api();
  db = {
    ...defaults, ...data,
    players:data.players || {},
    cards:Array.isArray(data.cards) ? data.cards : [],
    market:Array.isArray(data.market) ? data.market : [],
    settings:{...defaults.settings,...(data.settings || {})},
    logs:Array.isArray(data.logs) ? data.logs : []
  };
  dbLoaded = true;
  console.log("Nora D1 database loaded.");
}
function save() {
  const snapshot = JSON.parse(JSON.stringify(db));
  const write = saveQueue.then(() => api("PUT", snapshot));
  saveQueue = write.catch(err => console.error("D1 save failed:", err));
  return write;
}
function getPlayer(id, name="Player") {
  if (!db.players[id]) db.players[id] = {
    id, username:name, coins:500, xp:0, level:1, cards:{}, pity:0,
    lastDaily:0, streak:0, wins:0, losses:0,
    quests:{daily:0,lastReset:new Date().toISOString().slice(0,10)},
    banned:false, banReason:"", achievements:[], totalEarned:0, totalSpent:0
  };
  const p = db.players[id];
  p.cards = p.cards || {};
  p.coins = Math.max(0, Number(p.coins || 0));
  p.xp = Math.max(0, Number(p.xp || 0));
  p.level = Math.max(1, Number(p.level || 1));
  p.pity = Number(p.pity || 0);
  p.streak = Number(p.streak || 0);
  p.wins = Number(p.wins || 0); p.losses = Number(p.losses || 0);
  p.quests = p.quests || {daily:0,lastReset:new Date().toISOString().slice(0,10)};
  p.banned = Boolean(p.banned);
  p.banReason = p.banReason || "";
  p.achievements = Array.isArray(p.achievements) ? p.achievements : [];
  p.totalEarned = Number(p.totalEarned || 0);
  p.totalSpent = Number(p.totalSpent || 0);
  p.username = name || p.username || "Player";
  return p;
}
function addCoins(p, amount) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  p.coins += amount; p.totalEarned += amount;
}
function spendCoins(p, amount) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  if (p.coins < amount) return false;
  p.coins -= amount; p.totalSpent += amount; return true;
}
function addXP(p, amount) {
  p.xp += Math.max(0, Math.floor(amount));
  let levels = 0;
  while (p.xp >= p.level * 100) {
    p.xp -= p.level * 100; p.level++; addCoins(p,100); levels++;
  }
  return levels;
}
function giveCard(p, card) {
  if (card) p.cards[card.id] = (p.cards[card.id] || 0) + 1;
}
function pick(list) {
  if (!list?.length) return null;
  const total = list.reduce((s,c)=>s+(rarityWeight[c.rarity]||0),0);
  if (!total) return list[Math.floor(Math.random()*list.length)];
  let roll = Math.random()*total;
  for (const card of list) { roll -= rarityWeight[card.rarity]||0; if (roll < 0) return card; }
  return list[0];
}
function embed(title, description, color=0xffb6d9) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description)
    .setFooter({text:"Nora • Cute Anime Game World 🌸"}).setTimestamp();
}
function isOwner(m) { return Boolean(OWNER_ID && m.author.id === OWNER_ID); }
function logOwner(action, m, target, detail) {
  db.logs.push({at:new Date().toISOString(),action,actor:m.author.id,target,detail});
  if (db.logs.length > 300) db.logs.shift();
}
function cardCount(p) { return Object.values(p.cards).reduce((a,b)=>a+Number(b||0),0); }
function achievementCheck(p) {
  const checks = [
    ["first_summon","ပထမဆုံး Card ရယူခြင်း",cardCount(p)>=1],
    ["collector_10","Card စုဆောင်းသူ",cardCount(p)>=10],
    ["battle_1","ပထမဆုံး အောင်ပွဲ",p.wins>=1],
    ["battle_10","တိုက်ပွဲဝါရင့်သူ",p.wins>=10],
    ["level_5","Level 5 ရောက်ရှိခြင်း",p.level>=5],
    ["daily_7","၇ ရက် Streak",p.streak>=7]
  ];
  const fresh = checks.filter(([id,,ok])=>ok && !p.achievements.includes(id));
  for (const [id] of fresh) p.achievements.push(id);
  return fresh.map(x=>x[1]);
}
function parseAmount(v) {
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 && n <= 1000000000 ? n : null;
}

async function runCommand(message) {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();
  let args=[], command="";
  const prefix = ["n ","N "].find(x=>content.startsWith(x));
  if (prefix) {
    args = content.slice(prefix.length).trim().split(/\s+/);
    command = (args.shift()||"").toLowerCase();
  } else {
    const parts = content.split(/\s+/);
    const short = (parts.shift()||"").toLowerCase();
    if (!Object.hasOwn(aliases, short)) return;
    command=short; args=parts;
  }
  if (!command) return;
  command = aliases[command] || command;

  try {
    const p = getPlayer(message.author.id,message.author.username);
    if (p.banned && !isOwner(message)) {
      return message.reply(`🚫 Nora အသုံးပြုခွင့် ပိတ်ထားပါတယ်။ အကြောင်းပြချက်: ${p.banReason || "မဖော်ပြထားပါ"}`);
    }
    if (db.settings.maintenance && !isOwner(message) && command!=="help")
      return message.reply("🛠️ Nora ကို ပြုပြင်ထိန်းသိမ်းနေပါတယ်။ ခဏနေရင် ပြန်လာခဲ့ပါ။");

    if (command==="help") {
      const e=embed("🌸 Nora 2.1 — Game Help","Nora Game World မှာ ကြိုဆိုပါတယ်။ အောက်ပါ Command တွေကို အသုံးပြုပါ။")
        .addFields(
          {name:"💰 Economy",value:"`n wallet` / `nw`\n`n daily` / `nd`",inline:true},
          {name:"👤 Player",value:"`n profile` / `np`\n`n leaderboard` / `nlb`",inline:true},
          {name:"🃏 Cards",value:"`n cards` / `nc`\n`n inventory` / `ni`\n`n card ID`",inline:true},
          {name:"✨ Summon",value:"`n summon` / `ns`\n`n summon 10`",inline:true},
          {name:"⚔️ Game",value:"`n quest` / `nq`\n`n battle` / `nb`",inline:true},
          {name:"🛒 Market",value:"`n market` / `nm`\n`n sell CARD_ID PRICE`\n`n buy LISTING_ID`",inline:true},
          {name:"🏅 Progress",value:"`n achievements`\n`n stats`",inline:true}
        );
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("nora_cards").setLabel("Cards").setEmoji("🃏").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("nora_games").setLabel("Games").setEmoji("🎮").setStyle(ButtonStyle.Primary)
      );
      if (isOwner(message)) e.addFields({name:"🔐 Owner",value:"`na` · `n owner help`"});
      return message.reply({embeds:[e],components:[row]});
    }

    if (command==="wallet")
      return message.reply({embeds:[embed("💰 Player Wallet",`👤 ${p.username}\n🪙 Coins: **${p.coins.toLocaleString()}**`,0xfbbf24)]});

    if (command==="profile") {
      const fresh=achievementCheck(p);
      if(fresh.length) await save();
      return message.reply({embeds:[embed("👤 Player Profile",
        `🌸 **${p.username}**\n⭐ Level: **${p.level}**\n✨ XP: **${p.xp}/${p.level*100}**\n🪙 Coins: **${p.coins.toLocaleString()}**\n🃏 Cards: **${cardCount(p)}**\n⚔️ Wins/Losses: **${p.wins}/${p.losses}**\n🏅 Achievements: **${p.achievements.length}**`)]});
    }

    if (command==="daily") {
      const now=Date.now(), elapsed=now-p.lastDaily, day=86400000;
      if(elapsed<day) {
        const left=day-elapsed;
        return message.reply(`⏳ Daily Reward ကို **${Math.floor(left/3600000)} နာရီ ${Math.floor(left%3600000/60000)} မိနစ်** ကြာမှ ပြန်ယူနိုင်ပါတယ်။`);
      }
      p.streak = elapsed < day*2 ? p.streak+1 : 1;
      const reward=250+Math.min(p.streak-1,7)*25;
      addCoins(p,reward); p.lastDaily=now;
      const levels=addXP(p,25), fresh=achievementCheck(p);
      await save();
      return message.reply({embeds:[embed("🎁 Daily Reward ရပါပြီ!",
        `🪙 +${reward} Coins\n✨ +25 XP\n🔥 Streak: **${p.streak}**${levels?`\n⭐ Level Up ×${levels}`:""}${fresh.length?`\n🏅 ${fresh.join("၊ ")}`:""}`,0x34d399)]});
    }

    if (command==="cards") {
      const desc=db.cards.map(c=>`**${c.id}** — ${c.name} · ${c.rarity} · ⚔️ ${c.power}`).join("\n")||"Card မရှိသေးပါ။";
      return message.reply({embeds:[embed("🃏 Nora Card Collection",desc)]});
    }
    if (command==="card") {
      const c=db.cards.find(x=>x.id===(args[0]||"").toUpperCase());
      if(!c) return message.reply("❌ Card ID မတွေ့ပါ။ `nc` ကို ကြည့်ပါ။");
      const e=embed("🃏 "+c.name,`ID: ${c.id}\nRarity: **${c.rarity}**\nPower: **${c.power}**\nAbility: ${c.ability||"မရှိသေးပါ"}\nပိုင်ဆိုင်မှု: **${p.cards[c.id]||0}**`,rarityColor[c.rarity]||0xffb6d9);
      if(c.image) e.setImage(c.image);
      return message.reply({embeds:[e]});
    }
    if (command==="inventory") {
      const owned=Object.entries(p.cards).filter(([,n])=>n>0);
      if(!owned.length) return message.reply("🎒 Card မရှိသေးပါ။ `ns` နဲ့ Summon လုပ်ပါ။");
      return message.reply({embeds:[embed("🎒 Your Card Inventory",owned.map(([id,n])=>{
        const c=db.cards.find(x=>x.id===id); return `**${id}** ${c?.name||"Unknown"} ×${n}`;
      }).join("\n"))]});
    }

    if (command==="summon") {
      if(!db.cards.length) return message.reply("❌ Card Database မရှိသေးပါ။");
      const amount=Number(args[0]||1);
      if(![1,10].includes(amount)) return message.reply("အသုံးပြုပုံ: `ns` သို့မဟုတ် `ns 10`");
      const cost=amount===1?1000:9000;
      if(!spendCoins(p,cost)) return message.reply(`🪙 Coin မလုံလောက်ပါ။ လိုအပ်ချက် **${cost.toLocaleString()} Coins**`);
      const results=[];
      for(let i=0;i<amount;i++){
        p.pity++; let c=pick(db.cards);
        if(p.pity>=80){
          const high=db.cards.filter(x=>["Legendary","Mythic","Limited"].includes(x.rarity));
          if(high.length){c=pick(high);p.pity=0;}
        } else if(p.pity>=30 && ["Common","Rare"].includes(c.rarity)){
          const mid=db.cards.filter(x=>["Epic","Legendary","Mythic","Limited"].includes(x.rarity));
          if(mid.length){c=pick(mid);p.pity=0;}
        } else if(["Legendary","Mythic","Limited"].includes(c.rarity)) p.pity=0;
        giveCard(p,c); results.push(c);
      }
      const fresh=achievementCheck(p); await save();
      const best=results.reduce((a,b)=>(rarityWeight[a.rarity]||0)<(rarityWeight[b.rarity]||0)?a:b);
      return message.reply({embeds:[embed("✨ Summon Result",
        `🪙 အသုံးပြု: **${cost.toLocaleString()}**\n${results.map((c,i)=>`**${i+1}. ${c.name}** · ${c.rarity} · \`${c.id}\``).join("\n")}\n\n💰 လက်ကျန်: **${p.coins.toLocaleString()}**${fresh.length?`\n🏅 ${fresh.join("၊ ")}`:""}`,
        rarityColor[best.rarity]||0xffb6d9)]});
    }

    if (command==="quest") {
      const today=new Date().toISOString().slice(0,10);
      if(p.quests.lastReset!==today) p.quests={daily:0,lastReset:today};
      if(p.quests.daily>=3) return message.reply("📜 ဒီနေ့ Quest ၃ ခု ပြီးပါပြီ။ မနက်ဖြန် ပြန်လာခဲ့ပါ။");
      p.quests.daily++; addCoins(p,150); const levels=addXP(p,35);
      const fresh=achievementCheck(p); await save();
      return message.reply({embeds:[embed("📜 Daily Quest Complete",
        `🪙 +150 Coins\n✨ +35 XP\nQuest: **${p.quests.daily}/3**${levels?`\n⭐ Level Up ×${levels}`:""}${fresh.length?`\n🏅 ${fresh.join("၊ ")}`:""}`,0x34d399)]});
    }

    if (command==="battle") {
      const owned=Object.entries(p.cards).filter(([,n])=>n>0);
      if(!owned.length) return message.reply("⚔️ အရင်ဆုံး `ns` နဲ့ Card တစ်ကတ် Summon လုပ်ပါ။");
      const [id]=owned[Math.floor(Math.random()*owned.length)], c=db.cards.find(x=>x.id===id);
      if(!c) return message.reply("❌ သင့် Card ကို Database မှာ မတွေ့ပါ။");
      const enemy=10+Math.floor(Math.random()*65), power=(c.power||10)+p.level*2, win=power>=enemy;
      if(win){p.wins++;addCoins(p,200);addXP(p,40);}else{p.losses++;addCoins(p,50);addXP(p,15);}
      const fresh=achievementCheck(p); await save();
      return message.reply({embeds:[embed(win?"🏆 Battle အနိုင်ရပါပြီ!":"⚔️ ဒီတစ်ကြိမ် ရှုံးနိမ့်သွားပါတယ်",
        `🃏 Card: **${c.name}**\n💪 သင့် Power: **${power}**\n👾 Enemy Power: **${enemy}**\n${win?"🪙 +200 Coins · +40 XP":"🪙 +50 Coins · +15 XP"}${fresh.length?`\n🏅 ${fresh.join("၊ ")}`:""}`,win?0x34d399:0xf59e0b)]});
    }

    if (command==="leaderboard") {
      const top=Object.values(db.players).filter(x=>!x.banned).sort((a,b)=>b.level-a.level||b.coins-a.coins).slice(0,10);
      return message.reply({embeds:[embed("🏆 Nora Leaderboard",top.map((x,i)=>`**${i+1}. ${x.username}** — Lv.${x.level} · 🪙 ${(x.coins||0).toLocaleString()}`).join("\n")||"Player မရှိသေးပါ။")]});
    }
    if (command==="achievements") {
      const labels={first_summon:"ပထမဆုံး Card ရယူခြင်း",collector_10:"Card စုဆောင်းသူ",battle_1:"ပထမဆုံး အောင်ပွဲ",battle_10:"တိုက်ပွဲဝါရင့်သူ",level_5:"Level 5 ရောက်ရှိခြင်း",daily_7:"၇ ရက် Streak"};
      return message.reply({embeds:[embed("🏅 Achievements",p.achievements.map(x=>"✅ "+(labels[x]||x)).join("\n")||"Achievement မရသေးပါ။")]});
    }
    if (command==="stats") {
      return message.reply({embeds:[embed("📊 Nora Player Stats",`👥 Players: **${Object.keys(db.players).length}**\n🃏 Cards: **${db.cards.length}**\n🛒 Market Listings: **${db.market.length}**\n🎉 Event: **${db.settings.event}**`)]});
    }

    if (command==="market") {
      if(!db.market.length) return message.reply("🛒 Market မှာ Card မရှိသေးပါ။");
      return message.reply({embeds:[embed("🛒 Nora Market",db.market.slice(0,15).map(x=>`**${x.cardId}** ${x.cardName} · 🪙 ${x.price} · <@${x.seller}> · ID \`${x.listingId}\``).join("\n"))]});
    }
    if (command==="sell") {
      const id=(args[0]||"").toUpperCase(), price=parseAmount(args[1]), c=db.cards.find(x=>x.id===id);
      if(!c||price===null||price<1||price>1000000) return message.reply("အသုံးပြုပုံ: `n sell CARD_ID PRICE`");
      if((p.cards[id]||0)<1) return message.reply("❌ ဒီ Card ကို မပိုင်ဆိုင်ပါ။");
      p.cards[id]--;
      const listingId="M"+Date.now().toString(36).toUpperCase();
      db.market.push({listingId,cardId:id,cardName:c.name,seller:message.author.id,price});
      await save(); return message.reply(`🛒 ${c.name} ကို ${price} Coins နဲ့ တင်ပြီးပါပြီ။ ID: \`${listingId}\``);
    }
    if (command==="buy") {
      const ix=db.market.findIndex(x=>x.listingId===(args[0]||""));
      if(ix<0) return message.reply("❌ Listing ID မတွေ့ပါ။");
      const item=db.market[ix];
      if(item.seller===message.author.id) return message.reply("ကိုယ့် Card ကို ကိုယ်ပြန်ဝယ်လို့မရပါ။");
      if(p.coins<item.price) return message.reply("🪙 Coin မလုံလောက်ပါ။");
      const c=db.cards.find(x=>x.id===item.cardId);
      if(!c) return message.reply("❌ ဒီ Card မရှိတော့ပါ။");
      const seller=getPlayer(item.seller,db.players[item.seller]?.username||"Player");
      if(!spendCoins(p,item.price)) return message.reply("🪙 Coin မလုံလောက်ပါ။");
      addCoins(seller,item.price); giveCard(p,c); db.market.splice(ix,1);
      await save(); return message.reply("✅ "+item.cardName+" ကို ဝယ်ယူပြီးပါပြီ။");
    }

    if (command==="owner") {
      if(!isOwner(message)) return message.reply("🔒 Owner သာ အသုံးပြုနိုင်ပါတယ်။");
      const sub=(args.shift()||"help").toLowerCase();
      if(sub==="help") return message.reply({embeds:[embed("🔐 Nora Owner Commands",
        "`na` — Admin Help\n`na addcoins USER_ID AMOUNT`\n`na removecoins USER_ID AMOUNT`\n`na setcoins USER_ID AMOUNT`\n`na addxp USER_ID AMOUNT`\n`na setlevel USER_ID LEVEL`\n`na givecard USER_ID CARD_ID`\n`na removecard USER_ID CARD_ID`\n`na ban USER_ID REASON`\n`na unban USER_ID`\n`na event EVENT_NAME`\n`na maintenance on/off`\n`na stats`\n`na backup`",0xef4444)]});
      if(["addcoins","removecoins","setcoins","addxp","setlevel"].includes(sub)){
        const id=args[0], amount=parseAmount(args[1]);
        if(!id||amount===null||amount>(sub==="setlevel"?10000:1000000000)) return message.reply(`အသုံးပြုပုံ: na ${sub} USER_ID AMOUNT`);
        const t=getPlayer(id,db.players[id]?.username||"Player");
        if(sub==="addcoins") addCoins(t,amount);
        if(sub==="removecoins") t.coins=Math.max(0,t.coins-amount);
        if(sub==="setcoins") t.coins=amount;
        if(sub==="addxp") addXP(t,amount);
        if(sub==="setlevel"){t.level=Math.max(1,amount);t.xp=0;}
        logOwner(sub,message,id,amount); await save();
        return message.reply(`🔐 ${sub} အောင်မြင်ပါပြီ။ ${id} · Coins ${t.coins} · Level ${t.level} · XP ${t.xp}`);
      }
      if(sub==="givecard"||sub==="removecard"){
        const id=args[0], card=db.cards.find(x=>x.id===(args[1]||"").toUpperCase());
        if(!id||!card) return message.reply(`အသုံးပြုပုံ: na ${sub} USER_ID CARD_ID`);
        const t=getPlayer(id,db.players[id]?.username||"Player");
        if(sub==="givecard") giveCard(t,card);
        else if((t.cards[card.id]||0)>0) t.cards[card.id]--;
        else return message.reply("ဒီ Player မှာ အဲဒီ Card မရှိပါ။");
        logOwner(sub,message,id,card.id); await save();
        return message.reply(`🔐 ${card.name} ${sub==="givecard"?"ပေးပြီးပါပြီ။":"ဖယ်ရှားပြီးပါပြီ။"}`);
      }
      if(sub==="ban"||sub==="unban"){
        const id=args.shift(); if(!id) return message.reply(`အသုံးပြုပုံ: na ${sub} USER_ID`);
        const t=getPlayer(id,db.players[id]?.username||"Player");
        t.banned=sub==="ban"; t.banReason=sub==="ban"?(args.join(" ")||"စည်းမျဉ်းချိုးဖောက်မှု"):"";
        logOwner(sub,message,id,t.banReason); await save();
        return message.reply(`🔐 ${id} ${sub==="ban"?"ပိတ်ပင်ပြီးပါပြီ။":"ပြန်ဖွင့်ပြီးပါပြီ။"}`);
      }
      if(sub==="event"){
        const name=args.join(" ").trim();
        if(!name) return message.reply("အသုံးပြုပုံ: na event EVENT_NAME");
        db.settings.event=name; logOwner("event",message,"all",name); await save();
        return message.reply(`🎉 Event ပြောင်းပြီးပါပြီ: **${name}**`);
      }
      if(sub==="maintenance"){
        if(!["on","off"].includes((args[0]||"").toLowerCase())) return message.reply("အသုံးပြုပုံ: na maintenance on/off");
        db.settings.maintenance=args[0].toLowerCase()==="on";
        logOwner(sub,message,"all",db.settings.maintenance); await save();
        return message.reply("🛠️ Maintenance: "+(db.settings.maintenance?"ON":"OFF"));
      }
      if(sub==="stats"){
        return message.reply({embeds:[embed("📊 Nora Admin Stats",`Players: **${Object.keys(db.players).length}**\nCards: **${db.cards.length}**\nMarket: **${db.market.length}**\nBanned: **${Object.values(db.players).filter(x=>x.banned).length}**\nEvent: **${db.settings.event}**\nMaintenance: **${db.settings.maintenance?"ON":"OFF"}**`)]});
      }
      if(sub==="backup"){await save();return message.reply("💾 D1 Database Save ပြီးပါပြီ။");}
      return message.reply("Command မသိပါ။ `na` ကိုကြည့်ပါ။");
    }
    return message.reply("🌸 Command မသိပါ။ `n help` ကို ကြည့်ပါ။");
  } catch(err) {
    console.error("Command failed:",err);
    return message.reply("⚠️ Nora API/Database မှာ ပြဿနာရှိနေပါတယ်။ Owner ကို အသိပေးပါ။").catch(()=>{});
  }
}

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
client.once("ready",()=>{
  botReady=true; console.log("Nora online as "+client.user.tag);
  client.user.setPresence({activities:[{name:"Cute Anime Card Game 🌸",type:0}],status:"online"});
});
client.on("messageCreate",runCommand);
client.on("interactionCreate",async interaction=>{
  if(!interaction.isButton()) return;
  try{
    if(interaction.customId==="nora_cards") return interaction.reply({content:"🃏 `nc` Card စာရင်း · `ns` Summon · `ni` Inventory · `n card ID` အသေးစိတ်",ephemeral:true});
    if(interaction.customId==="nora_games") return interaction.reply({content:"🎮 `nq` Quest · `nb` Battle · `nlb` Leaderboard · `n achievements`",ephemeral:true});
  }catch(err){console.error("Button error:",err);}
});
client.on("error",err=>console.error("Discord error:",err));
process.on("unhandledRejection",err=>console.error("Unhandled rejection:",err));

(async()=>{
  try{await load();console.log("Nora D1 state loaded.");await client.login(TOKEN);}
  catch(err){console.error("Nora startup failed:",err);process.exit(1);}
})();
