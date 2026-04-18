const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

// 🔐 TOKEN DO BOT
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// 🌐 URL DO RENDER
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 🖼️ LOGO (CORRETO AGORA)
const LOGO = "https://raw.githubusercontent.com/infinity-vendas/telegram-vendas-bot/main/logo.png";

const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

const WEBHOOK_PATH = "/webhook";

// 📩 webhook receiver
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🤖 START
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendPhoto(chatId, LOGO, {
        caption: `🛒 INFINITY VENDAS

🤖 Bot online
💰 Produtos disponíveis
🚀 Bem-vindo!`
    }).catch((err) => {
        console.log("Erro imagem:", err.message);
        bot.sendMessage(chatId, "⚠️ Imagem não carregou.");
    });
});

// 🌐 health check
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});

// 🚀 start webhook
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
