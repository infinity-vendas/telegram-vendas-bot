const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const ADMINS = ["6863505946"];

const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();

app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ================= LAYOUT FIXO =================
const START_TEXT = `
Dono: INFINITY CLIENTE
Validity: 25,00
Created by: @Infity_cliente_oficial

Parcerias: nenhuma
vendedores (1) admin
divulgadores: nenhum
Facebook: indisponível
Instagram: disponível
YouTube: Em Breve
TikTok: indisponível
Kwai: indisponível
patrocinadores: nenhum

━━━━━━━━━━━━━━

Aceitamos pagamento Pix / cartão: em breve!
Transições 100% manual e seguras
¡compre somente comigo atualmente!

Unidos , fortes venceremos !
`;

// ================= MENU =================
const MENU = `
⚡ /produtos
⚡ /addproduto
⚡ /adminprodutos
⚡ /pedidos
⚡ /status
`;

// ================= PIX =================
const PIX_KEY = "51981528372";
const CPF_MASK = "060***31**";

const addStep = {};
const addData = {};

// ================= START =================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, START_TEXT);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, MENU);
  }, 2000);
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "⚡ Sem produtos");
  }

  snap.forEach((doc) => {

    const p = doc.data();

    if (p.estoque <= 0) return;

    const text = `
📦 ${p.nome}
💰 R$ ${p.valor}
📊 Estoque: ${p.estoque}
📱 Instagram: ${p.instagram || "N/A"}
🆔 ID: ${doc.id}
`;

    bot.sendMessage(msg.chat.id, text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🛒 Comprar",
              callback_data: `buy_${doc.id}`
            }
          ],
          [
            {
              text: "📲 WhatsApp",
              url: `https://wa.me/${p.whatsapp || "5551981528372"}`
            }
          ]
        ]
      }
    });
  });
});

// ================= COMPRA =================
bot.on("callback_query", async (query) => {

  const data = query.data;
  const chatId = query.message.chat.id;

  if (!data.startsWith("buy_")) return;

  const id = data.replace("buy_", "");

  const doc = await db.collection("produtos").doc(id).get();

  if (!doc.exists) return;

  const p = doc.data();

  const orderId = Date.now().toString();

  await db.collection("pedidos").doc(orderId).set({
    orderId,
    produtoId: id,
    produto: p.nome,
    valor: p.valor,
    status: "pendente",
    userId: chatId,
    username: query.from.username || "sem_user"
  });

  // NOTIFICA CLIENTE
  bot.sendMessage(chatId,
`⚡ Pedido enviado para análise

📦 ${p.nome}
💰 R$ ${p.valor}`);

  // NOTIFICA ADM
  ADMINS.forEach(adminId => {
    bot.sendMessage(adminId,
`🆕 NOVO PEDIDO

🆔 ${orderId}
📦 ${p.nome}
💰 R$ ${p.valor}
👤 @${query.from.username}

Aprovar pedido?`,
{
  reply_markup: {
    inline_keyboard: [
      [
        { text: "📦 Enviar", callback_data: `send_${orderId}` },
        { text: "❌ Rejeitar", callback_data: `reject_${orderId}` }
      ]
    ]
  }
});
  });
});

// ================= ADMIN ENVIAR =================
bot.on("callback_query", async (query) => {

  const data = query.data;

  // ENVIAR
  if (data.startsWith("send_")) {

    const id = data.replace("send_", "");

    const doc = await db.collection("pedidos").doc(id).get();
    const order = doc.data();

    await bot.sendMessage(order.userId,
`🎉 Produto liberado

📦 ${order.produto}

Envie comprovante no WhatsApp para finalização.`);

    await db.collection("pedidos").doc(id).update({
      status: "enviado"
    });

    bot.sendMessage(query.message.chat.id, "✔ Enviado");
  }

  // REJEITAR
  if (data.startsWith("reject_")) {

    const id = data.replace("reject_", "");

    const doc = await db.collection("pedidos").doc(id).get();
    const order = doc.data();

    await bot.sendMessage(order.userId,
`❌ Pedido recusado`);

    await db.collection("pedidos").doc(id).update({
      status: "rejeitado"
    });

    bot.sendMessage(query.message.chat.id, "❌ Rejeitado");
  }
});

// ================= ADMIN PRODUTOS =================
bot.onText(/\/adminprodutos/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const snap = await db.collection("produtos").get();

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id,
`🆔 ${doc.id}
📦 ${p.nome}
💰 ${p.valor}
📊 Estoque: ${p.estoque}`);
  });
});

// ================= ADD PRODUTO =================
bot.onText(/\/addproduto/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  addStep[msg.from.id] = "nome";
  addData[msg.from.id] = {};

  bot.sendMessage(msg.chat.id, "Nome do produto:");
});

bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  if (!addStep[id]) return;
  if (!text || text.startsWith("/")) return;

  if (addStep[id] === "nome") {
    addData[id].nome = text;
    addStep[id] = "valor";
    return bot.sendMessage(msg.chat.id, "Valor:");
  }

  if (addStep[id] === "valor") {
    addData[id].valor = text;
    addStep[id] = "descricao";
    return bot.sendMessage(msg.chat.id, "Descrição:");
  }

  if (addStep[id] === "descricao") {
    addData[id].descricao = text;
    addStep[id] = "estoque";
    return bot.sendMessage(msg.chat.id, "Estoque:");
  }

  if (addStep[id] === "estoque") {
    addData[id].estoque = Number(text);
    addStep[id] = "whatsapp";
    return bot.sendMessage(msg.chat.id, "WhatsApp:");
  }

  if (addStep[id] === "whatsapp") {
    addData[id].whatsapp = text;
    addStep[id] = "instagram";
    return bot.sendMessage(msg.chat.id, "Instagram:");
  }

  if (addStep[id] === "instagram") {

    addData[id].instagram = text;

    await db.collection("produtos").add(addData[id]);

    delete addStep[id];
    delete addData[id];

    bot.sendMessage(msg.chat.id, "✔ Produto criado");
  }
});

// ================= PEDIDOS ADMIN =================
bot.onText(/\/pedidos/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const snap = await db.collection("pedidos").get();

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id,
`🆔 ${p.orderId}
📦 ${p.produto}
💰 ${p.valor}
👤 @${p.username}
📊 ${p.status}`);
  });
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id, "⚡ Bot online");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("⚡ BOT INFINITY COMPLETO ONLINE");
});
