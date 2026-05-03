require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const ADMIN_ID = "6863505946";
const MAX_USERS = 50;

// ================= FIREBASE =================
let serviceAccount;

try {
  serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
} catch (e) {
  console.error("Erro ao carregar Firebase");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore({ ignoreUndefinedProperties: true });

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN);
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

app.get('/', (req, res) => res.send("ONLINE"));

// ================= SEGURANÇA =================
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// ================= ESTADO =================
const userState = {};

// ================= FUNÇÕES =================
async function getUser(id) {
  const doc = await db.collection('users').doc(id).get();
  return doc.exists ? doc.data() : null;
}

// ================= START =================
bot.onText(/\/start$/, async (msg) => {
  const id = String(msg.from.id);
  const user = await getUser(id);

  if (!user || !user.nome) {
    userState[id] = { step: "cadastro" };

    return bot.sendMessage(msg.chat.id,
`📋 Cadastro necessário

Envie:
Nick | Idade | Whatsapp`);
  }

  bot.sendMessage(msg.chat.id,
`🔥 Bem-vindo, ${user.nome}`,
{
  reply_markup: {
    keyboard: [
      ["📦 Produtos", "📊 Status"],
      ["ℹ️ Informações"]
    ],
    resize_keyboard: true
  }
});
});

// ================= MENSAGENS (CENTRAL) =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;
  const state = userState[id];

  // ===== CADASTRO =====
  if (state?.step === "cadastro") {

    if (!text.includes("|")) {
      return bot.sendMessage(msg.chat.id, "Use: Nick | Idade | Whatsapp");
    }

    const [nick, idade, whatsapp] = text.split("|");

    const totalUsers = (await db.collection('users').get()).size;

    if (totalUsers >= MAX_USERS) {
      return bot.sendMessage(msg.chat.id, "🚫 Limite de usuários atingido");
    }

    await db.collection('users').doc(id).set({
      nome: nick.trim(),
      idade: idade.trim(),
      whatsapp: whatsapp.trim(),
      criadoEm: new Date()
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id,
"✅ Cadastro concluído! Digite /start");
  }

  // ===== ADMIN ADD =====
  if (state?.step === "add") {

    const [nome, preco, whatsapp] = text.split("|");

    await db.collection('produtos').add({
      nome: nome.trim(),
      preco: preco.trim(),
      whatsapp: whatsapp.trim()
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
  }

  // ===== MENU =====
  if (text === "📦 Produtos") {

    const snap = await db.collection('produtos').get();

    if (snap.empty)
      return bot.sendMessage(msg.chat.id, "❌ Sem produtos");

    for (const doc of snap.docs) {
      const p = doc.data();

      await bot.sendMessage(msg.chat.id,
`📦 ${p.nome}
💰 ${p.preco}
📞 ${p.whatsapp}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Comprar", callback_data: `buy_${doc.id}` }]
          ]
        }
      });
    }
  }

  if (text === "📊 Status") {
    bot.sendMessage(msg.chat.id,
`📊 STATUS

Sistema: Online
Versão: 2.0

👑 Dono: Faelzin`);
  }

  if (text === "ℹ️ Informações") {
    bot.sendMessage(msg.chat.id,
`ℹ️ Informações

Produtos digitais
Entrega rápida
Suporte direto`);
  }
});

// ================= COMPRA =================
bot.on("callback_query", async (q) => {

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

// ================= ADMIN =================
bot.onText(/\/admin/, (msg) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  bot.sendMessage(msg.chat.id,
`🔐 ADMIN

/adicionar
/deletar ID
/deletartudo`);
});

bot.onText(/\/adicionar/, (msg) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  userState[msg.from.id] = { step: "add" };

  bot.sendMessage(msg.chat.id,
"nome | preco | whatsapp");
});

bot.onText(/\/deletar (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('produtos').doc(m[1]).delete();

  bot.sendMessage(msg.chat.id, "🗑️ Deletado");
});

bot.onText(/\/deletartudo/, async (msg) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const snap = await db.collection('produtos').get();

  for (const doc of snap.docs) {
    await doc.ref.delete();
  }

  bot.sendMessage(msg.chat.id, "🗑️ Tudo apagado");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🔥 ONLINE");

  try {
    const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

    await bot.deleteWebHook();
    await bot.setWebHook(url);

    console.log("Webhook ativo:", url);

  } catch (e) {
    console.error(e);
  }
});
