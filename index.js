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

// 📦 banco em memória (MVP - perde ao reiniciar)
let produtos = [];

// 📩 webhook receiver
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🤖 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
`⚡Dono: Infinity Vendas e divulgações Ultra
⚡Validity: 01.05.2026
Type: Free / VIP
⚡Developed by: Faelzin
Brasileiro programação

📱 Redes sociais:
⚡Instagram @Infinity_cliente_oficial
⚡Youtube: em breve
⚡TikTok: em breve
⚡WhatsApp: 5198152-8372 - suporte
⚡Kwai: em breve

📌 Comandos:
/produtos
/status
/plano
/publicar
/botinfo`);
});

// 📦 PUBLICAR PRODUTO (modo seguro)
bot.onText(/\/publicar/, (msg) => {
    bot.sendMessage(msg.chat.id,
`📦 Envie o produto assim:

nome|descricao|valor|whatsapp|pix`);

    const listener = (ctx) => {
        if (!ctx.text || !ctx.text.includes("|")) return;

        const [nome, descricao, valor, whatsapp, pix] = ctx.text.split("|");

        produtos.push({ nome, descricao, valor, whatsapp, pix });

        bot.sendMessage(ctx.chat.id, "produto publicado ✔️");

        bot.removeListener("message", listener);
    };

    bot.on("message", listener);
});

// 📦 LISTAR PRODUTOS
bot.onText(/\/produtos/, (msg) => {
    const chatId = msg.chat.id;

    if (produtos.length === 0) {
        return bot.sendMessage(chatId, "⚠️ Nenhum produto disponível.");
    }

    produtos.forEach((p) => {
        bot.sendMessage(chatId,
`🛒 Nome: ${p.nome}
📄 Descrição: ${p.descricao}
💰 Valor: ${p.valor}
📲 WhatsApp: ${p.whatsapp}
💳 PIX: ${p.pix}

👉 Adquirir: https://wa.me/${p.whatsapp}`);
    });
});

// ⚡ STATUS
bot.onText(/\/status/, (msg) => {
    const start = Date.now();

    bot.sendMessage(msg.chat.id, "⏳ verificando...").then(() => {
        const latency = Date.now() - start;
        bot.sendMessage(msg.chat.id, `⚡ Bot online\n📡 Latência: ${latency}ms`);
    });
});

// 📊 PLANO
bot.onText(/\/plano/, (msg) => {
    bot.sendMessage(msg.chat.id, "⚡ Plano atual: FREE\n🚀 VIP ainda não disponível");
});

// ℹ️ BOT INFO
bot.onText(/\/botinfo/, (msg) => {
    bot.sendMessage(msg.chat.id,
`🤖 Bot Infinity Vendas
📌 Versão: V1.1
📅 Atualização: 21.04.2026

⚡ Sistema em evolução`);
});

// 🌐 HEALTH CHECK (Render)
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});

// 🚀 START WEBHOOK
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
