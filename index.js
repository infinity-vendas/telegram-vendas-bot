require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// START
bot.onText(/\/start(?: (.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const afiliado = match?.[1];

    if (afiliado) {
        bot.sendMessage(chatId,
            `🔥 Bem-vindo ao sistema de vendas!\n\n👤 Seu afiliado: ${afiliado}\n\n🛒 Use /produtos para ver ofertas`
        );
    } else {
        bot.sendMessage(chatId,
            `🔥 Bem-vindo!\n\n🛒 Use /produtos para ver ofertas disponíveis`
        );
    }
});

// PRODUTOS
bot.onText(/\/produtos/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🛒 PRODUTOS DISPONÍVEIS:\n\n1️⃣ Curso Marketing - R$10\n2️⃣ Bot Telegram Pro - R$25\n3️⃣ Sistema Afiliados - R$50\n\n👉 Para comprar digite:\ncomprar 1\ncomprar 2\ncomprar 3`
    );
});

// COMPRA SIMULADA
bot.onText(/comprar (.+)/, (msg, match) => {
    const produto = match[1];

    bot.sendMessage(msg.chat.id,
        `💰 Pedido recebido!\n\n📦 Produto: ${produto}\n\n⚠️ Próximo passo:\nIntegração PIX será ativada depois\n\n✅ Status: aguardando pagamento`
    );
});

console.log("🤖 Bot rodando com sucesso...");
