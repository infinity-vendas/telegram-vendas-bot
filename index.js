const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

// 🔐 SEU TOKEN
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";

// 🌐 SEU LINK DO RENDER (já inserido)
const URL = "https://telegram-vendas-bot-1.onrender.com";

const bot = new TelegramBot(TOKEN);
const app = express();

app.use(bodyParser.json());

// 📩 recebe updates do Telegram
app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🤖 comando /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🤖 Bot online via WEBHOOK!");
});

// 🚀 inicia servidor e ativa webhook
app.listen(process.env.PORT || 3000, async () => {
    console.log("Servidor rodando");

    try {
        await bot.setWebHook(`${URL}/bot${TOKEN}`);
        console.log("Webhook ativado com sucesso");
    } catch (err) {
        console.log("Erro webhook:", err.message);
    }
});
