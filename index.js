const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

// 🔐 TOKEN DO BOT
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// 🌐 URL DO RENDER
const URL = "https://telegram-vendas-bot-1.onrender.com";

const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

const WEBHOOK_PATH = "/webhook";

// 📩 webhook receiver
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🤖 /start (VERSÃO 100% ESTÁVEL)
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    console.log("START recebido:", chatId);

    bot.sendMessage(chatId, "🛒 INFINITY VENDAS\n🤖 Bot online");

    // 📦 ENVIA COMO DOCUMENTO (SEM ERRO 400)
    bot.sendDocument(
        chatId,
        "https://raw.githubusercontent.com/infinity-vendas/telegram-vendas-bot/main/logo.png",
        {
            caption: `🚀 Bem-vindo ao sistema!

💰 Produtos disponíveis
📦 Pedidos rápidos
👥 Suporte ativo`
        }
    ).catch((err) => {
        console.log("Erro imagem:", err.message);
        bot.sendMessage(chatId, "⚠️ Imagem não carregou no momento.");
    });
});

// 📡 log de mensagens
bot.on("message", (msg) => {
    console.log("Mensagem:", msg.text);
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
