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


// ================= SEU ÁUDIO =================
const audioURL = "https://files.catbox.moe/p6wlxb.mp3";


// ================= PALAVRÕES =================
const blockedWords = [
    "foda", "merda", "puta", "bosta", "scam", "fraude", "hack", "roubo"
];


// ================= IA =================
function infinityAI(text) {

    text = text.toLowerCase();

    if (text.includes("oi") || text.includes("olá")) {
        return "👋 Olá! Bem-vindo à Infinity Vendas. Digite /menu para começar.";
    }

    if (text.includes("produto")) {
        return "🛒 Use /produtos para ver os itens disponíveis.";
    }

    if (text.includes("loja")) {
        return "🏪 Use /lojas para ver vendedores.";
    }

    return "🤖 Não entendi, use /menu.";
}


// ================= START (LAYOUT ORIGINAL + ÁUDIO) =================
bot.onText(/\/start$/, async (msg) => {

    await bot.sendMessage(msg.chat.id,
`®INFINITY VENDAS AUTOMÁTICAS ON-LINE

todos os direitos humanos e segurança preservados. N° Lei

⚡Render projeto e hospedagem , Infinity Vendas e divulgações (Patrocinado) ⚡

🔓 desbloqueie todo o acesso limitado , escute com atenção é muito importante...`);

    await bot.sendAudio(msg.chat.id, audioURL);

    setTimeout(() => {
        bot.sendMessage(msg.chat.id,
`⚡Dono: Infinity Vendas e divulgações Ultra
⚡Validity: 01.05.2026
Type: Free / VIP
⚡Developed by: Faelzin

📱 Redes sociais:
⚡Instagram @Infinity_cliente_oficial
⚡WhatsApp suporte: 51981528372

📌 COMANDOS:
/menu
/produtos
/lojas
/rank
/status`);
    }, 60000);
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


// ================= ADD PRODUTO =================
bot.onText(/\/addproduto (.+)/, async (msg, match) => {

    const [nome, valor] = match[1].split("|");

    await db.collection("produtos").add({
        nome,
        valor,
        vendedor: String(msg.from.id)
    });

    bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
});


// ================= DELETAR =================
bot.onText(/\/deletar (.+)/, async (msg, match) => {

    const id = match[1];

    const doc = await db.collection("produtos").doc(id).get();

    if (!doc.exists) return;

    if (doc.data().vendedor !== String(msg.from.id)) return;

    await db.collection("produtos").doc(id).delete();

    bot.sendMessage(msg.chat.id, "🗑 Produto removido");
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


// ================= LOJAS =================
bot.onText(/\/lojas/, async (msg) => {

    const snap = await db.collection("users").get();

    let text = "🏪 LOJAS:\n\n";

    snap.forEach(doc => {
        const u = doc.data();

        text += `🏪 ${u.nomeLoja || "Sem nome"}
UID: ${doc.id}
⭐ ${u.rating?.toFixed(1) || 5}
━━━━━━━━━━━\n`;
    });

    bot.sendMessage(msg.chat.id, text);
});


// ================= RANK =================
bot.onText(/\/rank/, async (msg) => {

    const snap = await db.collection("users").get();

    let list = [];

    snap.forEach(doc => {
        list.push({
            nome: doc.data().nomeLoja,
            rating: doc.data().rating || 5
        });
    });

    list.sort((a, b) => b.rating - a.rating);

    let text = "🏆 RANKING:\n\n";

    list.forEach((v, i) => {
        text += `${i + 1}º ${v.nome} ⭐${v.rating.toFixed(1)}\n`;
    });

    bot.sendMessage(msg.chat.id, text);
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

    bot.sendMessage(msg.chat.id, infinityAI(text));
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


// ================= LIST ADV =================
bot.onText(/\/listadv/, async (msg) => {

    if (!ADMINS.includes(String(msg.from.id))) return;

    const snap = await db.collection("advertencias").get();

    let text = "🚨 USUÁRIOS COM ADVERTÊNCIA:\n\n";

    snap.forEach(doc => {

        const d = doc.data();

        text += `👤 ${d.name}
🆔 ${d.userId}
⚠️ ${d.count}
━━━━━━━━━━\n`;
    });

    bot.sendMessage(msg.chat.id, text);
});


// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bot online ⚡");
});


// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
    await bot.setWebHook(`${URL}/webhook`);
    console.log("🔥 INFINITY BOT FULL + AUDIO ONLINE");
});
