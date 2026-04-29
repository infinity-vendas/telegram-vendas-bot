require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// =============================
// 🔐 CONFIG
// =============================
const ADMIN_ID = "6863505946"; // coloque seu ID
const BOT_USERNAME = "SellForge_bot";

// =============================
// 🔥 FIREBASE
// =============================
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// =============================
// 🤖 BOT (WEBHOOK)
// =============================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// =============================
// 🌐 WEBHOOK
// =============================
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;
bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`);

app.post(SECRET_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send("🔥 BOT ONLINE"));

// =============================
// 🧠 CONTROLE
// =============================
const userState = {};
const startTime = Date.now();

// =============================
// 💾 SALVAR USER
// =============================
async function salvarUser(msg) {
  const id = String(msg.from.id);
  const ref = db.collection('users').doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set({
      id,
      nome: msg.from.first_name || "User",
      aprovado: false,
      criadoEm: new Date()
    });
  }
}

// =============================
// 🚀 START
// =============================
bot.onText(/\/start$/, async (msg) => {

  const id = String(msg.from.id);
  await salvarUser(msg);

  await bot.sendPhoto(msg.chat.id, "https://i.postimg.cc/Y9FHz03z/logo.jpg");

  await bot.sendMessage(msg.chat.id, `
🔥 BEM-VINDO AO SELLFORGE BOT 🔥

🤖 @${BOT_USERNAME}

Automação de vendas no piloto automático 🚀

Escolha uma opção abaixo 👇
`);

  const doc = await db.collection('users').doc(id).get();
  const user = doc.data();

  if (id === ADMIN_ID) return menuAdmin(msg);
  if (user.aprovado) return menuVendedor(msg);
  return menuCliente(msg);
});

// =============================
// 🛍️ LINK VENDEDOR
// =============================
bot.onText(/\/start (.+)/, async (msg, match) => {

  const vendedorId = match[1];

  const snap = await db.collection('produtos')
    .doc(vendedorId)
    .collection('itens')
    .get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Nenhum produto disponível");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendPhoto(msg.chat.id, p.foto, {
      caption: `🛍️ ${p.nome}\n💰 ${p.preco}\n${p.descricao}`,
      reply_markup: {
        inline_keyboard: [[{ text: "🛒 Comprar", url: p.link }]]
      }
    });
  });
});

// =============================
// 🎮 MENUS
// =============================
function menuCliente(msg) {
  bot.sendMessage(msg.chat.id, `
👤 MENU CLIENTE

/ver ID
/status
/denunciar ID
`);
}

function menuVendedor(msg) {
  bot.sendMessage(msg.chat.id, `
💼 MENU VENDEDOR

/addproduto
/produtos
/deletar ID
/link
/deletartudo
`);
}

function menuAdmin(msg) {
  bot.sendMessage(msg.chat.id, `
👑 MENU ADMIN

/aprovar ID
/bloquear ID
/desbloquear ID
/ban ID
/deleteproduto USERID PRODUTOID
/verusuarios
/status
`);
}

// =============================
// 📦 COMANDOS
// =============================

// LINK
bot.onText(/\/link/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🔗 https://t.me/${BOT_USERNAME}?start=${msg.from.id}`);
});

// ADD PRODUTO
bot.onText(/\/addproduto/, (msg) => {
  userState[msg.from.id] = { step: "foto" };
  bot.sendMessage(msg.chat.id, "📸 Envie a foto do produto");
});

// LISTAR PRODUTOS
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection('produtos')
    .doc(String(msg.from.id))
    .collection('itens')
    .get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, "❌ Nenhum produto");

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `🆔 ID: ${doc.id}`);
    bot.sendPhoto(msg.chat.id, p.foto, {
      caption: `${p.nome} - ${p.preco}`
    });
  });
});

// DELETAR PRODUTO
bot.onText(/\/deletar (.+)/, async (msg, m) => {

  await db.collection('produtos')
    .doc(String(msg.from.id))
    .collection('itens')
    .doc(m[1])
    .delete();

  bot.sendMessage(msg.chat.id, "🗑️ Deletado");
});

// DELETAR TODOS
bot.onText(/\/deletartudo/, async (msg) => {

  const snap = await db.collection('produtos')
    .doc(String(msg.from.id))
    .collection('itens')
    .get();

  const batch = db.batch();

  snap.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  bot.sendMessage(msg.chat.id, "🗑️ Todos produtos removidos");
});

// VER PRODUTOS
bot.onText(/\/ver (.+)/, async (msg, m) => {

  const snap = await db.collection('produtos')
    .doc(m[1])
    .collection('itens')
    .get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, "❌ Nenhum");

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendPhoto(msg.chat.id, p.foto, {
      caption: `${p.nome}\n💰 ${p.preco}`,
      reply_markup: {
        inline_keyboard: [[{ text: "🛒 Comprar", url: p.link }]]
      }
    });
  });
});

// DENÚNCIA
bot.onText(/\/denunciar (.+)/, async (msg, m) => {

  await db.collection('denuncias').add({
    alvo: m[1],
    autor: msg.from.id,
    data: new Date()
  });

  bot.sendMessage(msg.chat.id, "🚨 Denúncia enviada");
});

// =============================
// 👑 ADMIN
// =============================
bot.onText(/\/aprovar (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('users').doc(m[1]).set({ aprovado: true }, { merge: true });
  bot.sendMessage(msg.chat.id, "✅ Aprovado");
});

bot.onText(/\/bloquear (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('users').doc(m[1]).set({ aprovado: false }, { merge: true });
  bot.sendMessage(msg.chat.id, "🚫 Bloqueado");
});

bot.onText(/\/desbloquear (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('users').doc(m[1]).set({ aprovado: true }, { merge: true });
  bot.sendMessage(msg.chat.id, "🔓 Liberado");
});

bot.onText(/\/ban (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('users').doc(m[1]).delete();
  bot.sendMessage(msg.chat.id, "🚫 Banido");
});

bot.onText(/\/deleteproduto (.+) (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('produtos')
    .doc(m[1])
    .collection('itens')
    .doc(m[2])
    .delete();

  bot.sendMessage(msg.chat.id, "🗑️ Produto removido");
});

bot.onText(/\/verusuarios/, async (msg) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const snap = await db.collection('users').get();
  bot.sendMessage(msg.chat.id, `👥 Total usuários: ${snap.size}`);
});

// =============================
// 📊 STATUS
// =============================
bot.onText(/\/status/, (msg) => {

  const uptime = Math.floor((Date.now() - startTime) / 1000);

  bot.sendMessage(msg.chat.id,
`📊 STATUS

⏱️ ${uptime}s
📡 Online
💎 Sistema ativo`);
});

// =============================
// 🤖 AUTO RESPOSTA
// =============================
bot.on('message', async (msg) => {

  if (!msg.text || msg.text.startsWith("/")) return;

  const text = msg.text.toLowerCase();

  if (text.includes("preço") || text.includes("valor")) {
    bot.sendMessage(msg.chat.id,
"💰 Planos a partir de R$25\nDigite /ver ID para ver produtos");
  }

  if (text.includes("comprar")) {
    bot.sendMessage(msg.chat.id,
"🛒 Clique no botão do produto ou fale com suporte:\nhttps://wa.me/5551981528372");
  }
});

// =============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 BOT RODANDO");
});
