const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

// 🔐 TOKEN DO BOT
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// 🌐 URL DO RENDER
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 🔥 FIREBASE
const serviceAccount = require("./firebase.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

const WEBHOOK_PATH = "/webhook";

// 📩 webhook
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});


// 🤖 START (SEU LAYOUT ORIGINAL MANTIDO)
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;

    let vendedorId = match && match[1] ? match[1] : msg.from.id;

    // salva cliente vinculado ao vendedor
    await db.collection("clientes").doc(String(chatId)).set({
        vendedorId: String(vendedorId)
    });

    bot.sendMessage(chatId,
`⚡Dono: Infinity Vendas e divulgações Ultra
⚡Validity: 01.05.2026
Type: Free / VIP
⚡Developed by: Faelzin
Brasileiro programação

📱 Redes sociais

⚡Instagram @Infinity_cliente_oficial
⚡Youtube : em breve
⚡TikTok: em breve
⚡whatsapp 5198152-8372 - suporte
⚡Kwai: em breve

📌 Comandos:
/produtos
/publicar
/status
/plano
/botinfo
/meulink`);
});


// 📦 PUBLICAR PRODUTO
bot.onText(/\/publicar/, (msg) => {
    const userId = msg.from.id;

    bot.sendMessage(msg.chat.id,
`📦 Envie:

nome|descricao|valor|whatsapp|pix`);

    const listener = async (ctx) => {
        if (!ctx.text || !ctx.text.includes("|")) return;

        const [nome, descricao, valor, whatsapp, pix] = ctx.text.split("|");

        await db.collection("produtos").add({
            userId: String(userId),
            nome,
            descricao,
            valor,
            whatsapp,
            pix,
            createdAt: Date.now()
        });

        bot.sendMessage(ctx.chat.id, "produto publicado ✔️");

        bot.removeListener("message", listener);
    };

    bot.on("message", listener);
});


// 📦 PRODUTOS (por vendedor)
bot.onText(/\/produtos/, async (msg) => {
    const chatId = String(msg.chat.id);

    const cliente = await db.collection("clientes").doc(chatId).get();

    let vendedorId = chatId;

    if (cliente.exists) {
        vendedorId = cliente.data().vendedorId;
    }

    const snapshot = await db.collection("produtos")
        .where("userId", "==", vendedorId)
        .get();

    if (snapshot.empty) {
        return bot.sendMessage(msg.chat.id, "⚠️ Nenhum produto disponível.");
    }

    snapshot.forEach(doc => {
        const p = doc.data();

        bot.sendMessage(msg.chat.id,
`🛒 Nome: ${p.nome}
📄 ${p.descricao}
💰 ${p.valor}
📲 WhatsApp: ${p.whatsapp}

👉 Comprar: https://wa.me/${p.whatsapp}`);
    });
});


// ⚡ STATUS
bot.onText(/\/status/, (msg) => {
    const start = Date.now();

    bot.sendMessage(msg.chat.id, "⏳ verificando...").then(() => {
        const latency = Date.now() - start;
        bot.sendMessage(msg.chat.id, `⚡ Bot online\n📡 Latência: ${latency}ms`);
    });
});


// 📊 PLANO
bot.onText(/\/plano/, (msg) => {
    bot.sendMessage(msg.chat.id, "⚡ Plano atual: FREE / VIP em breve");
});


// ℹ️ BOT INFO
bot.onText(/\/botinfo/, (msg) => {
    bot.sendMessage(msg.chat.id,
`🤖 Infinity Bot
🔥 Firebase ativo
👥 Multi-vendedor
📌 Versão V4`);
});


// 🔗 MEU LINK (AUTOMÁTICO E BONITO)
bot.onText(/\/meulink/, (msg) => {
    const userId = msg.from.id;
    const nome = msg.from.first_name || "vendedor";

    const nomeFormatado = nome
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(/[^a-z0-9]/g, "");

    const link = `https://t.me/SEU_BOT?start=${nomeFormatado}-${userId}`;

    bot.sendMessage(msg.chat.id,
`🔗 Seu link de vendas:

${link}

👤 Vendedor: ${nome}`);
});


// 🌐 HEALTH CHECK
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});


// 🚀 START WEBHOOK
app.listen(process.env.PORT || 3000, async () => {
    console.log("Servidor rodando");

    try {
        await bot.deleteWebHook();
        await bot.setWebHook(`${URL}${WEBHOOK_PATH}`);
        console.log("Webhook ativo com sucesso");
    } catch (err) {
        console.log("Erro webhook:", err.message);
    }
});
