require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// 🔐 CONFIG
const ADMIN_ID = "6863505946"; // coloque seu ID

// 🔐 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🤖 Bot
const bot = new TelegramBot(process.env.BOT_TOKEN);

// 🔒 Webhook
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;
const url = process.env.RENDER_EXTERNAL_URL;

bot.setWebHook(`${url}${SECRET_PATH}`);

app.post(SECRET_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 🌐 rota
app.get('/', (req, res) => {
  res.send("🔥 SellForge Online");
});

// 🧠 utilidades
const delay = (ms) => new Promise(res => setTimeout(res, ms));
const userCooldown = new Map();

function diasParaMs(dias) {
  return dias * 24 * 60 * 60 * 1000;
}

// =============================
// 🚀 START
// =============================
bot.onText(/\/start$/, async (msg) => {
  const userId = String(msg.from.id);

  await bot.sendPhoto(msg.chat.id, "https://i.postimg.cc/Y9FHz03z/logo.jpg", {
    caption: `🔥 *SELLFORGE BOT*

👑 Dono: FAELZIN
📞 WhatsApp: 51981528372
⚙ Tipo: Aluguel
📅 Validade: 01/12/2026`,
    parse_mode: "Markdown"
  });

  await bot.sendMessage(msg.chat.id, "⏳ Carregando sistema...");
  await delay(4000);

  await bot.sendMessage(msg.chat.id,
`🚀 *BEM-VINDO AO SELLFORGE*

Transforme seu celular em uma máquina automática de vendas.

🔥 Venda 24h
🔥 Automação completa
🔥 Sem esforço manual

💰 Comece hoje e lucre com facilidade.`,
{ parse_mode: "Markdown" });

  await delay(4000);

  // ADMIN
  if (userId === ADMIN_ID) {
    return bot.sendMessage(msg.chat.id,
`👑 *PAINEL ADMIN*

/addproduto
/produtos
/ativar 7
/status
/listarusers
/meulink`,
{ parse_mode: "Markdown" });
  }

  // vendedor
  const produtos = await db.collection('produtos').doc(userId).collection('itens').get();

  if (!produtos.empty) {
    return bot.sendMessage(msg.chat.id,
`💼 *PAINEL VENDEDOR*

/addproduto
/produtos
/meulink
/status`,
{ parse_mode: "Markdown" });
  }

  // usuário
  bot.sendMessage(msg.chat.id,
`👤 *MENU*

Use um link de vendedor para ver produtos.`);
});

// =============================
// 🔗 START COM REF
// =============================
bot.onText(/\/start (.+)/, async (msg, match) => {
  const vendedorId = match[1];

  const produtosSnap = await db.collection('produtos')
    .doc(vendedorId)
    .collection('itens')
    .get();

  if (produtosSnap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Nenhum produto.");
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
// 🛍️ ADD PRODUTO
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
// 🔗 LINK
// =============================
bot.onText(/\/meulink/, (msg) => {
  const userId = msg.from.id;

  bot.sendMessage(msg.chat.id,
`🔗 Seu link:
https://t.me/SellForge_bot?start=${userId}`);
});

// =============================
// ⏳ ATIVAR
// =============================
bot.onText(/\/ativar (.+)/, async (msg, match) => {
  const userId = String(msg.from.id);
  const dias = parseInt(match[1]);

  if (isNaN(dias)) return;

  await db.collection('users').doc(userId).set({
    expiraEm: Date.now() + diasParaMs(dias)
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "✅ Ativado");
});

// =============================
// 📊 STATUS
// =============================
bot.onText(/\/status/, async (msg) => {
  const userId = String(msg.from.id);

  const doc = await db.collection('users').doc(userId).get();

  if (!doc.exists || !doc.data().expiraEm) {
    return bot.sendMessage(msg.chat.id, "❌ Sem plano");
  }

  const restante = doc.data().expiraEm - Date.now();

  if (restante <= 0) {
    return bot.sendMessage(msg.chat.id, "❌ Expirado");
  }

  bot.sendMessage(msg.chat.id, "⏳ Plano ativo");
});

// =============================
// 👑 ADMIN LIST USERS
// =============================
bot.onText(/\/listarusers/, async (msg) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const snap = await db.collection('users').get();

  bot.sendMessage(msg.chat.id, `👥 Total: ${snap.size}`);
});

// =============================
// 💾 MESSAGE
// =============================
bot.on('message', async (msg) => {
  try {
    if (!msg.from) return;

    const userId = String(msg.from.id);

    const now = Date.now();
    if (userCooldown.has(userId) && now - userCooldown.get(userId) < 2000) return;
    userCooldown.set(userId, now);

    // salvar usuário
    await db.collection('users').doc(userId).set({
      id: userId,
      nome: msg.from.first_name || "User",
      updatedAt: new Date()
    }, { merge: true });

    // cadastrar produto
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

      bot.sendMessage(msg.chat.id, "✅ Produto cadastrado!");
    }

  } catch (err) {
    console.log(err);
  }
});

// 🚀 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando...");
});
