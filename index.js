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
const productFiles = {};


// 🤖 START (LAYOUT ORIGINAL MANTIDO)
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
`⚡Dono: Infinity Vendas e divulgações Ultra
⚡Validity: 01.05.2026
Type: Free / VIP
⚡Developed by: Faelzin
Brasileiro programação

📱 Redes sociais

⚡Instagram @Infinity_cliente_oficial
⚡WhatsApp suporte: 51981528372

📌 Comandos:
/menu
/produtos
/status`);
});


// 🛒 PRODUTOS ATUALIZADOS COMPLETOS
bot.onText(/\/produtos/, (msg) => {

    bot.sendMessage(msg.chat.id,
`🔥 PRODUTOS DISPONÍVEIS

━━━━━━━━━━━━━━
📧 GMAIL / CONTAS GOOGLE
━━━━━━━━━━━━━━
📌 Conta Google — $1,65

━━━━━━━━━━━━━━
📘 FACEBOOK
━━━━━━━━━━━━━━
📌 Conta Facebook — $2,80

━━━━━━━━━━━━━━
🐦 TWITTER
━━━━━━━━━━━━━━
📌 Conta Twitter — $3,20

━━━━━━━━━━━━━━
👤 GUEST ACCOUNTS
━━━━━━━━━━━━━━
📌 Guest NVL 0 — $0,97
📌 Guest NVL 5 — $1,20
📌 Guest NVL 12 — $2,60
📌 Guest NVL 15 — $3,85

━━━━━━━━━━━━━━
🆔 LIKES END ID
⚠️ Entrega em até 24h
━━━━━━━━━━━━━━
🆔 100 — $15,00
🆔 200 — $25,00
🆔 300 — $35,00
🆔 400 — $45,00
🆔 500 — $55,00
🆔 1K — $65,00
🆔 2K — $75,00
🆔 5K — $90,00

━━━━━━━━━━━━━━
🤖 ALUGAR BOT TELEGRAM
━━━━━━━━━━━━━━
💸 1 Day — $15,00
💸 7 Days — $30,00
💸 14 Days — $60,00
💸 21 Days — $90,00
💸 31 Days — $120,00
💸 1 Ano — $150,00

━━━━━━━━━━━━━━
💰 PLANO BÁSICO
━━━━━━━━━━━━━━
📌 $1,99

━━━━━━━━━━━━━━
🤖 ALUGAR BOT DISCORD
━━━━━━━━━━━━━━
💸 30 Days — $100,00
💸 60 Days — $150,00
💸 90 Days — $300,00

━━━━━━━━━━━━━━
📱 ALUGAR BOT WHATSAPP
━━━━━━━━━━━━━━
💸 7 Days — $100,00
💸 14 Days — $150,00
💸 21 Days — $300,00
💸 31 Days — $500,00

⚡ Todos os produtos são entregues após aprovação do admin.`);
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

        return bot.sendMessage(msg.chat.id, "✅ Cadastro concluído");
    }

    // 📦 UPLOAD ADMIN
    if (msg.document || msg.video || msg.photo) {

        if (ADMINS.includes(String(userId))) {

            const fileId =
                msg.document?.file_id ||
                msg.video?.file_id ||
                msg.photo?.slice(-1)[0]?.file_id;

            const fileName = msg.document?.file_name || "produto";

            productFiles[fileName] = fileId;

            return bot.sendMessage(msg.chat.id,
`📦 PRODUTO SALVO

Nome: ${fileName}`);
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
`✅ VERIFICAÇÃO OK

Envie comprovante`);
        }
    }
});


// 📤 ADMIN COMPRA
bot.on("message", (msg) => {

    const userId = msg.from.id;

    if (msg.photo && pendingPayments[userId]) {

        ADMINS.forEach(adminId => {

            bot.sendMessage(adminId,
`💳 NOVA COMPRA

👤 UID: ${userId}
📦 Produto: ${pendingPayments[userId].productId}`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "✅ Entregar", callback_data: `deliver_${userId}` },
                            { text: "❌ Reprovar", callback_data: `reject_${userId}` }
                        ]
                    ]
                }
            });
        });
    }
});


// 🚀 ENTREGA AUTOMÁTICA
bot.on("callback_query", (callback) => {

    const data = callback.data;

    if (data.startsWith("deliver_")) {

        const userId = data.split("_")[1];

        const fileId = Object.values(productFiles)[0];

        if (fileId) {
            bot.sendDocument(userId, fileId, {
                caption: "🎉 Produto entregue com sucesso!"
            });
        }
    }

    if (data.startsWith("reject_")) {

        const userId = data.split("_")[1];

        bot.sendMessage(userId, "❌ Pedido reprovado");
    }
});


// 📌 MENU (MANTIDO SIMPLES)
bot.onText(/\/menu/, (msg) => {

    bot.sendMessage(msg.chat.id,
`📌 MENU

🛒 /produtos
👤 /cadastro
📡 /status
🚨 /denunciar
👥 /clientes`);
});


// 🚨 DENÚNCIA
bot.onText(/\/denunciar (.+)/, (msg, match) => {

    ADMINS.forEach(a => {
        bot.sendMessage(a,
`🚨 DENÚNCIA

👤 ${msg.from.id}
📌 ${match[1]}`);
    });

    bot.sendMessage(msg.chat.id, "✅ enviado");
});


// 📡 STATUS
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bot online ⚡");
});


// 👥 CLIENTES
bot.onText(/\/clientes/, (msg) => {

    if (!ADMINS.includes(String(msg.from.id))) return;

    bot.sendMessage(msg.chat.id,
`👥 CLIENTES: ${Object.keys(users).length}`);
});


// 🚀 SERVER
app.listen(process.env.PORT || 3000, async () => {
    console.log("Rodando");
    await bot.setWebHook(`${URL}/webhook`);
});
