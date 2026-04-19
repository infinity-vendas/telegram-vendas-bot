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
const lastMsg = {};
const banned = {};
const verified = {};

const cadastroStep = {};
const cadastroData = {};
const tentativaCadastro = {};
const usuariosSuspeitos = {};

// ================= IDENTIDADE =================
const BOT_VERSION = "v3.8";
const OWNER = "Faelzin";

const INFO_TEXT =
`⚡INFINITY CLIENTE VENDAS ON-LINE

+10X comandos atualizados todos os dias
Bot funcionando perfeitamente
Feedback em tempo real
Sistema anti-fraude ativo

━━━━━━━━━━━━━━

⚡version atual: ${BOT_VERSION}
⚡WhatsApp: 51981528372
⚡suporte: suporte@InfinityTermux.com`;

// ================= ÁUDIOS =================
const audioURL = "https://files.catbox.moe/p6wlxb.mp3";
const audioCadastro = "https://files.catbox.moe/9dv9ln.mp3";

// ================= ANTI-FAKE =================
function isFakeText(text) {
const t = text.toLowerCase();

if (/^(.)\1+$/.test(t)) return true;
if (/^\d+$/.test(t)) return true;
if (t.length < 2) return true;

const fakeWords = ["teste","aaa","bbb","123","fake"];
if (fakeWords.some(w => t.includes(w))) return true;

return false;
}

// ================= START =================
bot.onText(/\/start$/, async (msg) => {

const chatId = msg.chat.id;

await bot.sendMessage(chatId, INFO_TEXT);
await bot.sendAudio(chatId, audioURL);

setTimeout(() => {

cadastroStep[msg.from.id] = "nome";

bot.sendMessage(chatId,
`🆔⚡ Autenticação necessária

nome:
sobrenome:
idade:
cidade:
whatsapp:

🔒 dados protegidos`);

}, 4000);

});

// ================= CADASTRO =================
bot.on("message", async (msg) => {

if (!msg.text) return;
if (msg.text.startsWith("/")) return;

const userId = msg.from.id;
const text = msg.text.trim();

if (!cadastroStep[userId]) return;

// tentativa anti spam
tentativaCadastro[userId] = (tentativaCadastro[userId] || 0) + 1;

if (tentativaCadastro[userId] > 20) {
usuariosSuspeitos[userId] = true;
return bot.sendMessage(msg.chat.id, "🚨 Usuário suspeito detectado.");
}

// bloqueia fake direto
if (isFakeText(text)) {
return bot.sendMessage(msg.chat.id, "❌ Dados inválidos.");
}

switch(cadastroStep[userId]) {

case "nome":
cadastroData[userId] = { nome: text };
cadastroStep[userId] = "sobrenome";
return bot.sendMessage(msg.chat.id, "Sobrenome:");

case "sobrenome":
cadastroData[userId].sobrenome = text;
cadastroStep[userId] = "idade";
return bot.sendMessage(msg.chat.id, "Idade:");

case "idade":

if (isNaN(text) || text < 13 || text > 80) {
return bot.sendMessage(msg.chat.id, "❌ Idade inválida");
}

cadastroData[userId].idade = Number(text);
cadastroStep[userId] = "cidade";
return bot.sendMessage(msg.chat.id, "Cidade:");

case "cidade":
cadastroData[userId].cidade = text;
cadastroStep[userId] = "whatsapp";
return bot.sendMessage(msg.chat.id, "WhatsApp:");

case "whatsapp":

if (!/^\d{10,13}$/.test(text)) {
return bot.sendMessage(msg.chat.id, "❌ WhatsApp inválido");
}

cadastroData[userId].whatsapp = text;

try {

// bloqueia suspeito
if (usuariosSuspeitos[userId]) {
return bot.sendMessage(msg.chat.id, "⛔ Conta bloqueada.");
}

// salva Firebase
await db.collection("usuarios").doc(String(userId)).set({
userId,
username: msg.from.username || null,
...cadastroData[userId],
suspeito: false,
criadoEm: new Date().toISOString()
});

verified[userId] = false;

await bot.sendAudio(msg.chat.id, audioCadastro);

await bot.sendMessage(msg.chat.id,
`✅ CADASTRO SALVO

⏳ aguarde 15 segundos...`);

setTimeout(() => {

verified[userId] = true;

bot.sendMessage(msg.chat.id,
`🎉 ACESSO LIBERADO

/menu /produtos /lojas /status`);

}, 15000);

// limpa
delete cadastroStep[userId];
delete cadastroData[userId];

} catch (err) {
console.log(err);
bot.sendMessage(msg.chat.id, "❌ erro ao salvar cadastro");
}

break;
}

});

// ================= PROTEÇÃO =================
function checkAccess(msg, next) {
if (!verified[msg.from.id]) {
return bot.sendMessage(msg.chat.id, "⛔ Aguarde liberação...");
}
next();
}

// ================= MENU =================
bot.onText(/\/menu/, (msg) => {
checkAccess(msg, () => {
bot.sendMessage(msg.chat.id,
`📌 MENU

🛒 /produtos
🏪 /lojas
🏆 /status

🔐 ADMIN:
/resetprodutos`);
});
});

// ================= RESET PRODUTOS (ADMIN) =================
bot.onText(/\/resetprodutos/, async (msg) => {

if (!ADMINS.includes(String(msg.from.id))) {
return bot.sendMessage(msg.chat.id, "⛔ Sem permissão");
}

const snap = await db.collection("produtos").get();
const batch = db.batch();

snap.forEach(doc => batch.delete(doc.ref));

await batch.commit();

bot.sendMessage(msg.chat.id, "🗑 Produtos resetados");
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
bot.sendMessage(msg.chat.id,
`Bot online ⚡
DEV: ${OWNER}
VERSION: ${BOT_VERSION}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
await bot.setWebHook(`${URL}/webhook`);
console.log("🔥 INFINITY BOT v3.8 ONLINE");
});
