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


// ================= START (SEU LAYOUT ANTIGO MANTIDO) =================
bot.onText(/\/start (.+)?/, async (msg, match) => {

    const vendedorId = match[1];

    if (vendedorId) {
        sessions[msg.from.id] = vendedorId;

        return bot.sendMessage(msg.chat.id,
`🛒 LOJA ATIVADA

Vendedor UID: ${vendedorId}

Use /produtos para ver itens`);
    }

    bot.sendMessage(msg.chat.id,
`⚡Dono: Infinity Vendas e divulgações Ultra
⚡Validity: 01.05.2026
Type: Free / VIP
⚡Developed by: Faelzin

📱 Redes sociais:
⚡Instagram @Infinity_cliente_oficial
⚡WhatsApp suporte: 51981528372

📌 Comandos:
/menu
/produtos
/lojas
/rank
/status`);
});


// ================= MENU =================
bot.onText(/\/menu/, (msg) => {
    bot.sendMessage(msg.chat.id,
`📌 MENU COMPLETO

🛒 /produtos
🏪 /lojas
🔎 /ver UID
🛍 /carrinho
⭐ /avaliar UID|nota
🏆 /rank
➕ /addproduto nome|valor
🗑 /deletar ID
🔗 /minhaloja nome
📡 /status`);
});


// ================= LOJAS (MANUAL + LINK) =================
bot.onText(/\/lojas/, async (msg) => {

    const snap = await db.collection("users").get();

    let text = "🏪 LOJAS DISPONÍVEIS:\n\n";

    snap.forEach(doc => {
        const u = doc.data();

        text += `🏪 ${u.nomeLoja || "Sem nome"}\nUID: ${doc.id}\n⭐ ${u.rating?.toFixed(1) || 5}\n\n`;
    });

    bot.sendMessage(msg.chat.id, text);
});


// ================= SELEÇÃO MANUAL =================
bot.onText(/\/ver (.+)/, (msg, match) => {

    sessions[msg.from.id] = match[1];

    bot.sendMessage(msg.chat.id,
`🛒 Loja ativada:

UID: ${match[1]}

Use /produtos`);
});


// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

    const vendedor = sessions[msg.from.id];

    if (!vendedor) {
        return bot.sendMessage(msg.chat.id,
`❌ Nenhuma loja selecionada

Use /lojas ou /ver UID`);
    }

    const snap = await db.collection("produtos")
        .where("vendedor", "==", vendedor)
        .get();

    if (snap.empty) {
        return bot.sendMessage(msg.chat.id, "Sem produtos.");
    }

    let text = "🛒 PRODUTOS:\n\n";

    snap.forEach(doc => {
        const p = doc.data();
        text += `📦 ${p.nome} - R$${p.valor}\n`;
    });

    bot.sendMessage(msg.chat.id, text);
});


// ================= CRIAR LOJA =================
bot.onText(/\/minhaloja (.+)/, async (msg, match) => {

    await db.collection("users").doc(String(msg.from.id)).set({
        nomeLoja: match[1],
        uid: msg.from.id,
        rating: 5,
        votos: 1
    });

    bot.sendMessage(msg.chat.id,
`🏪 Loja criada:

Nome: ${match[1]}
UID: ${msg.from.id}`);
});


// ================= RANKING =================
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


// ================= AVALIAR =================
bot.onText(/\/avaliar (.+)/, async (msg, match) => {

    const [uid, nota] = match[1].split("|");

    const ref = db.collection("users").doc(uid);
    const doc = await ref.get();

    if (!doc.exists) return;

    const data = doc.data();

    const votos = (data.votos || 1) + 1;
    const rating = ((data.rating || 5) + Number(nota)) / votos;

    await ref.update({ rating, votos });

    bot.sendMessage(msg.chat.id, "⭐ Avaliação enviada");
});


// ================= PRODUTO =================
bot.onText(/\/addproduto (.+)/, async (msg, match) => {

    await db.collection("produtos").add({
        nome: match[1].split("|")[0],
        valor: match[1].split("|")[1],
        vendedor: String(msg.from.id)
    });

    bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
});


// ================= DELETAR =================
bot.onText(/\/deletar (.+)/, async (msg, match) => {

    const doc = await db.collection("produtos").doc(match[1]).get();

    if (!doc.exists) return;

    if (doc.data().vendedor !== String(msg.from.id)) return;

    await db.collection("produtos").doc(match[1]).delete();

    bot.sendMessage(msg.chat.id, "🗑 Removido");
});


// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bot online ⚡");
});


// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
    await bot.setWebHook(`${URL}/webhook`);
    console.log("Marketplace rodando");
});
