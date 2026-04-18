const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

// 🔐 TOKEN DO BOT
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// 🌐 URL DO RENDER
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 🖼️ LOGO (GitHub RAW)
const LOGO = "https://raw.githubusercontent.com/infinity-vendas/telegram-vendas-bot/main/Screenshot_20260416-141951-1.png";

const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

// 🔒 webhook endpoint seguro
const WEBHOOK_PATH = "/webhook";

// 📩 recebe updates do Telegram
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🤖 comando /start com imagem
bot.onText(/\/start/, (msg) => {
    console.log("START recebido de:", msg.chat.id);

    bot.sendPhoto(msg.chat.id, LOGO, {
        caption: `🛒 INFINITY VENDAS

🤖 Bot online
💰 Produtos disponíveis
🚀 Bem-vindo ao sistema!`
    });
});

// 📡 log de teste (ver se chega mensagem)
bot.on("message", (msg) => {
    console.log("Mensagem recebida:", msg.text);
});

// 🌐 rota health check Render
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});

// 🚀 inicia servidor + configura webhook corretamente
const startBot = async () => {
    try {
        await bot.deleteWebHook();
        console.log("Webhook antigo removido");

        await bot.setWebHook(`${URL}${WEBHOOK_PATH}`);
        console.log("Webhook ATIVO em:", `${URL}${WEBHOOK_PATH}`);
    } catch (err) {
        console.log("Erro webhook:", err.message);
    }
};

app.listen(process.env.PORT || 3000, () => {
    console.log("Servidor rodando");

    startBot();
});
