const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const app = express();

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// ⚠️ importante: disable polling automático conflitante
const bot = new TelegramBot(TOKEN, { polling: false });

// inicia polling de forma controlada
bot.startPolling()
    .then(() => {
        console.log("Bot iniciado com polling");
    })
    .catch(err => {
        console.log("Erro polling:", err.message);
    });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🤖 Bot online funcionando!");
});

// health check obrigatório Render
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor ativo na porta", PORT);
});
