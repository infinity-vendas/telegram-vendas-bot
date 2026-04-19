const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const ADMINS = ["6863505946"];

const serviceAccount = require("./firebase.json");

admin.initializeApp({
credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

app.post("/webhook", (req, res) => {
bot.processUpdate(req.body);
res.sendStatus(200);
});

// ================= CONTROLE =================
const cadastroStep = {};
const cadastroData = {};
const verified = {};

// ================= IDENTIDADE (MANTIDA) =================
const OWNER = "Faelzin";
const BOT_VERSION = "v4.1";

const INFO_TEXT =
`⚡INFINITY CLIENTE VENDAS ON-LINE

+10X comandos atualizados todos os dias
Bot funcionando perfeitamente, sem bugs

🔥 Melhor bot Beta atualizado

━━━━━━━━━━━━━━

⚡version atual: ${BOT_VERSION}
⚡whatsapp 51981528372
⚡suporte: suporte@InfinityTermux.com

📢 Redes sociais:
@Infinity_termux_ofc
YouTube @Infinity_termux_ofc
Telegram @InfinityTermux`;

// ================= ÁUDIOS =================
const audio1 = "https://files.catbox.moe/p6wlxb.mp3";
const audio2 = "https://files.catbox.moe/9dv9ln.mp3";

// ================= DDD BR =================
const validDDDs = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];

function validPhone(num){
if(!/^\d{10,11}$/.test(num)) return false;
return validDDDs.includes(parseInt(num.substring(0,2)));
}

// ================= START =================
bot.onText(/\/start/, async (msg)=>{

const chatId = msg.chat.id;

await bot.sendMessage(chatId, INFO_TEXT);
await bot.sendAudio(chatId, audio1);

setTimeout(()=>{
cadastroStep[msg.from.id] = "nome";

bot.sendMessage(chatId,
`🆔⚡Autenticação pré - necessário

Insira nome:
Insira whatsapp (DDD + número)

Suas informações são seguras`);
}, 3000);
});

// ================= CADASTRO ÚNICO =================
bot.on("message", async (msg)=>{

if(!msg.text) return;
if(msg.text.startsWith("/")) return;

const id = msg.from.id;
const text = msg.text.trim();

if(!cadastroStep[id]) return;

if(!cadastroData[id]) cadastroData[id] = {};

// ---------- NOME ----------
if(cadastroStep[id] === "nome"){

if(text.length < 2)
return bot.sendMessage(msg.chat.id,"❌ Nome inválido");

cadastroData[id].nome = text;
cadastroStep[id] = "whatsapp";

return bot.sendMessage(msg.chat.id,"📱 WhatsApp (DDD + número):");
}

// ---------- WHATSAPP ----------
if(cadastroStep[id] === "whatsapp"){

if(!validPhone(text))
return bot.sendMessage(msg.chat.id,"❌ WhatsApp inválido (DDD BR)");

cadastroData[id].whatsapp = text;

// salva firebase
try{

await db.collection("usuarios").doc(String(id)).set({
userId: id,
username: msg.from.username || null,
nome: cadastroData[id].nome,
whatsapp: cadastroData[id].whatsapp,
createdAt: new Date().toISOString()
});

verified[id] = false;

// áudio final
await bot.sendAudio(msg.chat.id, audio2);

await bot.sendMessage(msg.chat.id,
`✅ CADASTRO SALVO

⏳ aguarde 15 segundos...`);

setTimeout(()=>{

verified[id] = true;

bot.sendMessage(msg.chat.id,
`🎉 ACESSO LIBERADO!

/menu /produtos /status`);
},15000);

// limpa
delete cadastroStep[id];
delete cadastroData[id];

}catch(e){
bot.sendMessage(msg.chat.id,"❌ erro ao salvar cadastro");
}
}
});

// ================= PROTEÇÃO =================
function checkAccess(msg,next){
if(!verified[msg.from.id]){
return bot.sendMessage(msg.chat.id,"⛔ Aguarde liberação...");
}
next();
}

// ================= MENU =================
bot.onText(/\/menu/, (msg)=>{
checkAccess(msg, ()=>{
bot.sendMessage(msg.chat.id,
`📌 MENU

🛒 /produtos
🏪 /status
🔐 /resetprodutos (admin)`);
});
});

// ================= RESET PRODUTOS (ADMIN) =================
bot.onText(/\/resetprodutos/, async (msg)=>{

if(!ADMINS.includes(String(msg.from.id))){
return bot.sendMessage(msg.chat.id,"⛔ Sem permissão");
}

const snap = await db.collection("produtos").get();
const batch = db.batch();

snap.forEach(d => batch.delete(d.ref));
await batch.commit();

bot.sendMessage(msg.chat.id,"🗑 Produtos resetados com sucesso");
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg)=>{
checkAccess(msg, async ()=>{

const snap = await db.collection("produtos").get();

let text = "🛒 PRODUTOS:\n\n";

snap.forEach(d=>{
const p = d.data();
text += `⚡ ${p.nome}\n💰 R$ ${p.valor}\n━━━━━━━━━━━\n`;
});

bot.sendMessage(msg.chat.id,text);
});
});

// ================= STATUS =================
bot.onText(/\/status/, (msg)=>{
bot.sendMessage(msg.chat.id,
`Bot online ⚡
DEV: ${OWNER}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async ()=>{
await bot.setWebHook(`${URL}/webhook`);
console.log("🔥 BOT v4.1 ONLINE CORRIGIDO");
});
