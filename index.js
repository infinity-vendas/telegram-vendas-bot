require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// 🔐 CONFIG
const ADMIN_ID = "6863505946";

// 🎨 VISUAL
const topo = `╔════════ SELLFORGE ════════╗`;
const linha = `━━━━━━━━━━━━━━━━━━━━`;
const rodape = `╚═══════════════════════════╝`;

// 👨‍💼 VENDEDORES INFO
const vendedoresAutorizados = [
  { nome: "Alyson", numero: "+55 35 91002-9714", cargo: "Vendedor" },
  { nome: "Nexus", numero: "+55 67 9624-4153", cargo: "Gerente" },
  { nome: "Bruno", numero: "+55 22 97406-2633", cargo: "Vendedor" },
  { nome: "Faelzin", numero: "+55 51981528372", cargo: "Líder Administrador" }
];

// 🔥 Firebase
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

app.get('/', (req, res) => res.send("🔥 SellForge Online"));

// 🧠 UTILS
const delay = (ms) => new Promise(res => setTimeout(res, ms));
const userCooldown = new Map();

// =============================
// 🎮 MENU BOTÕES
// =============================
function menuButtons(tipo, userId) {

  if (tipo === "admin") {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📦 Produtos", callback_data: "produtos" }],
          [{ text: "➕ Add Produto", callback_data: "addproduto" }],
          [{ text: "📊 Status", callback_data: "status" }],
          [{ text: "👥 Usuários", callback_data: "users" }],
          [{ text: "👨‍💼 Vendedores", callback_data: "vendedores" }],
          [{ text: "🆔 Meu ID", callback_data: "id" }]
        ]
      }
    };
  }

  if (tipo === "vendedor") {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📦 Meus Produtos", callback_data: "produtos" }],
          [{ text: "➕ Adicionar", callback_data: "addproduto" }],
          [{ text: "🔗 Meu Link", callback_data: "link" }],
          [{ text: "📊 Status", callback_data: "status" }],
          [{ text: "🆔 Meu ID", callback_data: "id" }]
        ]
      }
    };
  }

  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍️ Ver Produtos", callback_data: "verprodutos" }],
        [{ text: "🆔 Meu ID", callback_data: "id" }]
      ]
    }
  };
}

// =============================
// 🚀 START
// =============================
bot.onText(/\/start$/, async (msg) => {
  const userId = String(msg.from.id);

  await bot.sendPhoto(msg.chat.id, "https://i.postimg.cc/Y9FHz03z/logo.jpg");

  await bot.sendMessage(msg.chat.id,
`${topo}

🔥 Bem-vindo ao sistema

${linha}

💰 Venda automática 24h
⚡ Sistema profissional ativo

${linha}

⏳ Carregando...`);

  await delay(2000);

  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  // 👑 ADMIN
  if (userId === ADMIN_ID) {
    return bot.sendMessage(msg.chat.id,
`${topo}

👑 PAINEL ADMIN

${linha}

Controle total do sistema

${rodape}`,
menuButtons("admin", userId));
  }

  // 💼 VENDEDOR APROVADO
  if (userData?.aprovado) {
    return bot.sendMessage(msg.chat.id,
`${topo}

💼 PAINEL VENDEDOR

${linha}

Conta liberada para vendas

${rodape}`,
menuButtons("vendedor", userId));
  }

  // 👤 USUÁRIO BLOQUEADO
  bot.sendMessage(msg.chat.id,
`${topo}

👤 MENU

${linha}

⛔ Você não foi aprovado para vender

Fale com o administrador

${rodape}`,
menuButtons("user", userId));
});

// =============================
// 🎮 BOTÕES
// =============================
bot.on('callback_query', async (query) => {
  const msg = query.message;
  const userId = String(query.from.id);
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  const userDoc = await db.collection('users').doc(userId).get();
  const aprovado = userDoc.data()?.aprovado;

  if (data === "id") {
    return bot.sendMessage(msg.chat.id,
`${topo}

🆔 SEU ID

${linha}

${userId}

${rodape}`);
  }

  if (data === "addproduto") {

    if (!aprovado) {
      return bot.sendMessage(msg.chat.id,
`${topo}

⛔ Acesso negado

${linha}

Aguardando aprovação

${rodape}`);
    }

    return bot.sendMessage(msg.chat.id,
`${topo}

Envie:
nome | preco | descricao | link

${rodape}`);
  }

  if (data === "produtos") {

    const snap = await db.collection('produtos')
      .doc(userId)
      .collection('itens')
      .get();

    if (snap.empty) {
      return bot.sendMessage(msg.chat.id,
`${topo}

❌ Nenhum produto

${rodape}`);
    }

    snap.forEach(doc => {
      const p = doc.data();

      bot.sendMessage(msg.chat.id,
`${topo}

🛍️ ${p.nome}

💰 ${p.preco}

${rodape}`);
    });
  }

  if (data === "link") {
    return bot.sendMessage(msg.chat.id,
`${topo}

🔗 Seu link

${linha}

https://t.me/SellForge_bot?start=${userId}

${rodape}`);
  }

  if (data === "status") {
    return bot.sendMessage(msg.chat.id,
`${topo}

📊 STATUS

${linha}

${aprovado ? "✅ Aprovado" : "⛔ Não aprovado"}

${rodape}`);
  }

  if (data === "users") {
    if (userId !== ADMIN_ID) return;

    const snap = await db.collection('users').get();

    return bot.sendMessage(msg.chat.id,
`${topo}

👥 ${snap.size} usuários

${rodape}`);
  }

  if (data === "vendedores") {
    let texto = `${topo}

👨‍💼 VENDEDORES

${linha}\n`;

    vendedoresAutorizados.forEach(v => {
      texto += `${v.nome} - ${v.cargo}\n`;
    });

    texto += rodape;

    return bot.sendMessage(msg.chat.id, texto);
  }
});

// =============================
// 🆔 ID
// =============================
bot.onText(/\/id/, (msg) => {
  const userId = msg.from.id;

  bot.sendMessage(msg.chat.id,
`${topo}

🆔 SEU ID

${linha}

${userId}

${rodape}`);
});

// =============================
// 👑 APROVAR
// =============================
bot.onText(/\/aprovar (.+)/, async (msg, match) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const uid = match[1];

  await db.collection('users').doc(uid).set({
    aprovado: true
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "✅ Usuário aprovado");
});

// =============================
// 🚫 BLOQUEAR
// =============================
bot.onText(/\/bloquear (.+)/, async (msg, match) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const uid = match[1];

  await db.collection('users').doc(uid).set({
    aprovado: false
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "🚫 Usuário bloqueado");
});

// =============================
// 💾 SALVAR + PRODUTO
// =============================
bot.on('message', async msg => {
  try {
    if (!msg.from) return;

    const id = String(msg.from.id);

    const now = Date.now();
    if (userCooldown.has(id) && now - userCooldown.get(id) < 2000) return;
    userCooldown.set(id, now);

    await db.collection('users').doc(id).set({
      id,
      nome: msg.from.first_name || "User"
    }, { merge: true });

    if (msg.text && msg.text.includes("|")) {

      const userDoc = await db.collection('users').doc(id).get();

      if (!userDoc.data()?.aprovado) {
        return bot.sendMessage(msg.chat.id, "⛔ Você não pode cadastrar produtos");
      }

      const [nome, preco, descricao, link] = msg.text.split("|");

      await db.collection('produtos')
        .doc(id)
        .collection('itens')
        .add({
          nome: nome.trim(),
          preco: preco.trim(),
          descricao: descricao.trim(),
          link: link.trim()
        });

      bot.sendMessage(msg.chat.id, "✅ Produto cadastrado");
    }

  } catch (err) {
    console.log(err);
  }
});

// 🚀 SERVER
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Rodando...");
});
