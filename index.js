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

// ================= SISTEMA =================
const sessions = {};
const adv = {};
const lastMsg = {};
const banned = {};
const cart = {};
const verified = {};

// ================= IDENTIDADE =================
const BOT_VERSION = "v1.0";
const OWNER = "Faelzin";

const INFO_TEXT =
`⚡Dono: ${OWNER} (UID ativo)
⚡Created date: 19.04.2026
⚡version atual: ${BOT_VERSION}

Redes sociais:
Facebook: Rafael Matos
Whatsapp: 51981528372
Instagram: @Infinity_cliente_oficial
Twitter: @InfinityCliente

Sistema: Render + Firebase
Status: Online`;


// ================= ÁUDIOS =================
const audioURL = "https://files.catbox.moe/p6wlxb.mp3";
const audioCadastro = "https://files.catbox.moe/9dv9ln.mp3";

// ================= PALAVRÕES =================
const blockedWords = ["foda","merda","puta","bosta","scam","fraude","hack","roubo"];

// ================= START =================
bot.onText(/\/start$/, async (msg) => {

const chatId = msg.chat.id;

await bot.sendMessage(chatId, INFO_TEXT);

await bot.sendAudio(chatId, audioURL);

await bot.sendMessage(chatId,
`⏳ aguarde estamos configurando servidor do bot...`);

setTimeout(() => {
bot.sendMessage(chatId,
`📌 CADASTRO OBRIGATÓRIO:

nome:
idade:
estado:
cidade:
whatsapp número:
instagram @:`);
}, 4000);

});

// ================= CADASTRO FIREBASE =================
bot.on("message", async (msg) => {

if (!msg.text) return;
if (msg.text.startsWith("/")) return;

const text = msg.text.toLowerCase();

// detecta cadastro
if (
text.includes("nome:") &&
text.includes("idade:") &&
text.includes("estado:") &&
text.includes("cidade:") &&
text.includes("whatsapp") &&
text.includes("instagram")
){
try {

await db.collection("usuarios").doc(String(msg.from.id)).set({
userId: msg.from.id,
username: msg.from.username || null,
dados: msg.text,
criadoEm: new Date().toISOString()
});

// salva como bloqueado temporário
verified[msg.from.id] = false;

await bot.sendAudio(msg.chat.id, audioCadastro);

await bot.sendMessage(msg.chat.id,
`✅ CADASTRO SALVO

⏳ aguarde 15 segundos estamos preparando material...`);

setTimeout(() => {

verified[msg.from.id] = true;

bot.sendMessage(msg.chat.id,
`🎉 ACESSO LIBERADO!

Agora você pode usar todos os comandos:
/menu /produtos /lojas /status`);

}, 15000);

} catch (err) {
bot.sendMessage(msg.chat.id,"❌ erro ao salvar cadastro");
}
}
});

// ================= BLOQUEIO DE COMANDOS =================
function checkAccess(msg, next) {
if (verified[msg.from.id] === false) {
return bot.sendMessage(msg.chat.id,
`⛔ Aguarde liberação do sistema...`);
}
next();
}

// ================= MENU =================
bot.onText(/\/menu/, (msg) => {
checkAccess(msg, () => {
bot.sendMessage(msg.chat.id,
`📌 MENU COMPLETO

🛒 /produtos
➕ /addproduto nome|valor
🗑 /deletar ID

🏪 /lojas
🔗 /minhaloja nome

🏆 /status`);
});
});

// ================= LOJA =================
bot.onText(/\/minhaloja (.+)/, async (msg, match) => {
checkAccess(msg, async () => {
await db.collection("users").doc(String(msg.from.id)).set({
nomeLoja: match[1],
uid: msg.from.id,
rating: 5
});
bot.sendMessage(msg.chat.id,"🏪 Loja criada");
});
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {
checkAccess(msg, async () => {

const snap = await db.collection("produtos").get();

let text = "🛒 PRODUTOS:\n\n";

snap.forEach(doc => {
const p = doc.data();
text += `⚡ ${p.nome}\n💰 R$ ${p.valor}\n🆔 ${doc.id}\n━━━━━━━━━━━\n`;
});

bot.sendMessage(msg.chat.id, text);
});
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
bot.sendMessage(msg.chat.id,
`Bot online ⚡
DEV: ${OWNER}`);
});

// ================= IA + ANTI-SPAM =================
bot.on("message", async (msg) => {
if (!msg.text) return;

const userId = msg.from.id;
const text = msg.text.toLowerCase();

if (text.startsWith("/")) return;

if (banned[userId] && Date.now() < banned[userId]) {
return bot.sendMessage(msg.chat.id,"⚠️ Conta suspensa");
}

if (lastMsg[userId] && Date.now() - lastMsg[userId] < 2000) return;

lastMsg[userId] = Date.now();

if (blockedWords.some(w => text.includes(w))) {
return bot.sendMessage(msg.chat.id,"⚠️ linguagem proibida");
}
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
await bot.setWebHook(`${URL}/webhook`);
console.log("🔥 INFINITY BOT v3.2 ONLINE COM CADASTRO + LIBERAÇÃO");
});
