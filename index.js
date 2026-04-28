require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// 🔐 Firebase via ENV
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🤖 Bot SEM polling
const bot = new TelegramBot(process.env.BOT_TOKEN);

// 🔒 webhook seguro
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;
const url = process.env.RENDER_EXTERNAL_URL;

bot.setWebHook(`${url}${SECRET_PATH}`);

app.post(SECRET_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 🌐 rota padrão
app.get('/', (req, res) => {
  res.send("🔥 Bot online");
});

// 🧠 anti-spam
const userCooldown = new Map();

// ⏳ converter dias
function diasParaMs(dias) {
  return dias * 24 * 60 * 60 * 1000;
}

// =============================
// 🚀 START COM LINK VENDEDOR
// =============================
bot.onText(/\/start (.+)/, async (msg, match) => {
  const vendedorId = match[1];
  const userId = String(msg.from.id);

  await db.collection('users').doc(userId).set({
    vendedor: vendedorId
  }, { merge: true });

  const produtosSnap = await db.collection('produtos')
    .doc(vendedorId)
    .collection('itens')
    .get();

  if (produtosSnap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Nenhum produto disponível.");
  }

  produtosSnap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id,
`🛍️ ${p.nome}
💰 ${p.preco}
📄 ${p.descricao}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Comprar", url: p.link }]
          ]
        }
      }
    );
  });
});

// =============================
// 🚀 START NORMAL (VENDEDOR)
// =============================
bot.onText(/\/start$/, (msg) => {
  const userId = msg.from.id;

  bot.sendMessage(msg.chat.id,
`🔥 Bem-vindo!

Seu link de vendas:
https://t.me/SellForge_bot?start=${userId}`);
});

// =============================
// 🛍️ CADASTRAR PRODUTO
// =============================
bot.onText(/\/addproduto/, (msg) => {
  bot.sendMessage(msg.chat.id,
"Envie:\nnome | preco | descricao | link");
});

// =============================
// 📦 LISTAR PRODUTOS
// =============================
bot.onText(/\/produtos/, async (msg) => {
  const userId = String(msg.from.id);

  const snap = await db.collection('produtos')
    .doc(userId)
    .collection('itens')
    .get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Nenhum produto.");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id,
`${p.nome} - ${p.preco}`);
  });
});

// =============================
// ⏳ ATIVAR PLANO
// =============================
bot.onText(/\/ativar (.+)/, async (msg, match) => {
  const userId = String(msg.from.id);
  const dias = parseInt(match[1]);

  if (isNaN(dias)) {
    return bot.sendMessage(msg.chat.id, "❌ Use: /ativar 7");
  }

  const expiraEm = Date.now() + diasParaMs(dias);

  await db.collection('users').doc(userId).set({
    expiraEm
  }, { merge: true });

  bot.sendMessage(msg.chat.id, `✅ Plano ativado por ${dias} dias`);
});

// =============================
// 📊 STATUS
// =============================
bot.onText(/\/status/, async (msg) => {
  const userId = String(msg.from.id);

  const doc = await db.collection('users').doc(userId).get();

  if (!doc.exists || !doc.data().expiraEm) {
    return bot.sendMessage(msg.chat.id, "❌ Sem plano.");
  }

  const restante = doc.data().expiraEm - Date.now();

  if (restante <= 0) {
    return bot.sendMessage(msg.chat.id, "❌ Expirado.");
  }

  const dias = Math.floor(restante / (1000 * 60 * 60 * 24));

  bot.sendMessage(msg.chat.id, `⏳ Restam ${dias} dias`);
});

// =============================
// 💾 MESSAGE HANDLER
// =============================
bot.on('message', async (msg) => {
  try {
    if (!msg.from || !msg.chat) return;

    const userId = String(msg.from.id);

    const doc = await db.collection('users').doc(userId).get();
    const data = doc.data();

    // 🚫 BLOQUEIO POR EXPIRAÇÃO
    if (data?.expiraEm && Date.now() > data.expiraEm) {
      return bot.sendMessage(msg.chat.id, "❌ Seu acesso expirou.");
    }

    // 🚫 anti-spam
    const now = Date.now();
    if (userCooldown.has(userId) && now - userCooldown.get(userId) < 3000) {
      return;
    }
    userCooldown.set(userId, now);

    // 🛍️ CADASTRO PRODUTO
    if (msg.text && msg.text.includes("|")) {

      const partes = msg.text.split("|");
      if (partes.length < 4) return;

      const [nome, preco, descricao, link] = partes;

      await db.collection('produtos')
        .doc(userId)
        .collection('itens')
        .add({
          nome: nome.trim(),
          preco: preco.trim(),
          descricao: descricao.trim(),
          link: link.trim()
        });

      return bot.sendMessage(msg.chat.id, "✅ Produto cadastrado!");
    }

    // 💾 salvar usuário
    await db.collection('users').doc(userId).set({
      id: userId,
      nome: msg.from.first_name || "User",
      updatedAt: new Date()
    }, { merge: true });

  } catch (err) {
    console.log(err);
  }
});

// 🚀 iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor rodando...");
});
