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
const verified = {};

// ================= CONTROLE CADASTRO =================
const cadastroStep = {};
const cadastroData = {};

// ================= IDENTIDADE =================
const BOT_VERSION = "v1";
const OWNER = "Faelzin";

const INFO_TEXT =
`⚡INFINITY CLIENTE VENDAS ON-LINE

+10X comandos atualizados todos os dias

Bot funcionando perfeitamente, sem bugs, erros externos

Feedback de clientes em tempo real

Vínculos de novos produtos 100% em tempo real

🔥 Melhor bot Beta atualizado para vendas e divulgações em tempo real

━━━━━━━━━━━━━━

⚡Valid: 21.04.2026 - 23:50
⚡Type: Free
⚡version atual: ${BOT_VERSION}
⚡whatsapp 51981528372 - desenvolvedor oficial
⚡suporte: suporte@InfinityTermux.com`;

// ================= ÁUDIOS =================
const audioURL = "https://files.catbox.moe/p6wlxb.mp3";
const audioCadastro = "https://files.catbox.moe/9dv9ln.mp3";

// ================= START =================
bot.onText(/\/start$/, async (msg) => {

const chatId = msg.chat.id;

await bot.sendMessage(chatId, INFO_TEXT);
await bot.sendAudio(chatId, audioURL);

await bot.sendMessage(chatId,
`⏳ Aguarde estamos configurando servidor do bot...`);

setTimeout(() => {

cadastroStep[msg.from.id] = "nome";

bot.sendMessage(chatId,
`🆔⚡Autenticação pré - necessário , informe os dados corretos favor ⚡

nome:
sobrenome:
idade:
cidade:
whatsapp:

🔒 Suas informações são seguras, ninguém tem acesso

Insira nome:`);

}, 4000);

});

// ================= CADASTRO =================
bot.on("message", async (msg) => {

if (!msg.text) return;
if (msg.text.startsWith("/")) return;

const userId = msg.from.id;
const text = msg.text;

if (!cadastroStep[userId]) return;

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
cadastroData[userId].idade = text;
cadastroStep[userId] = "cidade";
return bot.sendMessage(msg.chat.id, "Cidade:");

case "cidade":
cadastroData[userId].cidade = text;
cadastroStep[userId] = "whatsapp";
return bot.sendMessage(msg.chat.id, "WhatsApp:");

case "whatsapp":

cadastroData[userId].whatsapp = text;

try {

await db.collection("usuarios").doc(String(userId)).set({
userId: userId,
username: msg.from.username || null,
...cadastroData[userId],
criadoEm: new Date().toISOString()
});

verified[userId] = false;

await bot.sendAudio(msg.chat.id, audioCadastro);

await bot.sendMessage(msg.chat.id,
`✅ CADASTRO SALVO

⏳ aguarde 15 segundos estamos preparando material...`);

setTimeout(() => {

verified[userId] = true;

bot.sendMessage(msg.chat.id,
`🎉 ACESSO LIBERADO!

Agora você pode usar:
/menu /produtos /lojas /status`);

}, 15000);

delete cadastroStep[userId];
delete cadastroData[userId];

} catch (err) {
bot.sendMessage(msg.chat.id,"❌ erro ao salvar cadastro");
}

break;
}

});

// ================= BLOQUEIO =================
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
🏪 /lojas
🏆 /status

🔐 ADMIN:
/resetprodutos`);
});
});

// ================= RESET PRODUTOS =================
bot.onText(/\/resetprodutos/, async (msg) => {

if (!ADMINS.includes(String(msg.from.id))) {
return bot.sendMessage(msg.chat.id, "⛔ Acesso negado");
}

const snap = await db.collection("produtos").get();
const batch = db.batch();

snap.forEach(doc => {
batch.delete(doc.ref);
});

await batch.commit();

bot.sendMessage(msg.chat.id, "🗑 Produtos resetados");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
await bot.setWebHook(`${URL}/webhook`);
console.log("🔥 INFINITY BOT v3.7 ONLINE");
});
