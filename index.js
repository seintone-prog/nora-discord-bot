const {
 Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");

const TOKEN=process.env.DISCORD_TOKEN;
const OWNER_ID=process.env.OWNER_ID;
const API=(process.env.NORA_API_URL||"").replace(/\/$/,"");
const SECRET=process.env.NORA_API_SECRET;
if(!TOKEN || !API || !SECRET) {
 console.error("Set DISCORD_TOKEN, OWNER_ID, NORA_API_URL and NORA_API_SECRET.");
 process.exit(1);
}
const aliases={nw:"wallet",np:"profile",nd:"daily",nc:"cards",ni:"inventory",ns:"summon",nq:"quest",nb:"battle",nm:"market",nlb:"leaderboard"};
const rarityWeight={Common:45,Rare:28,Epic:16,Legendary:7,Mythic:3,Limited:1};
const rarityColor={Common:0x9ca3af,Rare:0x3b82f6,Epic:0xa855f7,Legendary:0xf59e0b,Mythic:0xec4899,Limited:0xef4444};
const defaults={players:{},cards:[],market:[],settings:{maintenance:false,event:"ပုံမှန် Event"},logs:[]};
let db, saveQueue=Promise.resolve();

async function api(method="GET",body) {
 const res=await fetch(API+"/state",{method,headers:{"X-API-Key":SECRET,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 if(!res.ok) throw new Error("Nora API "+res.status+": "+(await res.text()).slice(0,300));
 return res.json();
}
async function load(){db={...defaults,...await api()};}
function save(){
 const snapshot=JSON.parse(JSON.stringify(db));
 saveQueue=saveQueue.then(()=>api("PUT",snapshot)).catch(err=>console.error("D1 save failed:",err));
 return saveQueue;
}
function getPlayer(id,name){
 if(!db.players[id]) db.players[id]={id,username:name,coins:500,xp:0,level:1,cards:{},pity:0,lastDaily:0,streak:0,wins:0,losses:0,quests:{daily:0,lastReset:new Date().toISOString().slice(0,10)}};
 db.players[id].username=name;
 return db.players[id];
}
function addXP(p,n){
 p.xp+=n; let levels=0;
 while(p.xp>=p.level*100){p.xp-=p.level*100;p.level++;p.coins+=100;levels++;}
 return levels;
}
function giveCard(p,c){p.cards[c.id]=(p.cards[c.id]||0)+1;}
function pick(list){
 const total=list.reduce((s,c)=>s+(rarityWeight[c.rarity]||0),0);
 let roll=Math.random()*total;
 for(const c of list){roll-=rarityWeight[c.rarity]||0;if(roll<0)return c;}
 return list[0];
}
function embed(title,description,color=0xffb6d9){
 return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description)
  .setFooter({text:"Nora • Cute Anime Game World 🌸"}).setTimestamp();
}
function isOwner(m){return Boolean(OWNER_ID&&m.author.id===OWNER_ID);}
function logOwner(action,m,target,detail){
 db.logs.push({at:new Date().toISOString(),action,actor:m.author.id,target,detail});
 if(db.logs.length>300)db.logs.shift();
}
async function runCommand(m){
 if(m.author.bot||!m.guild)return;
 const prefix=["n ","N "].find(p=>m.content.startsWith(p));
 if(!prefix)return;
 const args=m.content.slice(prefix.length).trim().split(/\s+/);
 let command=(args.shift()||"").toLowerCase();
 if(!command)return;
 command=aliases[command]||command;
 try{
  const p=getPlayer(m.author.id,m.author.username);
  if(db.settings.maintenance&&!isOwner(m)&&command!=="help")
   return m.reply("🛠️ Nora ကို ပြုပြင်ထိန်းသိမ်းနေပါတယ်။ ခဏနေရင် ပြန်လာခဲ့ပါ။");
  if(command==="help"){
   const e=embed("🌸 Nora — Game Help","Nora Game World မှာ ကြိုဆိုပါတယ်။")
    .addFields(
     {name:"💰 Economy",value:"`n wallet` / `nw` · `n daily` / `nd`",inline:true},
     {name:"👤 Player",value:"`n profile` / `np` · `n leaderboard` / `nlb`",inline:true},
     {name:"🃏 Cards",value:"`n cards` / `nc` · `n inventory` / `ni` · `n card ID`",inline:true},
     {name:"✨ Summon",value:"`n summon` / `ns` · `n summon 10`",inline:true},
     {name:"⚔️ Game",value:"`n quest` / `nq` · `n battle` / `nb`",inline:true},
     {name:"🛒 Market",value:"`n market` / `nm` · `n sell ID PRICE` · `n buy ID`",inline:true});
   const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("nora_cards").setLabel("Cards").setEmoji("🃏").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("nora_games").setLabel("Games").setEmoji("🎮").setStyle(ButtonStyle.Primary));
   return m.reply({embeds:[e],components:[row]});
  }
  if(command==="wallet")
   return m.reply({embeds:[embed("💰 Player Wallet",`👤 ${p.username}\n🪙 Coins: **${p.coins.toLocaleString()}**`,0xfbbf24)]});
  if(command==="profile"){
   const count=Object.values(p.cards).reduce((a,b)=>a+b,0);
   return m.reply({embeds:[embed("👤 Player Profile",`🌸 **${p.username}**\n⭐ Level: **${p.level}**\n✨ XP: **${p.xp}/${p.level*100}**\n🪙 Coins: **${p.coins.toLocaleString()}**\n🃏 Cards: **${count}**\n⚔️ Wins/Losses: **${p.wins}/${p.losses}**`)]});
  }
  if(command==="daily"){
   const now=Date.now(),left=86400000-(now-p.lastDaily);
   if(left>0)return m.reply(`⏳ နောက် Daily Reward ကို **${Math.floor(left/3600000)} နာရီ ${Math.floor(left%3600000/60000)} မိနစ်** ကြာမှ ယူနိုင်ပါတယ်။`);
   const reward=250+Math.min(p.streak,7)*25;p.coins+=reward;p.lastDaily=now;p.streak++;
   const levels=addXP(p,25);await save();
   return m.reply({embeds:[embed("🎁 Daily Reward ရပါပြီ!",`🪙 +${reward} Coins\n✨ +25 XP\n🔥 Streak: ${p.streak}${levels?"\n⭐ Level Up!":""}`,0x34d399)]});
  }
  if(command==="cards"){
   return m.reply({embeds:[embed("🃏 Nora Card Collection",db.cards.map(c=>`**${c.id}** — ${c.name} · ${c.rarity} · ⚔️ ${c.power}`).join("\n")||"Card မရှိသေးပါ။")]});
  }
  if(command==="card"){
   const c=db.cards.find(x=>x.id===(args[0]||"").toUpperCase());
   if(!c)return m.reply("❌ Card ID မတွေ့ပါ။ `nc` ကို ကြည့်ပါ။");
   const e=embed("🃏 "+c.name,`ID: ${c.id}\nRarity: **${c.rarity}**\nPower: **${c.power}**\nAbility: ${c.ability}\nပိုင်ဆိုင်မှု: **${p.cards[c.id]||0}**`,rarityColor[c.rarity]);
   if(c.image)e.setImage(c.image);
   return m.reply({embeds:[e]});
  }
  if(command==="inventory"){
   const owned=Object.entries(p.cards).filter(([,n])=>n>0);
   if(!owned.length)return m.reply("🎒 Card မရှိသေးပါ။ `ns` နဲ့ Summon လုပ်ပါ။");
   return m.reply({embeds:[embed("🎒 Your Card Inventory",owned.map(([id,n])=>{const c=db.cards.find(x=>x.id===id);return `**${id}** ${c?.name||"Unknown"} ×${n}`;}).join("\n"))]});
  }
  if(command==="summon"){
   const amount=Number(args[0]||1);
   if(![1,10].includes(amount))return m.reply("အသုံးပြုပုံ: `ns` သို့မဟုတ် `ns 10`");
   const cost=amount===1?1000:9000;
   if(p.coins<cost)return m.reply(`🪙 Coin မလုံလောက်ပါ။ လိုအပ်ချက် **${cost.toLocaleString()} Coins**`);
   p.coins-=cost;const results=[];
   for(let i=0;i<amount;i++){
    p.pity++;let c=pick(db.cards);
    if(p.pity>=80){
     const high=db.cards.filter(x=>["Legendary","Mythic","Limited"].includes(x.rarity));
     if(high.length)c=pick(high);p.pity=0;
    }else if(p.pity>=30&&["Common","Rare"].includes(c.rarity)){
     const mid=db.cards.filter(x=>["Epic","Legendary","Mythic","Limited"].includes(x.rarity));
     if(mid.length)c=pick(mid);p.pity=0;
    }else if(["Legendary","Mythic","Limited"].includes(c.rarity))p.pity=0;
    giveCard(p,c);results.push(c);
   }
   await save();
   const best=results.reduce((a,b)=>(rarityWeight[a.rarity]||0)<(rarityWeight[b.rarity]||0)?a:b);
   return m.reply({embeds:[embed("✨ Summon Result",`🪙 အသုံးပြု: **${cost.toLocaleString()}**\n${results.map((c,i)=>`**${i+1}. ${c.name}** · ${c.rarity} · \`${c.id}\``).join("\n")}\n\n💰 လက်ကျန်: **${p.coins.toLocaleString()}**`,rarityColor[best.rarity])]});
  }
  if(command==="quest"){
   const today=new Date().toISOString().slice(0,10);
   if(p.quests.lastReset!==today)p.quests={daily:0,lastReset:today};
   if(p.quests.daily>=3)return m.reply("📜 ဒီနေ့ Quest ၃ ခု ပြီးပါပြီ။ မနက်ဖြန် ပြန်လာခဲ့ပါ။");
   p.quests.daily++;p.coins+=150;const levels=addXP(p,35);await save();
   return m.reply({embeds:[embed("📜 Daily Quest Complete",`🪙 +150 Coins\n✨ +35 XP\nQuest: **${p.quests.daily}/3**${levels?"\n⭐ Level Up!":""}`,0x34d399)]});
  }
  if(command==="battle"){
   const owned=Object.entries(p.cards).filter(([,n])=>n>0);
   if(!owned.length)return m.reply("⚔️ အရင်ဆုံး `ns` နဲ့ Card တစ်ကတ် Summon လုပ်ပါ။");
   const [id]=owned[Math.floor(Math.random()*owned.length)],c=db.cards.find(x=>x.id===id);
   const enemy=10+Math.floor(Math.random()*65),power=(c?.power||10)+p.level*2,win=power>=enemy;
   if(win){p.wins++;p.coins+=200;addXP(p,40);}else{p.losses++;p.coins+=50;addXP(p,15);}
   await save();
   return m.reply({embeds:[embed(win?"🏆 Battle အနိုင်ရပါပြီ!":"⚔️ ဒီတစ်ကြိမ် ရှုံးနိမ့်သွားပါတယ်",`🃏 Card: **${c?.name||id}**\n💪 သင့် Power: **${power}**\n👾 Enemy Power: **${enemy}**\n${win?"🪙 +200 Coins · +40 XP":"🪙 +50 Coins · +15 XP"}`,win?0x34d399:0xf59e0b)]});
  }
  if(command==="leaderboard"){
   const top=Object.values(db.players).sort((a,b)=>b.level-a.level||b.coins-a.coins).slice(0,10);
   return m.reply({embeds:[embed("🏆 Nora Leaderboard",top.map((x,i)=>`**${i+1}. ${x.username}** — Lv.${x.level} · 🪙 ${x.coins.toLocaleString()}`).join("\n")||"Player မရှိသေးပါ။")]});
  }
  if(command==="market"){
   if(!db.market.length)return m.reply("🛒 Market မှာ Card မရှိသေးပါ။");
   return m.reply({embeds:[embed("🛒 Nora Market",db.market.slice(0,15).map(x=>`**${x.cardId}** ${x.cardName} · 🪙 ${x.price} · <@${x.seller}> · ID \`${x.listingId}\``).join("\n"))]});
  }
  if(command==="sell"){
   const id=(args[0]||"").toUpperCase(),price=Number(args[1]),c=db.cards.find(x=>x.id===id);
   if(!c||!Number.isSafeInteger(price)||price<1||price>1000000)return m.reply("အသုံးပြုပုံ: `n sell CARD_ID PRICE`");
   if((p.cards[id]||0)<1)return m.reply("❌ ဒီ Card ကို မပိုင်ဆိုင်ပါ။");
   p.cards[id]--;const listingId="M"+Date.now().toString(36).toUpperCase();
   db.market.push({listingId,cardId:id,cardName:c.name,seller:m.author.id,price});await save();
   return m.reply(`🛒 ${c.name} ကို ${price} Coins နဲ့ တင်ပြီးပါပြီ။ ID: \`${listingId}\``);
  }
  if(command==="buy"){
   const ix=db.market.findIndex(x=>x.listingId===args[0]);
   if(ix<0)return m.reply("❌ Listing ID မတွေ့ပါ။");
   const item=db.market[ix];if(item.seller===m.author.id)return m.reply("ကိုယ့် Card ကို ကိုယ်ပြန်ဝယ်လို့မရပါ။");
   if(p.coins<item.price)return m.reply("🪙 Coin မလုံလောက်ပါ။");
   const c=db.cards.find(x=>x.id===item.cardId);if(!c)return m.reply("❌ ဒီ Card မရှိတော့ပါ။");
   const seller=getPlayer(item.seller,db.players[item.seller]?.username||"Player");
   p.coins-=item.price;seller.coins+=item.price;giveCard(p,c);db.market.splice(ix,1);await save();
   return m.reply("✅ "+item.cardName+" ကို ဝယ်ယူပြီးပါပြီ။");
  }
  if(command==="owner"){
   if(!isOwner(m))return m.reply("🔒 Owner သာ အသုံးပြုနိုင်ပါတယ်။");
   const sub=(args.shift()||"").toLowerCase();
   if(["addcoins","removecoins","setcoins"].includes(sub)){
    const id=args[0],n=Number(args[1]);
    if(!id||!Number.isSafeInteger(n)||n<0||n>1e9)return m.reply("အသုံးပြုပုံ: n owner addcoins USER_ID AMOUNT");
    const target=getPlayer(id,db.players[id]?.username||"Player");
    if(sub==="addcoins")target.coins+=n;
    if(sub==="removecoins")target.coins=Math.max(0,target.coins-n);
    if(sub==="setcoins")target.coins=n;
    logOwner(sub,m,id,n);await save();return m.reply(`🔐 ${id} Coin: **${target.coins.toLocaleString()}**`);
   }
   if(sub==="givecard"){
    const id=args[0],c=db.cards.find(x=>x.id===(args[1]||"").toUpperCase());
    if(!id||!c)return m.reply("အသုံးပြုပုံ: n owner givecard USER_ID CARD_ID");
    giveCard(getPlayer(id,db.players[id]?.username||"Player"),c);logOwner(sub,m,id,c.id);await save();return m.reply("🔐 "+c.name+" ပေးပြီးပါပြီ။");
   }
   if(sub==="maintenance"){
    db.settings.maintenance=args[0]==="on";logOwner(sub,m,"all",db.settings.maintenance);await save();
    return m.reply("🛠️ Maintenance: "+(db.settings.maintenance?"ON":"OFF"));
   }
   if(sub==="backup"){await save();return m.reply("💾 D1 Database မှာ Save ပြီးပါပြီ။");}
   return m.reply("Owner: addcoins/removecoins/setcoins USER_ID AMOUNT, givecard USER_ID CARD_ID, maintenance on/off, backup");
  }
  return m.reply("🌸 Command မသိပါ။ `n help` ကို ကြည့်ပါ။");
 }catch(err){console.error("Command failed",err);return m.reply("⚠️ Nora API/Database မှာ ပြဿနာရှိနေပါတယ်။ Owner ကို အသိပေးပါ။").catch(()=>{});}
}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
client.once("ready",()=>{console.log("Nora online as "+client.user.tag);client.user.setPresence({activities:[{name:"Cute Anime Card Game 🌸",type:0}],status:"online"});});
client.on("messageCreate",runCommand);
client.on("interactionCreate",async i=>{
 if(!i.isButton())return;
 if(i.customId==="nora_cards")return i.reply({content:"🃏 `nc` Card စာရင်း · `ns` Summon · `ni` Inventory · `n card ID` အသေးစိတ်",ephemeral:true});
 if(i.customId==="nora_games")return i.reply({content:"🎮 `nq` Quest · `nb` Battle · `nlb` Leaderboard",ephemeral:true});
});
client.on("error",e=>console.error("Discord error",e));
process.on("unhandledRejection",e=>console.error("Unhandled rejection",e));
(async()=>{try{await load();console.log("Nora D1 state loaded");await client.login(TOKEN);}catch(e){console.error("Nora startup failed",e);process.exit(1);}})();
