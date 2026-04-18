const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

// 🔐 TOKEN DO BOT
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// 🌐 URL DO RENDER
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 🖼️ LOGO (LINK SEGURO E FUNCIONAL)
const LOGO = "https://raw.githubusercontent.com/infinity-vendas/telegram-vendas-bot/main/Screenshot_20260416-141951-1.png";

const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

// 🔒 webhook
const WEBHOOK_PATH = "/webhook";

// 📩 recebe updates
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🤖 START com proteção contra erro de imagem
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, "🛒 INFINITY VENDAS\n🤖 Bot online");

    bot.sendPhoto(chatId, LOGO)
        .then(() => {
            console.log("Imagem enviada com sucesso");
        })
        .catch((err) => {
            console.log("Erro imagem:", err.message);
            bot.sendMessage(chatId, "⚠️ Não foi possível carregar a imagem no momento.");
        });
});

// 🌐 health check Render
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});

// 🚀 inicia servidor + webhook
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
