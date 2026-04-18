const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

// 🔐 TOKEN DO BOT
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// 🌐 URL DO SEU RENDER
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 🖼️ LOGO (RAW do GitHub)
const LOGO = "https://raw.githubusercontent.com/infinity-vendas/telegram-vendas-bot/main/Screenshot_20260416-141951-1.png";

const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

// 🔒 webhook seguro (não expõe token na URL)
const WEBHOOK_PATH = "/webhook";

// 📩 recebe updates do Telegram
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🤖 comando /start com imagem + texto
bot.onText(/\/start/, (msg) => {
    bot.sendPhoto(msg.chat.id, LOGO, {
        caption: `🛒 INFINITY VENDAS

🤖 Bot online
💰 Produtos disponíveis
🚀 Bem-vindo ao sistema!`
    });
});

// 🌐 rota principal (Render health check)
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});

// 🚀 inicia servidor + ativa webhook
app.listen(process.env.PORT || 3000, async () => {
    console.log("Servidor rodando");

    try {
        await bot.setWebHook(`${URL}${WEBHOOK_PATH}`);
        console.log("Webhook ativado com sucesso");
    } catch (err) {
        console.log("Erro webhook:", err.message);
    }
});
