const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot("8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE", {
    polling: {
        interval: 1000,
        autoStart: true
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bot online 🚀");
});
