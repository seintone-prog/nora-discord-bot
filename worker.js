const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key"
};
const defaults = {
  players: {},
  cards: [
    {id:"NORA001",name:"Sakura Star",rarity:"Common",power:12,ability:"ပန်းရောင်ကြယ်စွမ်းအား",image:null},
    {id:"NORA002",name:"Moonlight Idol",rarity:"Rare",power:22,ability:"လရောင်ကာကွယ်မှု",image:null},
    {id:"NORA003",name:"Crystal Witch",rarity:"Epic",power:35,ability:"ခရစ္စတယ်မှော်",image:null},
    {id:"NORA004",name:"Golden Empress",rarity:"Legendary",power:55,ability:"ရွှေရောင်အာဏာ",image:null},
    {id:"NORA005",name:"Celestial Queen",rarity:"Mythic",power:80,ability:"ကောင်းကင်ဒဏ္ဍာရီ",image:null},
    {id:"NORA006",name:"Crimson Phoenix",rarity:"Limited",power:95,ability:"မီးတောက်ပြန်လည်မွေးဖွားခြင်း",image:null}
  ],
  market: [], settings: {maintenance:false,event:"ပုံမှန် Event"}, logs: []
};
const response = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers:{...cors,"Content-Type":"application/json; charset=utf-8"}
});
export default {
 async fetch(request, env) {
  if (request.method === "OPTIONS") return new Response(null,{headers:cors});
  if (!env.DB || !env.API_SECRET) return response({error:"Worker configuration missing"},500);
  if (request.headers.get("X-API-Key") !== env.API_SECRET) return response({error:"Unauthorized"},401);
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") return response({ok:true,service:"Nora API",version:"2.0.0"});
  if (url.pathname !== "/state") return response({error:"Not found"},404);
  if (request.method === "GET") {
   const row = await env.DB.prepare("SELECT data_json FROM game_state WHERE id=1").first();
   if (!row) {
    await env.DB.prepare("INSERT INTO game_state (id,data_json,updated_at) VALUES (1,?,?)").bind(JSON.stringify(defaults),Date.now()).run();
    return response(defaults);
   }
   try { return response({...defaults,...JSON.parse(row.data_json)}); }
   catch { return response({error:"Stored game data is corrupted"},500); }
  }
  if (request.method !== "PUT") return response({error:"Method not allowed"},405);
  let body;
  try { body = await request.json(); } catch { return response({error:"Invalid JSON"},400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !body.players || typeof body.players !== "object" ||
      !Array.isArray(body.cards) || !Array.isArray(body.market)) {
    return response({error:"Invalid state payload"},400);
  }
  const state = {...defaults,...body};
  await env.DB.prepare(
   "INSERT INTO game_state (id,data_json,updated_at) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at"
  ).bind(JSON.stringify(state),Date.now()).run();
  return response({ok:true,saved_at:Date.now()});
 }
};
