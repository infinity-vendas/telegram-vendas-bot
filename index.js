require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// 🔐 CONFIG
const ADMIN_ID = "6863505946";
const BOT_USERNAME = "SellForge_bot";

// 🎨 VISUAL
const topo = `╔════════ SELLFORGE ════════╗`;
const linha = `━━━━━━━━━━━━━━━━━━━━`;
const rodape = `╚═══════════════════════════╝`;

// 🔥 FIREBASE
let db;

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  db = admin.firestore();
  console.log("🔥 Firebase conectado");

} catch (err) {
  console.error("❌ ERRO FIREBASE:", err);
}

// 🤖 BOT
const bot = new TelegramBot(process.env.BOT_TOKEN);

// 🔒 WEBHOOK
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;
const url = process.env.RENDER_EXTERNAL_URL;

bot.setWebHook(`${url}${SECRET_PATH}`);

app.post(SECRET_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send("🔥 Online"));

// 🧠 CONTROLE
const userState = {}; // controla fluxo do usuário
const userCooldown = new Map();

// =============================
// 💾 SALVAR USER
// =============================
async function salvarUser(msg) {
  const id = String(msg.from.id);

  await db.collection('users').doc(id).set({
    id,
    nome: msg.from.first_name || "User",
    aprovado: false,
    atualizadoEm: new Date()
  }, { merge: true });
}

// =============================
// 🎮 MENU
// =============================
function menu(tipo, userId) {

  if (tipo === "admin") {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👥 Usuários", callback_data: "users" }],
          [{ text: "🆔 Meu ID", callback_data: "id" }]
        ]
      }
    };
  }

  if (tipo === "vendedor") {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📦 Produtos", callback_data: "produtos" }],
          [{ text: "➕ Adicionar Produto", callback_data: "addproduto" }],
          [{ text: "🔗 Meu Link", callback_data: "link" }],
          [{ text: "🆔 Meu ID", callback_data: "id" }]
        ]
      }
    };
  }

  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🆔 Meu ID", callback_data: "id" }]
      ]
    }
  };
}

// =============================
// 🚀 START COM LINK (CLIENTE)
// =============================
bot.onText(/\/start (.+)/, async (msg, match) => {

  const vendedorId = match[1];
  await salvarUser(msg);

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
      caption:
`🛍️ ${p.nome}

💰 ${p.preco}
📄 ${p.descricao}`,
      reply_markup: {
        inline_keyboard: [[{ text: "🛒 Comprar", url: p.link }]]
      }
    });
  });
});

// =============================
// 🚀 START NORMAL
// =============================
bot.onText(/\/start$/, async (msg) => {

  const userId = String(msg.from.id);

  await salvarUser(msg);

  await bot.sendPhoto(msg.chat.id, "https://i.postimg.cc/Y9FHz03z/logo.jpg");

  await bot.sendMessage(msg.chat.id,
`${topo}

🔥 Bem-vindo ao SELLFORGE

${linha}

💰 Automatize suas vendas
🚀 Ganhe dinheiro no automático

${linha}

⏳ Carregando...`);

  const doc = await db.collection('users').doc(userId).get();
  const userData = doc.data();

  // ADMIN
  if (userId === ADMIN_ID) {
    return bot.sendMessage(msg.chat.id,
`👑 PAINEL ADMIN`,
menu("admin", userId));
  }

  // VENDEDOR
  if (userData?.aprovado) {
    return bot.sendMessage(msg.chat.id,
`💼 PAINEL VENDEDOR`,
menu("vendedor", userId));
  }

  // BLOQUEADO
  bot.sendMessage(msg.chat.id,
`⛔ Aguardando aprovação do administrador`,
menu("user", userId));
});

// =============================
// 🎮 BOTÕES
// =============================
bot.on('callback_query', async (q) => {

  const msg = q.message;
  const userId = String(q.from.id);
  const data = q.data;

  bot.answerCallbackQuery(q.id);

  const doc = await db.collection('users').doc(userId).get();
  const aprovado = doc.data()?.aprovado;

  if (data === "id") {
    return bot.sendMessage(msg.chat.id, `🆔 Seu ID: ${userId}`);
  }

  if (data === "link") {
    return bot.sendMessage(msg.chat.id,
`🔗 Seu link:
https://t.me/${BOT_USERNAME}?start=${userId}`);
  }

  if (data === "addproduto") {

    if (!aprovado) {
      return bot.sendMessage(msg.chat.id, "⛔ Você não está aprovado");
    }

    userState[userId] = { step: "foto" };

    return bot.sendMessage(msg.chat.id,
`📸 Envie a FOTO do produto`);
  }

  if (data === "produtos") {

    const snap = await db.collection('produtos')
      .doc(userId)
      .collection('itens')
      .get();

    if (snap.empty) {
      return bot.sendMessage(msg.chat.id, "❌ Nenhum produto");
    }

    snap.forEach(doc => {
      const p = doc.data();

      bot.sendPhoto(msg.chat.id, p.foto, {
        caption: `${p.nome} - ${p.preco}`
      });
    });
  }

  if (data === "users") {
    if (userId !== ADMIN_ID) return;

    const snap = await db.collection('users').get();
    bot.sendMessage(msg.chat.id, `👥 ${snap.size} usuários`);
  }
});

// =============================
// 👑 APROVAR
// =============================
bot.onText(/\/aprovar (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('users').doc(m[1]).set({
    aprovado: true
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "✅ Usuário aprovado");
});

// =============================
// 💾 MESSAGE
// =============================
bot.on('message', async (msg) => {

  try {
    if (!msg.from) return;

    const id = String(msg.from.id);

    await salvarUser(msg);

    // 🚫 anti spam
    const now = Date.now();
    if (userCooldown.has(id) && now - userCooldown.get(id) < 1500) return;
    userCooldown.set(id, now);

    const state = userState[id];

    // =============================
    // 📸 FOTO
    // =============================
    if (state?.step === "foto" && msg.photo) {

      const fileId = msg.photo[msg.photo.length - 1].file_id;

      state.foto = fileId;
      state.step = "dados";

      return bot.sendMessage(msg.chat.id,
`Agora envie:
nome | preco | descricao | link`);
    }

    // =============================
    // 📝 DADOS
    // =============================
    if (state?.step === "dados" && msg.text?.includes("|")) {

      const doc = await db.collection('users').doc(id).get();

      if (!doc.data()?.aprovado) {
        userState[id] = null;
        return bot.sendMessage(msg.chat.id, "⛔ Sem acesso");
      }

      const [nome, preco, descricao, link] = msg.text.split("|");

      await db.collection('produtos')
        .doc(id)
        .collection('itens')
        .add({
          nome: nome.trim(),
          preco: preco.trim(),
          descricao: descricao.trim(),
          link: link.trim(),
          foto: state.foto,
          criadoEm: new Date()
        });

      userState[id] = null;

      return bot.sendMessage(msg.chat.id, "✅ Produto cadastrado com foto!");
    }

  } catch (err) {
    console.error(err);
  }
});

// 🚀 SERVER
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Rodando...");
});
