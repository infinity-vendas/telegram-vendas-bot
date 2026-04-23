const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

// ================= CONFIG =================
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const CHAVE_PIX = "Infinitycliente.pay.oficial@gmail.com";
const WHATSAPP = "https://wa.me/5551981528372";

const ADMINS = ["6863505946"];

// ================= FIREBASE =================
const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ================= BOT =================
const bot = new TelegramBot(TOKEN, { webHook: true });

const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ================= UTILS =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  // LOGO
  await bot.sendPhoto(chatId, "https://i.postimg.cc/cJktrZVw/logo.jpg");

  // TEXTO
  const TEXTO = `
Olá, sou atendente virtual autorizado INFINITY CLIENTES.

Somos uma empresa especializada em atendimentos online, rápido e seguro.

Caso tenha interesse em adquirir nossos produtos 100% qualidade e entregas rápidas, é necessário informar seu login de acesso.

Caso não tenha cadastro, clique em criar conta.
`;

  setTimeout(() => bot.sendMessage(chatId, TEXTO), 2000);

  setTimeout(() => {
    bot.sendMessage(chatId, "Informe seu acesso:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔐 Logar", callback_data: "login" }],
          [{ text: "🆕 Criar conta", callback_data: "criar" }]
        ]
      }
    });
  }, 5000);
});

// ================= LOGIN / CADASTRO =================
const userState = {};

bot.on("callback_query", async (query) => {

  const id = query.from.id;
  const data = query.data;

  if (data === "criar") {
    userState[id] = { step: "nome" };
    bot.sendMessage(id, "Digite seu nome:");
  }

  if (data === "login") {
    bot.sendMessage(id, "Digite seu nome cadastrado:");
    userState[id] = { step: "login_nome" };
  }
});

// ================= CAPTURA DADOS =================
bot.on("message", async (msg) => {

  const id = msg.from.id;
  const s = userState[id];

  if (!s) return;

  const t = msg.text;

  // CRIAR CONTA
  if (s.step === "nome") {
    s.nome = t;
    s.step = "whatsapp";
    return bot.sendMessage(id, "Digite seu WhatsApp:");
  }

  if (s.step === "whatsapp") {

    await db.collection("usuarios").doc(String(id)).set({
      nome: s.nome,
      whatsapp: t,
      criadoEm: Date.now()
    });

    delete userState[id];

    bot.sendMessage(id, "✅ Cadastro realizado!");
    return menuPrincipal(id);
  }

  // LOGIN
  if (s.step === "login_nome") {

    const doc = await db.collection("usuarios").doc(String(id)).get();

    if (!doc.exists) {
      return bot.sendMessage(id, "❌ Não encontrado. Crie uma conta.");
    }

    delete userState[id];

    bot.sendMessage(id, "✅ Login realizado!");
    return menuPrincipal(id);
  }
});

// ================= MENU =================
function menuPrincipal(chatId) {
  setTimeout(() => {
    bot.sendMessage(chatId, `
📦 MENU

/produtos
/id
/admin_contato
/admin
`);
  }, 3000);
}

// ================= COMANDOS =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 ID: ${msg.from.id}`);
});

bot.onText(/\/admin_contato/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📞 Contato Admin:
51981528372
`);
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Sem produtos.");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `
📦 ${p.produto}
💰 R$ ${p.valor}

🆔 ID: ${doc.id}

👉 /comprar_${doc.id}
`);
  });
});

// ================= COMPRA =================
bot.onText(/\/comprar_(.+)/, async (msg, match) => {

  const produtoId = match[1];

  const doc = await db.collection("produtos").doc(produtoId).get();
  if (!doc.exists) return;

  const p = doc.data();

  bot.sendMessage(msg.chat.id, `
💰 PAGAMENTO PIX

📦 Produto: ${p.produto}
💰 Valor: R$ ${p.valor}

🔑 Chave PIX:
${CHAVE_PIX}

👤 Vendedor: RAPHAEL DE MATOS

⚠️ Envie comprovante no WhatsApp:

`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📲 Falar no WhatsApp", url: WHATSAPP }]
      ]
    }
  });
});

// ================= ADMIN =================
bot.onText(/\/admin/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙️ ADMIN

/adicionar_produto
/deletar_tudo
/liberar ID_USER ID_PRODUTO
`);
});

// ================= ADICIONAR =================
const adminState = {};

bot.onText(/\/adicionar_produto/, (msg) => {
  if (!isAdmin(msg.from.id)) return;

  adminState[msg.from.id] = { step: "vendedor" };
  bot.sendMessage(msg.chat.id, "Vendedor:");
});

bot.on("message", async (msg) => {

  const id = msg.from.id;
  const s = adminState[id];

  if (!s || !isAdmin(id)) return;

  const t = msg.text;

  if (s.step === "vendedor") {
    s.vendedor = t;
    s.step = "produto";
    return bot.sendMessage(id, "Produto:");
  }

  if (s.step === "produto") {
    s.produto = t;
    s.step = "valor";
    return bot.sendMessage(id, "Valor:");
  }

  if (s.step === "valor") {
    s.valor = t;
    s.step = "descricao";
    return bot.sendMessage(id, "Descrição:");
  }

  if (s.step === "descricao") {
    s.descricao = t;
    s.step = "whatsapp";
    return bot.sendMessage(id, "WhatsApp:");
  }

  if (s.step === "whatsapp") {
    s.whatsapp = t;
    s.step = "link";
    return bot.sendMessage(id, "Link:");
  }

  if (s.step === "link") {

    await db.collection("produtos").add({
      vendedor: s.vendedor,
      produto: s.produto,
      valor: s.valor,
      descricao: s.descricao,
      whatsapp: s.whatsapp,
      link: t,
      criadoEm: Date.now()
    });

    delete adminState[id];

    bot.sendMessage(id, "✅ Produto cadastrado!");
  }
});

// ================= DELETAR =================
bot.onText(/\/deletar_tudo/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("produtos").get();

  snap.forEach(doc => doc.ref.delete());

  bot.sendMessage(msg.chat.id, "🗑️ Todos produtos deletados.");
});

// ================= LIBERAR =================
bot.onText(/\/liberar (.+) (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const userId = match[1];
  const produtoId = match[2];

  const doc = await db.collection("produtos").doc(produtoId).get();
  if (!doc.exists) return;

  const p = doc.data();

  bot.sendMessage(userId, `
✅ PAGAMENTO CONFIRMADO!

📦 Produto: ${p.produto}

🔗 Link:
${p.link}
`);

  bot.sendMessage(msg.chat.id, "✅ Produto liberado!");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT COMPLETO ONLINE");
});
