const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

// 🔐 TOKEN
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 👑 ADMINS
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

// 📩 webhook
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});


// 🆔 START (MANTIDO)
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;

    let vendedorId = match && match[1] ? match[1] : msg.from.id;

    await db.collection("clientes").doc(String(chatId)).set({
        vendedorId: String(vendedorId)
    });

    bot.sendMessage(chatId,
`⚡ Infinity Vendas Ultra

🆔 Comandos:
/produtos
/publicar
/deletar
/status
/plano
/botinfo
/meulink`);
});


// 🆔 PUBLICAR PRODUTO + LOG
bot.onText(/\/publicar/, (msg) => {

    const userId = msg.from.id;

    bot.sendMessage(msg.chat.id,
`🆔 Envie:

-vendedor: nome
-idade: 25
-produto: nome
-valor: 10,00
-descricao: texto
-instagram: @perfil
-youtube: link
-facebook: link
-cupom: CODE
-desconto: 10%
-whatsapp: 5198xxxx`);

    const listener = async (ctx) => {
        if (!ctx.text || !ctx.text.includes("-produto")) return;

        const get = (key) => {
            const match = ctx.text.match(new RegExp(`-${key}: (.*)`));
            return match ? match[1].trim() : "";
        };

        const docRef = await db.collection("produtos").add({
            vendedor: get("vendedor"),
            idade: get("idade"),
            produto: get("produto"),
            valor: get("valor"),
            descricao: get("descricao"),
            instagram: get("instagram"),
            youtube: get("youtube"),
            facebook: get("facebook"),
            cupom: get("cupom"),
            desconto: get("desconto"),
            whatsapp: get("whatsapp"),
            createdAt: Date.now()
        });

        // 📊 LOG
        await db.collection("logs").add({
            tipo: "CREATE",
            userId,
            produtoId: docRef.id,
            time: Date.now()
        });

        bot.sendMessage(ctx.chat.id,
`produto publicado ✔️

🆔 ID: ${docRef.id}`);

        bot.removeListener("message", listener);
    };

    bot.on("message", listener);
});


// 📢 LISTAR PRODUTOS
bot.onText(/\/produtos/, async (msg) => {
    const chatId = String(msg.chat.id);

    const cliente = await db.collection("clientes").doc(chatId).get();

    let vendedorId = chatId;

    if (cliente.exists) {
        vendedorId = cliente.data().vendedorId;
    }

    const snapshot = await db.collection("produtos")
        .where("vendedor", "==", vendedorId)
        .get();

    if (snapshot.empty) {
        return bot.sendMessage(msg.chat.id, "⚠️ Nenhum produto disponível.");
    }

    snapshot.forEach(doc => {
        const p = doc.data();

        bot.sendMessage(msg.chat.id,
`🆔 ID: ${doc.id}

🆔 Produto: ${p.produto}
🆔 Vendedor: ${p.vendedor}
🆔 Idade: ${p.idade}

📄 ${p.descricao}
💰 Valor: ${p.valor}
🏷 Cupom: ${p.cupom}
📉 Desconto: ${p.desconto}

📱 Instagram: ${p.instagram}
▶️ YouTube: ${p.youtube}
🔥 Facebook: ${p.facebook}

📢 WhatsApp: https://wa.me/${p.whatsapp}`);
    });
});


// 🗑️ DELETE COM CONFIRMAÇÃO
const pendingDelete = {};

bot.onText(/\/deletar (.+)/, async (msg, match) => {
    const userId = String(msg.from.id);
    const productId = match[1];

    const isAdmin = ADMINS.includes(userId);

    const doc = await db.collection("produtos").doc(productId).get();

    if (!doc.exists) {
        return bot.sendMessage(msg.chat.id, "❌ Produto não encontrado.");
    }

    const data = doc.data();

    if (!isAdmin && data.vendedor !== userId) {
        return bot.sendMessage(msg.chat.id, "⛔ Sem permissão.");
    }

    pendingDelete[userId] = productId;

    bot.sendMessage(msg.chat.id,
`⚠️ CONFIRMAR DELETE

Produto: ${data.produto}

Digite:
/confirmardelete`);
});


// ✔ CONFIRMAR DELETE
bot.onText(/\/confirmardelete/, async (msg) => {
    const userId = String(msg.from.id);
    const productId = pendingDelete[userId];

    if (!productId) {
        return bot.sendMessage(msg.chat.id, "❌ Nenhuma ação pendente.");
    }

    const doc = await db.collection("produtos").doc(productId).get();

    if (doc.exists) {
        await db.collection("produtos").doc(productId).delete();

        // 📊 LOG
        await db.collection("logs").add({
            tipo: "DELETE",
            userId,
            produtoId: productId,
            time: Date.now()
        });

        bot.sendMessage(msg.chat.id, "🗑 Produto deletado com sucesso.");
    }

    delete pendingDelete[userId];
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
    bot.sendMessage(msg.chat.id, "⚡ Plano atual: FREE");
});


// ℹ️ BOT INFO
bot.onText(/\/botinfo/, (msg) => {
    bot.sendMessage(msg.chat.id,
`🤖 Infinity Bot
🔥 Firebase ativo
🛡 Segurança V10
📌 Logs ativos`);
});


// 🔗 MEU LINK
bot.onText(/\/meulink/, (msg) => {
    const userId = msg.from.id;

    const link = `https://t.me/SEU_BOT?start=${userId}`;

    bot.sendMessage(msg.chat.id, `🔗 Seu link:\n\n${link}`);
});


// 🌐 HEALTH
app.get("/", (req, res) => {
    res.send("Bot rodando 🚀");
});


// 🚀 START
app.listen(process.env.PORT || 3000, async () => {
    console.log("Servidor rodando");

    try {
        await bot.deleteWebHook();
        await bot.setWebHook(`${URL}${WEBHOOK_PATH}`);
        console.log("Webhook ativo");
    } catch (err) {
        console.log(err.message);
    }
});
