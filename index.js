const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();

// TOKEN DO BOT (coloque o seu aqui)
const bot = new TelegramBot("8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE", { polling: true });

// LOGO (sua imagem do GitHub)
const logo = "https://raw.githubusercontent.com/infinity-vendas/telegram-vendas-bot/main/Screenshot_20260416-141951-1.png";

// START COM LOGO
bot.onText(/\/start/, (msg) => {
    bot.sendPhoto(msg.chat.id, logo, {
        caption:
`🛒 *INFINITY VENDAS*

🔥 Bem-vindo ao sistema de vendas
📦 Produtos disponíveis
💰 Pagamentos via PIX

👉 Use /menu para começar`
    });
});

// MENU SIMPLES
bot.onText(/\/menu/, (msg) => {
    bot.sendMessage(msg.chat.id,
`📦 MENU PRINCIPAL

🛍 Produtos
💰 Comprar
📞 Suporte

Digite o comando desejado.`);
});

// WEB SERVER (OBRIGATÓRIO pro Render)
app.get("/", (req, res) => {
    res.send("Bot online 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
});

console.log("Bot iniciado...");
