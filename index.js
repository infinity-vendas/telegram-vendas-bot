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

// ================= IDENTIDADE NOVA =================
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
⚡suporte: suporte@InfinityTermux.com

⚠️ Aviso: compre somente com administrador oficial
Evite golpes, fraudes etc

📦 Entregas via: e-mail, whatsapp, instagram e discord

⚡ Pagamento validado por UID
⚡ Sistema anti-fraude ativo

📢 Redes sociais:
@Infinity_termux_ofc
YouTube @Infinity_termux_ofc
Telegram @InfinityTermux
TikTok: Em breve
Kwai: Em breve`;

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
`⏳ Aguarde estamos configurando servidor do bot...

📡 STATUS: inicializando sistema seguro`);

setTimeout(() => {
bot.sendMessage(chatId,
`📌 CADASTRO OBRIGATÓRIO:

*Insira nome:
*Insira idade:
*cidade:
*estado:
*whatsapp:
*Instagram:`);
}, 4000);

});

// ================= CADASTRO =================
bot.on("message", async (msg) => {

if (!msg.text) return;
if (msg.text.startsWith("/")) return;

const text = msg.text.toLowerCase();

// valida cadastro completo
const valid =
text.includes("nome") &&
text.includes("idade") &&
text.includes("cidade") &&
text.includes("estado") &&
text.includes("whatsapp") &&
text.includes("instagram");

// se estiver incompleto
if (text.includes("nome") || text.includes("idade") || text.includes("cidade") || text.includes("estado") || text.includes("whatsapp") || text.includes("instagram")) {

if (!valid) {
return bot.sendMessage(msg.chat.id,
`❌ Erro: completo necessário completar cadastrado ☹️`);
}

try {

// salva no firebase
await db.collection("usuarios").doc(String(msg.from.id)).set({
userId: msg.from.id,
username: msg.from.username || null,
dados: msg.text,
criadoEm: new Date().toISOString()
});

verified[msg.from.id] = false;

// áudio final
await bot.sendAudio(msg.chat.id, audioCadastro);

await bot.sendMessage(msg.chat.id,
`✅ CADASTRO SALVO

⏳ aguarde 15 segundos estamos preparando material...`);

// libera após 15s
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

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
await bot.setWebHook(`${URL}/webhook`);
console.log("🔥 INFINITY BOT v3.4 ONLINE COM CADASTRO OBRIGATÓRIO");
});
