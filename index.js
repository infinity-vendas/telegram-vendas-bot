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
  console.error("Erro Firebase");
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
    console.error(e);
  }
});

app.get('/', (req, res) => res.send("ONLINE"));

// ================= SEGURANÇA =================
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// ================= CONTROLE =================
const userState = {};

// ================= FUNÇÕES =================
async function getUser(id) {
  const ref = db.collection('users').doc(id);
  const doc = await ref.get();

  if (!doc.exists) return null;
  return doc.data();
}

// ================= START =================
bot.onText(/\/start$/, async (msg) => {

  const id = String(msg.from.id);
  const user = await getUser(id);

  // NÃO CADASTRADO
  if (!user || !user.nome) {

    userState[id] = { step: "cadastro" };

    return bot.sendPhoto(msg.chat.id,
      "https://i.postimg.cc/BQwJ8VTL/Red-Zone-Cliente.jpg",
      {
        caption:
`🚫 É necessário se cadastrar antes de usar o bot

📋 Envie no formato:

Nick | Idade | Whatsapp`
      }
    );
  }

  // MENU
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

// ================= CADASTRO =================
bot.on('message', async (msg) => {

  const id = String(msg.from.id);
  const state = userState[id];

  if (!state) return;

  if (state.step === "cadastro") {

    if (!msg.text.includes("|")) {
      return bot.sendMessage(msg.chat.id,
        "❌ Use: Nick | Idade | Whatsapp");
    }

    const [nick, idade, whatsapp] = msg.text.split("|");

    await db.collection('users').doc(id).set({
      nome: nick.trim(),
      idade: idade.trim(),
      whatsapp: whatsapp.trim(),
      criadoEm: new Date()
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id,
"✅ Cadastro concluído! Digite /start novamente");
  }
});

// ================= PRODUTOS =================
bot.on("message", async (msg) => {

  if (msg.text !== "📦 Produtos") return;

  const snap = await db.collection('produtos').get();

  if (snap.empty)
    return bot.sendMessage(msg.chat.id, "🚫 Sem produtos");

  const imgs = [
    "https://i.postimg.cc/8cYLsVNw/img2.jpg",
    "https://i.postimg.cc/h4ZL2VVq/img3.jpg",
    "https://i.postimg.cc/3xm2r661/img4.jpg",
    "https://i.postimg.cc/yNKcDjCH/img5.jpg",
    "https://i.postimg.cc/W47rgZsd/img6.jpg"
  ];

  let i = 0;

  for (const doc of snap.docs) {
    const p = doc.data();

    await bot.sendPhoto(msg.chat.id, imgs[i % imgs.length], {
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
});

// ================= COMPRA =================
bot.on("callback_query", async (q) => {

  if (!q.data.startsWith("buy_")) return;

  await db.collection('vendas').add({
    cliente: q.from.id,
    produto: q.data,
    data: new Date()
  });

  bot.answerCallbackQuery(q.id, { text: "✅ Compra registrada" });
});

// ================= STATUS =================
bot.on("message", (msg) => {

  if (msg.text !== "📊 Status") return;

  bot.sendMessage(msg.chat.id,
`📊 STATUS

Versão: 1.0
Sistema: Online

👑 Dono: Faelzin
📞 +55 51 981528372

📲 Insta: @Infinity_clientes_oficial`);
});

// ================= INFO =================
bot.on("message", (msg) => {

  if (msg.text !== "ℹ️ Informações") return;

  bot.sendMessage(msg.chat.id,
`📢 Informações

Produtos digitais disponíveis
Entrega rápida

Contato direto com vendedor`);
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

// adicionar produto
bot.onText(/\/adicionar/, (msg) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  userState[msg.from.id] = { step: "add" };

  bot.sendMessage(msg.chat.id,
"nome | preco | whatsapp");
});

// fluxo admin
bot.on('message', async (msg) => {

  const id = String(msg.from.id);
  const state = userState[id];

  if (!state) return;

  if (state.step === "add") {

    const [nome, preco, whatsapp] = msg.text.split("|");

    await db.collection('produtos').add({
      nome: nome.trim(),
      preco: preco.trim(),
      whatsapp: whatsapp.trim()
    });

    userState[id] = null;

    bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
  }
});

// deletar
bot.onText(/\/deletar (.+)/, async (msg, m) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('produtos').doc(m[1]).delete();

  bot.sendMessage(msg.chat.id, "🗑️ Deletado");
});

// deletar tudo
bot.onText(/\/deletartudo/, async (msg) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  const snap = await db.collection('produtos').get();

  for (const doc of snap.docs) {
    await doc.ref.delete();
  }

  bot.sendMessage(msg.chat.id, "🔥 Tudo apagado");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  try {
    const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

    await bot.deleteWebHook();
    await bot.setWebHook(url);

    console.log("Webhook ativo:", url);

  } catch (e) {
    console.error(e);
  }
});
