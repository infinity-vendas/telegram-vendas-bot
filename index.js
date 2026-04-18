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

const WEBHOOK_PATH = "/webhook";

app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});


// 📦 SISTEMA
const users = {};
const pendingRegister = {};
const pending2FA = {};
const pendingPayments = {};
const productFiles = {}; // 🔥 ARQUIVOS SALVOS

let botStatus = "ATIVO";
let ownerStatus = "ONLINE";


// 🤖 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
`⚡ INFINITY STORE

📌 Comandos:
/produtos
/menu
/status`);
});


// 🛒 PRODUTOS FIXOS
const likesPackages = [
    { name: "🆔 100 curtidas", price: 10 },
    { name: "🆔 200 curtidas", price: 20 },
    { name: "🆔 300 curtidas", price: 30 }
];


// 📦 PRODUTOS
bot.onText(/\/produtos/, (msg) => {

    let text = `🔥 LOJA:\n`;

    likesPackages.forEach(p => {
        text += `${p.name} — R$ ${p.price}\n`;
    });

    bot.sendMessage(msg.chat.id, text);
});


// 👤 CADASTRO
bot.on("message", (msg) => {

    const userId = msg.from.id;
    const text = msg.text;

    if (pendingRegister[userId]) {

        const parts = text.split(" ");

        users[userId] = {
            nome: parts[0],
            uid: userId
        };

        delete pendingRegister[userId];

        return bot.sendMessage(msg.chat.id, "✅ Cadastro ok");
    }

    // 🔥 CAPTURA DE ARQUIVOS DO ADMIN (UPLOAD REAL)
    if (msg.document || msg.video || msg.photo) {

        if (ADMINS.includes(String(userId))) {

            const fileId =
                msg.document?.file_id ||
                msg.video?.file_id ||
                msg.photo?.slice(-1)[0]?.file_id;

            const fileName = msg.document?.file_name || "arquivo";

            productFiles[fileName] = fileId;

            return bot.sendMessage(msg.chat.id,
`📦 ARQUIVO SALVO COMO PRODUTO

Nome: ${fileName}
ID: ${fileId}`);
        }
    }

    // 2FA
    if (pending2FA[userId]) {

        const session = pending2FA[userId];

        if (text == session.code) {

            pendingPayments[userId] = {
                productId: session.productId
            };

            delete pending2FA[userId];

            return bot.sendMessage(msg.chat.id,
`✅ OK

💳 Envie comprovante`);
        }
    }
});


// 💳 COMPRA
bot.on("callback_query", (callback) => {

    const userId = callback.from.id;

    if (!users[userId]) {
        pendingRegister[userId] = true;
        return bot.sendMessage(callback.message.chat.id, "⚠️ cadastre-se");
    }

    const code = Math.floor(10000 + Math.random() * 90000);

    pending2FA[userId] = {
        code,
        productId: "Produto digital"
    };

    bot.sendMessage(callback.message.chat.id,
`🔐 Código:
${code}`);
});


// 📤 ADMIN COMPROVANTE
bot.on("message", (msg) => {

    const userId = msg.from.id;

    if (msg.photo && pendingPayments[userId]) {

        ADMINS.forEach(adminId => {

            bot.sendMessage(adminId,
`💳 COMPRA

👤 UID: ${userId}
📦 Produto: ${pendingPayments[userId].productId}`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "✅ Entregar arquivo", callback_data: `deliver_${userId}` },
                            { text: "❌ Reprovar", callback_data: `reject_${userId}` }
                        ]
                    ]
                }
            });
        });
    }
});


// 🚀 ENTREGA AUTOMÁTICA DE ARQUIVO
bot.on("callback_query", (callback) => {

    const data = callback.data;

    if (data.startsWith("deliver_")) {

        const userId = data.split("_")[1];

        const fileKey = Object.keys(productFiles)[0];
        const fileId = productFiles[fileKey];

        if (fileId) {

            bot.sendDocument(userId, fileId, {
                caption: "🎉 Produto entregue automaticamente!"
            });
        }
    }

    if (data.startsWith("reject_")) {

        const userId = data.split("_")[1];

        bot.sendMessage(userId, "❌ Reprovado");
    }
});


// 📡 STATUS
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bot online ⚡");
});


// 🚀 SERVER
app.listen(process.env.PORT || 3000, async () => {
    console.log("Rodando");
    await bot.setWebHook(`${URL}${WEBHOOK_PATH}`);
});
