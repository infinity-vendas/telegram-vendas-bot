const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const app = express();

// 🔐 COLE SEU TOKEN ENTRE AS ASPAS
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// 🖼️ SUA IMAGEM (link RAW do GitHub)
const logo = "https://raw.githubusercontent.com/infinity-vendas/telegram-vendas-bot/main/Screenshot_20260416-141951-1.png";

// 🔥 remove webhook + inicia polling corretamente
const bot = new TelegramBot(TOKEN);

bot.deleteWebHook().then(() => {
    bot.startPolling();
});

// 📲 COMANDO /start COM LOGO
bot.onText(/\/start/, (msg) => {
    bot.sendPhoto(msg.chat.id, logo, {
        caption: `🛒 *INFINITY VENDAS*

🔥 Bem-vindo ao sistema
📦 Produtos disponíveis
💰 Pagamento via PIX

👉 Use /menu para acessar`
    });
});

// 📦 MENU
bot.onText(/\/menu/, (msg) => {
    bot.sendMessage(msg.chat.id,
`📦 MENU PRINCIPAL

🛍 Produtos
💰 Comprar
📞 Suporte`);
});

// 🌐 servidor obrigatório pro Render
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Servidor ativo");
});
