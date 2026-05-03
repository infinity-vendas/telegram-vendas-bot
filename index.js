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
let db = null;

try {
  if (!process.env.FIREBASE_CONFIG) throw new Error("Sem Firebase");

  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  initializeApp({
    credential: cert(serviceAccount)
  });

  db = getFirestore();
  console.log("🔥 Firebase conectado");

} catch (e) {
  console.log("⚠️ Firebase erro:", e.message);
}

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: true
});

const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;

// ================= WEBHOOK =================
app.post(SECRET_PATH, (req, res) => {
  res.sendStatus(200);
  try {
    bot.processUpdate(req.body);
  } catch (e) {
    console.error("Erro webhook:", e);
  }
});

app.get('/', (req, res) => res.send("🔥 ONLINE"));

// ================= ESTADO =================
const userState = {};

// ================= IMAGENS =================
const LOGO = "https://i.postimg.cc/BQwJ8VTL/Red-Zone-Cliente.jpg";

const PROD_IMGS = [
  "https://i.postimg.cc/8cYLsVNw/img2.jpg",
  "https://i.postimg.cc/h4ZL2VVq/img3.jpg",
  "https://i.postimg.cc/3xm2r661/img4.jpg",
  "https://i.postimg.cc/yNKcDjCH/img5.jpg",
  "https://i.postimg.cc/W47rgZsd/img6.jpg"
];

// ================= FUNÇÕES =================
async function getUser(id) {
  const doc = await db.collection('users').doc(id).get();
  return doc.exists ? doc.data() : null;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  if (!db) return bot.sendMessage(chatId, "⚠️ Banco offline");

  const id = String(msg.from.id);
  const user = await getUser(id);

  // ===== LOGO =====
  await bot.sendPhoto(chatId, LOGO);

  // ===== NÃO CADASTRADO =====
  if (!user) {
    userState[id] = { step: "cadastro" };

    return bot.sendMessage(chatId,
`📋 Cadastro necessário

Envie:
Nick | Idade | Whatsapp`);
  }

  // ===== BOAS VINDAS =====
  await bot.sendMessage(chatId,
`🔥 Bem-vindo, ${user.nome}

🚀 RED ZONE - Painel Digital

Escolha abaixo 👇`);

  // ===== PRODUTOS =====
  const snap = await db.collection('produtos').get();

  if (!snap.empty) {

    let i = 0;

    for (const doc of snap.docs) {
      const p = doc.data();

      await bot.sendPhoto(chatId, PROD_IMGS[i % PROD_IMGS.length], {
        caption:
`📦 ${p.nome}
💰 ${p.preco}
📲 ${p.whatsapp}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Comprar", callback_data: `buy_${doc.id}` }]
          ]
        }
      });

      i++;
    }
  }

  // ===== COMANDOS =====
  await bot.sendMessage(chatId,
`📌 COMANDOS

📦 /produtos
📊 /status
ℹ️ /info

🔥 RED ZONE`);
});

// ================= MENSAGENS =================
bot.on("message", async (msg) => {

  if (!db) return;

  const id = String(msg.from.id);
  const text = msg.text;
  const state = userState[id];

  if (!text) return;

  // ===== CADASTRO =====
  if (state?.step === "cadastro") {

    if (!text.includes("|")) {
      return bot.sendMessage(msg.chat.id, "Use: Nick | Idade | Whatsapp");
    }

    const [nome, idade, whatsapp] = text.split("|");

    await db.collection('users').doc(id).set({
      nome: nome.trim(),
      idade: idade.trim(),
      whatsapp: whatsapp.trim(),
      criadoEm: new Date()
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id,
"✅ Cadastro concluído! Digite /start");
  }
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  if (!db) return;

  const snap = await db.collection('produtos').get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Sem produtos");
  }

  for (const doc of snap.docs) {
    const p = doc.data();

    await bot.sendMessage(msg.chat.id,
`📦 ${p.nome}
💰 ${p.preco}
📲 ${p.whatsapp}`);
  }
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {

  bot.sendMessage(msg.chat.id,
`📊 STATUS

Sistema: Online
🔥 RED ZONE`);
});

// ================= INFO =================
bot.onText(/\/info/, (msg) => {

  bot.sendMessage(msg.chat.id,
`ℹ️ Produtos digitais
Entrega rápida
Suporte direto`);
});

// ================= COMPRA =================
bot.on("callback_query", async (q) => {

  if (!db) return;

  if (!q.data.startsWith("buy_")) return;

  await db.collection('vendas').add({
    cliente: q.from.id,
    produto: q.data,
    data: new Date()
  });

  bot.answerCallbackQuery(q.id, {
    text: "✅ Compra registrada"
  });
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🔥 Servidor ONLINE");

  try {
    const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

    await bot.deleteWebHook();
    await bot.setWebHook(url);

    console.log("✅ Webhook ativo:", url);

  } catch (e) {
    console.error(e);
  }
});
