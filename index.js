const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const app = express();

// TOKEN
const bot = new TelegramBot("8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE", { polling: true });

// START simples e seguro
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🤖 Bot online funcionando!");
});

// servidor obrigatório pro Render
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor ativo na porta " + PORT);
    console.log("Bot iniciado");
});
