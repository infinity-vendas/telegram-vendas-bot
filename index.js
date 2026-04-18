const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 👑 SOMENTE VOCÊ
const ADMINS = [
    "6863505946"
];

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

app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});


// 🤖 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
`⚡ Infinity Vendas Ultra Private

📌 Comandos:
/produtos
/publicar
/deletar
/status`);
});


// 📦 PUBLICAR (SOMENTE VOCÊ)
bot.onText(/\/publicar/, (msg) => {

    const userId = String(msg.from.id);

    if (!ADMINS.includes(userId)) {
        return bot.sendMessage(msg.chat.id, "⛔ Sem permissão.");
    }

    bot.sendMessage(msg.chat.id,
`📦 Envie:

-produto: nome
-valor: 10,00
-descricao: texto
-whatsapp: 5198xxxx`);

    const listener = async (ctx) => {
        if (ctx.chat.id !== msg.chat.id) return;
        if (!ctx.text || !ctx.text.includes("-produto")) return;

        const get = (key) => {
            const match = ctx.text.match(new RegExp(`-${key}: (.*)`));
            return match ? match[1].trim() : "";
        };

        const docRef = await db.collection("produtos").add({
            produto: get("produto"),
            valor: get("valor"),
            descricao: get("descricao"),
            whatsapp: get("whatsapp"),
            createdAt: Date.now()
        });

        bot.sendMessage(ctx.chat.id,
`produto publicado ✔️

🆔 ID: ${docRef.id}`);

        bot.removeListener("message", listener);
    };

    bot.on("message", listener);
});


// 📦 PRODUTOS (CATÁLOGO LIMPO - 1 POR VEZ)
bot.onText(/\/produtos/, async (msg) => {

    const snapshot = await db.collection("produtos").get();

    if (snapshot.empty) {
        return bot.sendMessage(msg.chat.id, "⚠️ Nenhum produto disponível.");
    }

    snapshot.forEach(doc => {
        const p = doc.data();

        const buyLink = `https://wa.me/${p.whatsapp}?text=Olá%20quero%20comprar:%20${encodeURIComponent(p.produto)}`;

        bot.sendMessage(msg.chat.id,
`🛒 Produto:

📌 ${p.produto}
💰 ${p.valor}
📄 ${p.descricao}

👉 Comprar:
${buyLink}`);
    });
});


// 🗑️ DELETE COM BOTÃO (SOMENTE VOCÊ)
bot.onText(/\/deletar (.+)/, async (msg, match) => {

    const userId = String(msg.from.id);

    if (!ADMINS.includes(userId)) {
        return bot.sendMessage(msg.chat.id, "⛔ Sem permissão.");
    }

    const productId = match[1];

    const doc = await db.collection("produtos").doc(productId).get();

    if (!doc.exists) {
        return bot.sendMessage(msg.chat.id, "❌ Produto não encontrado.");
    }

    const data = doc.data();

    bot.sendMessage(msg.chat.id,
`🗑 Produto encontrado:

📌 ${data.produto}
💰 ${data.valor}

Confirmar exclusão?`,
{
    reply_markup: {
        inline_keyboard: [
            [
                {
                    text: "🗑 Já li e deletar produto",
                    callback_data: `delete_${productId}`
                }
            ]
        ]
    }
});
});


// ✔ CALLBACK DELETE
bot.on("callback_query", async (callback) => {

    const userId = String(callback.from.id);

    if (!ADMINS.includes(userId)) {
        return bot.answerCallbackQuery(callback.id, {
            text: "⛔ Sem permissão"
        });
    }

    if (callback.data.startsWith("delete_")) {

        const productId = callback.data.split("_")[1];

        await db.collection("produtos").doc(productId).delete();

        bot.editMessageText(
`🗑 Produto deletado com sucesso.`,
{
    chat_id: callback.message.chat.id,
    message_id: callback.message.message_id
});
    }
});


// ⚡ STATUS
bot.onText(/\/status/, (msg) => {
    const start = Date.now();

    bot.sendMessage(msg.chat.id, "⏳ verificando...").then(() => {
        const latency = Date.now() - start;
        bot.sendMessage(msg.chat.id, `⚡ Online\n📡 ${latency}ms`);
    });
});


// 🌐 SERVER
app.get("/", (req, res) => {
    res.send("Bot PRIVATE ULTRA rodando 🚀");
});


// 🚀 START
app.listen(process.env.PORT || 3000, async () => {
    console.log("Servidor rodando");

    try {
        await bot.deleteWebHook();
        await bot.setWebHook(`${URL}${WEBHOOK_PATH}`);
        console.log("Webhook ativo");
    } catch (err) {
        console.log(err.message);
    }
});
