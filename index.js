const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 👑 ADMIN ÚNICO
const ADMINS = ["6863505946"];

// 🔥 FIREBASE
const serviceAccount = require("./firebase.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

const WEBHOOK_PATH = "/webhook";

app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});


// 📦 SISTEMAS
const users = {};
const pendingRegister = {};
const pending2FA = {};
const pendingPayments = {};


// 🤖 START (SEU LAYOUT ORIGINAL)
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
`⚡Dono: Infinity Vendas e divulgações Ultra
⚡Validity: 01.05.2026
Type: Free / VIP
⚡Developed by: Faelzin
Brasileiro programação

📱 Redes sociais

⚡Instagram @Infinity_cliente_oficial
⚡Youtube : em breve
⚡Facebook: em breve
⚡WhatsApp suporte: 51981528372
⚡Kwai: em breve

📌 Comandos:
/produtos
/publicar
/deletar
/status`);
});


// 👤 CADASTRO OBRIGATÓRIO
bot.on("message", (msg) => {

    const userId = msg.from.id;
    const text = msg.text;

    // cadastro
    if (pendingRegister[userId]) {

        const parts = text.split(" ");

        if (parts.length < 5) {
            return bot.sendMessage(msg.chat.id,
`⚠️ Complete o seu cadastro:

* Nome
* Sobrenome
* Idade
* WhatsApp
* Instagram (@)`);
        }

        users[userId] = {
            nome: parts[0],
            sobrenome: parts[1],
            idade: parts[2],
            whatsapp: parts[3],
            instagram: parts[4],
            uid: userId
        };

        delete pendingRegister[userId];

        return bot.sendMessage(msg.chat.id,
`✅ Cadastro concluído!`);
    }

    // 2FA verificação
    if (pending2FA[userId]) {

        const session = pending2FA[userId];

        if (text == session.code) {

            const productId = session.productId;

            delete pending2FA[userId];

            pendingPayments[userId] = {
                productId
            };

            return bot.sendMessage(msg.chat.id,
`✅ VERIFICAÇÃO OK

💳 PIX LIBERADO

👤 Nome: RAPHAEL DE MATOS
📱 Chave: 51981528372

📤 Envie o comprovante para aprovação.`);
        }

        return bot.sendMessage(msg.chat.id, "❌ Código inválido.");
    }
});


// 📦 PUBLICAR (ADMIN)
bot.onText(/\/publicar/, (msg) => {

    if (!ADMINS.includes(String(msg.from.id))) {
        return bot.sendMessage(msg.chat.id, "⛔ Sem permissão.");
    }

    bot.sendMessage(msg.chat.id,
`Envie:

-produto:
-valor:
-descricao:
-whatsapp:`);

    const listener = async (ctx) => {

        if (ctx.chat.id !== msg.chat.id) return;
        if (!ctx.text.includes("-produto")) return;

        const get = (key) => {
            const m = ctx.text.match(new RegExp(`-${key}: (.*)`));
            return m ? m[1] : "";
        };

        const doc = await db.collection("produtos").add({
            produto: get("produto"),
            valor: get("valor"),
            descricao: get("descricao"),
            whatsapp: get("whatsapp"),
            createdAt: Date.now()
        });

        bot.sendMessage(ctx.chat.id, `✔ Produto criado ID: ${doc.id}`);

        bot.removeListener("message", listener);
    };

    bot.on("message", listener);
});


// 📦 PRODUTOS
bot.onText(/\/produtos/, async (msg) => {

    const snapshot = await db.collection("produtos").get();

    if (snapshot.empty) {
        return bot.sendMessage(msg.chat.id, "Nenhum produto.");
    }

    snapshot.forEach(doc => {

        const p = doc.data();

        bot.sendMessage(msg.chat.id,
`🆔 ${doc.id}

📌 ${p.produto}
💰 ${p.valor}
📄 ${p.descricao}`,
{
    reply_markup: {
        inline_keyboard: [
            [
                {
                    text: "💳 Comprar",
                    callback_data: `pix_${doc.id}`
                }
            ]
        ]
    }
});
    });
});


// 💳 COMPRA + 2FA + CADASTRO
bot.on("callback_query", async (callback) => {

    const data = callback.data;
    const userId = callback.from.id;

    if (data.startsWith("pix_")) {

        if (!users[userId]) {

            pendingRegister[userId] = true;

            return bot.sendMessage(callback.message.chat.id,
`⚠️ Complete o seu cadastro:

* Nome
* Sobrenome
* Idade
* WhatsApp
* Instagram (@)`);
        }

        const code = Math.floor(10000 + Math.random() * 90000);

        pending2FA[userId] = {
            code,
            productId: data.split("_")[1]
        };

        bot.sendMessage(callback.message.chat.id,
`🔐 VERIFICAÇÃO

Digite o código:
👉 ${code}`);
    }


    // ❌ RECUSA / APROVAÇÃO ADMIN (PIX FUTURO)
});


// 🗑 DELETE
bot.onText(/\/deletar (.+)/, async (msg, match) => {

    if (!ADMINS.includes(String(msg.from.id))) return;

    const id = match[1];

    const doc = await db.collection("produtos").doc(id).get();

    if (!doc.exists) return bot.sendMessage(msg.chat.id, "Não existe");

    bot.sendMessage(msg.chat.id,
`Excluir produto?`,
{
    reply_markup: {
        inline_keyboard: [
            [{
                text: "🗑 Deletar",
                callback_data: `delete_${id}`
            }]
        ]
    }
});
});


// ✔ DELETE CALLBACK
bot.on("callback_query", async (callback) => {

    if (callback.data.startsWith("delete_")) {

        const id = callback.data.split("_")[1];

        await db.collection("produtos").doc(id).delete();

        bot.editMessageText("🗑 Produto deletado", {
            chat_id: callback.message.chat.id,
            message_id: callback.message.message_id
        });
    }
});


// ⚡ STATUS
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bot online ⚡");
});


// 🚀 SERVER
app.listen(process.env.PORT || 3000, async () => {
    console.log("Rodando");

    await bot.setWebHook(`${URL}${WEBHOOK_PATH}`);
});
