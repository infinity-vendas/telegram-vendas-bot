require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const ADMIN_ID = "6863505946";

// ================= FIREBASE =================
let db;

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  initializeApp({
    credential: cert(serviceAccount)
  });

  db = getFirestore();
  console.log("🔥 Firebase conectado");

} catch (e) {
  console.log("❌ Firebase erro:", e.message);
}

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: true
});

const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;

// ================= WEBHOOK =================
app.post(SECRET_PATH, (req, res) => {
  res.sendStatus(200);
  bot.processUpdate(req.body);
});

app.get('/', (req, res) => res.send("🚀 BOT ONLINE"));

// ================= ESTADO =================
const userState = {};

// ================= IMAGENS =================
const LOGO = "https://i.postimg.cc/BQwJ8VTL/Red-Zone-Cliente.jpg";

// ================= FUNÇÕES =================
async function getUser(id) {
  const doc = await db.collection('users').doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function isActive(id) {
  const user = await getUser(id);
  if (!user || !user.expiraEm) return false;
  return Date.now() < user.expiraEm;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;
  const id = String(msg.from.id);

  await bot.sendPhoto(chatId, LOGO);

  const user = await getUser(id);

  // ===== CADASTRO =====
  if (!user) {
    userState[id] = { step: "cadastro" };

    return bot.sendMessage(chatId,
`📋 Cadastro necessário

Envie:
Nick | Idade | Whatsapp`);
  }

  // ===== VERIFICAR PLANO =====
  if (!(await isActive(id))) {
    return bot.sendMessage(chatId,
`🚫 Seu acesso expirou

💰 Compre um plano para continuar

1 DIA = R$5
7 DIAS = R$20
30 DIAS = R$50

📲 Contato:
+55 51 98152-8372`);
  }

  // ===== MENU =====
  bot.sendMessage(chatId,
`👑 VIP LIBERADO

/comandos disponíveis:

/produtos
/status
/plano
/info`);
});

// ================= MENSAGENS =================
bot.on("message", async (msg) => {

  if (!msg.text) return;

  const id = String(msg.from.id);
  const text = msg.text;
  const state = userState[id];

  // ===== CADASTRO =====
  if (state?.step === "cadastro") {

    if (!text.includes("|"))
      return bot.sendMessage(msg.chat.id, "Use: Nick | Idade | Whatsapp");

    const [nome, idade, whatsapp] = text.split("|");

    await db.collection('users').doc(id).set({
      nome: nome.trim(),
      idade: idade.trim(),
      whatsapp: whatsapp.trim(),
      criadoEm: new Date(),
      expiraEm: null
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id,
"✅ Cadastro feito! Aguarde liberação");
  }

  // ===== BLOQUEIO =====
  const active = await isActive(id);

  if (!active && text !== "/start") {
    return bot.sendMessage(msg.chat.id,
"🚫 Plano expirado. Fale com suporte");
  }
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection('produtos').get();

  if (snap.empty)
    return bot.sendMessage(msg.chat.id, "Sem produtos");

  for (const doc of snap.docs) {
    const p = doc.data();

    bot.sendMessage(msg.chat.id,
`📦 ${p.nome}
💰 ${p.preco}
📲 ${p.whatsapp}`,
{
  reply_markup: {
    inline_keyboard: [
      [{ text: "🛒 Comprar", callback_data: `buy_${doc.id}` }]
    ]
  }
});
  }
});

// ================= PLANO =================
bot.onText(/\/plano/, async (msg) => {

  const id = String(msg.from.id);

  const user = await getUser(id);

  if (!user?.expiraEm)
    return bot.sendMessage(msg.chat.id, "Sem plano ativo");

  const dias = Math.ceil((user.expiraEm - Date.now()) / 86400000);

  bot.sendMessage(msg.chat.id,
`💎 Plano ativo

Dias restantes: ${dias}`);
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
"🔥 Sistema online");
});

// ================= INFO =================
bot.onText(/\/info/, (msg) => {
  bot.sendMessage(msg.chat.id,
"📦 Produtos digitais\n⚡ Entrega rápida");
});

// ================= COMPRA =================
bot.on("callback_query", async (q) => {

  await db.collection('vendas').add({
    cliente: q.from.id,
    produto: q.data,
    data: new Date()
  });

  bot.answerCallbackQuery(q.id, {
    text: "✅ Pedido registrado"
  });
});

// ================= ADMIN =================

// liberar usuário
bot.onText(/\/liberar (\d+) (\d+)/, async (msg, m) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  const userId = m[1];
  const dias = parseInt(m[2]);

  const expira = Date.now() + (dias * 86400000);

  await db.collection('users').doc(userId).set({
    expiraEm: expira
  }, { merge: true });

  bot.sendMessage(msg.chat.id,
`✅ Liberado

ID: ${userId}
Dias: ${dias}`);
});

// adicionar produto
bot.onText(/\/addprod/, (msg) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  userState[msg.from.id] = { step: "add" };

  bot.sendMessage(msg.chat.id,
"nome | preco | whatsapp");
});

// fluxo add produto
bot.on("message", async (msg) => {

  const id = String(msg.from.id);

  if (userState[id]?.step === "add") {

    const [nome, preco, whatsapp] = msg.text.split("|");

    await db.collection('produtos').add({
      nome, preco, whatsapp
    });

    userState[id] = null;

    bot.sendMessage(msg.chat.id, "Produto adicionado");
  }
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

  await bot.setWebHook(url);

  console.log("Webhook:", url);
});
