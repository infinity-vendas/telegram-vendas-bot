const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();

// TOKEN DO BOT
const bot = new TelegramBot("8605240230:AAHAR9SeSNXqJAFr62EP_BbzsOIMikNsNek", { polling: true });

// COMANDO TESTE
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🤖 Bot online com Web Service!");
});

// ROTA OBRIGATÓRIA PARA RENDER
app.get("/", (req, res) => {
    res.send("Bot rodando 24h 🚀");
});

// PORTA DO RENDER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
});
