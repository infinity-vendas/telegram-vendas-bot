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
const verified = {}; // apenas controle opcional


// ================= INSTAGRAM =================
const instaLink = "https://www.instagram.com/infinity_cliente_oficial?igsh=dDJxMHpoM3hvMmNq";


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


// ================= START (LAYOUT ORIGINAL MANTIDO) =================
bot.onText(/\/start$/, (msg) => {

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
/status

⚠️ Verificação opcional:
/verificar`);
});


// ================= VERIFICAÇÃO (NÃO BLOQUEIA NADA) =================
bot.onText(/\/verificar/, (msg) => {

    bot.sendMessage(msg.chat.id,
`📲 Verificação (OPCIONAL)

1️⃣ Siga o Instagram:
${instaLink}

2️⃣ Aguarde 15 segundos

3️⃣ Digite:
/liberar

⚠️ Isso NÃO bloqueia o uso do bot.`);
});


// ================= LIBERAR (SÓ MARCA USUÁRIO) =================
bot.onText(/\/liberar/, (msg) => {

    const userId = msg.from.id;

    if (verified[userId]) {
        return bot.sendMessage(msg.chat.id, "✅ Já marcado como verificado.");
    }

    bot.sendMessage(msg.chat.id, "⏳ Processando verificação...");

    setTimeout(() => {

        verified[userId] = true;

        bot.sendMessage(msg.chat.id,
`✅ Verificação registrada!

Isso não altera seu acesso ao sistema.`);
    }, 15000);
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
📡 /status`);
});


// ================= CRIAR LOJA =================
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


// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bot online ⚡");
});


// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
    await bot.setWebHook(`${URL}/webhook`);
    console.log("🔥 INFINITY BOT (VERIFICAÇÃO OPCIONAL) ONLINE");
});
