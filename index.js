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


// ================= IDENTIDADE (LAYOUT INICIAL) =================
const BOT_VERSION = "v1.0";
const OWNER = "Faelzin";

const INFO_TEXT =
`⚡Dono: ${OWNER} (UID ativo)
⚡Created date: 19.04.2026
⚡planos VIP e melhorias no sistema. Plano Free encerra dia 25.04.2026 - 23:50
⚡version atual: ${BOT_VERSION}
---------- ---------- ----------- ------

Redes sociais principal:
Facebook: Rafael Matos
Whatsapp: 51981528372
Instagram: @Infinity_cliente_oficial
Twitter: @InfinityCliente

--------- ------- ------- --------- -----

Sites registrados: Render (Hospedado)
Tipo: confidencial
Dados: armazenados no Firebase

Não coletamos dados sensíveis, apenas registro de acesso.

Contate: 51981528372

Sejam bem-vindos`;


// ================= ÁUDIO =================
const audioURL = "https://files.catbox.moe/p6wlxb.mp3";


// ================= PALAVRÕES =================
const blockedWords = [
    "foda", "merda", "puta", "bosta", "scam", "fraude", "hack", "roubo"
];


// ================= START =================
bot.onText(/\/start$/, async (msg) => {

    const chatId = msg.chat.id;

    await bot.sendMessage(chatId, INFO_TEXT);

    await bot.sendAudio(chatId, audioURL);

    await bot.sendMessage(chatId,
`⏳ aguarde estamos configurando servidor do bot...

📡 STATUS: inicializando sistema seguro`);

    setTimeout(() => {

        bot.sendMessage(chatId,
`📌 PARA CONTINUAR USANDO OS SERVIÇOS

É necessário se cadastrar em nosso sistema:

✍️ envie no formato abaixo:

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

    if (
        text.includes("nome:") &&
        text.includes("idade:") &&
        text.includes("estado:") &&
        text.includes("cidade:") &&
        text.includes("whatsapp") &&
        text.includes("instagram")
    ) {
        try {

            await db.collection("usuarios").doc(String(msg.from.id)).set({
                userId: msg.from.id,
                username: msg.from.username || null,
                dados: msg.text,
                criadoEm: new Date().toISOString()
            });

            bot.sendMessage(msg.chat.id,
`✅ CADASTRO SALVO COM SUCESSO

Agora você tem acesso liberado ao sistema.`);
        } catch (err) {
            bot.sendMessage(msg.chat.id,
`❌ erro ao salvar cadastro`);
        }
    }
});


// ================= MENU =================
bot.onText(/\/menu/, (msg) => {

    bot.sendMessage(msg.chat.id,
`📌 MENU COMPLETO

🛒 /produtos
➕ /addproduto nome|valor
🗑 /deletar ID

🏪 /lojas
🔗 /minhaloja nome

🛍 /carrinho
➕ /addcarrinho ID

⭐ /avaliar UID|nota
🏆 /rank
📡 /status
🚨 /listadv (admin)`);
});


// ================= LOJA =================
bot.onText(/\/minhaloja (.+)/, async (msg, match) => {

    await db.collection("users").doc(String(msg.from.id)).set({
        nomeLoja: match[1],
        uid: msg.from.id,
        rating: 5,
        votos: 1
    });

    bot.sendMessage(msg.chat.id, "🏪 Loja criada com sucesso");
});


// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

    const snap = await db.collection("produtos").get();

    let text = "🛒 PRODUTOS:\n\n";

    snap.forEach(doc => {
        const p = doc.data();

        text += `⚡ ${p.nome}
💰 R$ ${p.valor}
🆔 ${doc.id}
━━━━━━━━━━━\n`;
    });

    bot.sendMessage(msg.chat.id, text);
});


// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id,
`Bot online ⚡

📡 STATUS: OPERACIONAL
👤 DEV: ${OWNER}`);
});


// ================= IA + ANTI-SPAM =================
bot.on("message", async (msg) => {

    if (!msg.text) return;

    const userId = msg.from.id;
    const text = msg.text.toLowerCase();

    if (text.startsWith("/")) return;

    if (banned[userId] && Date.now() < banned[userId]) {
        return bot.sendMessage(msg.chat.id, "⚠️ Conta suspensa temporariamente");
    }

    const now = Date.now();

    if (lastMsg[userId] && now - lastMsg[userId] < 2000) {
        const c = await addAdv(userId, msg.from.first_name, "Spam");
        if (c >= 15) return applyBan(userId, msg);
        return bot.sendMessage(msg.chat.id, "🚨 Spam detectado");
    }

    lastMsg[userId] = now;

    if (blockedWords.some(w => text.includes(w))) {
        const c = await addAdv(userId, msg.from.first_name, "Ofensa");
        if (c >= 15) return applyBan(userId, msg);
        return bot.sendMessage(msg.chat.id, "⚠️ Linguagem proibida");
    }
});


// ================= ADV =================
async function addAdv(userId, name, reason) {

    if (!adv[userId]) adv[userId] = { count: 0, name };

    adv[userId].count++;

    await db.collection("advertencias").doc(String(userId)).set({
        userId,
        name,
        reason,
        count: adv[userId].count
    });

    return adv[userId].count;
}


// ================= BAN =================
async function applyBan(userId, msg) {

    const until = Date.now() + 24 * 60 * 60 * 1000;

    banned[userId] = until;

    await db.collection("banned").doc(String(userId)).set({
        userId,
        name: msg.from.first_name,
        bannedUntil: until
    });

    return bot.sendMessage(msg.chat.id,
`⚠️ Aviso crítico ⚠️

Conta suspensa por 24h.`);
}


// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
    await bot.setWebHook(`${URL}/webhook`);
    console.log("🔥 INFINITY BOT V3.1 ONLINE COM IDENTIDADE COMPLETA");
});
