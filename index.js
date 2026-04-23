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

  await bot.sendPhoto(chatId, "https://i.postimg.cc/cJktrZVw/logo.jpg");

  const TEXTO = `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!

Aqui você encontra um ambiente totalmente estruturado para facilitar sua experiência, com atendimento rápido, organizado e focado em entregar o melhor resultado possível para cada cliente. Nosso compromisso é com a transparência, a segurança e a satisfação de quem confia no nosso trabalho.

Na INFINITY CLIENTES você não perde tempo. Tudo foi pensado para ser simples, direto e eficiente. Desde o primeiro acesso, você já sente a diferença: um sistema automatizado, informações claras e suporte preparado para te atender sempre que precisar.

Trabalhamos diariamente para manter um padrão de qualidade elevado, oferecendo um espaço confiável onde clientes e vendedores podem interagir com tranquilidade. Aqui, cada detalhe importa, e cada cliente é tratado com atenção e respeito.

Se você está chegando agora, seja muito bem-vindo!

INFINITY CLIENTES – confiança, organização e resultado em um só lugar
`;

  setTimeout(() => bot.sendMessage(chatId, TEXTO), 2000);

  setTimeout(() => {
    bot.sendMessage(chatId, "🔐 Acesso:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔐 Logar", callback_data: "login" }],
          [{ text: "🆕 Criar conta", callback_data: "criar" }]
        ]
      }
    });
  }, 5000);
});

// ================= LOGIN =================
const userState = {};

bot.on("callback_query", async (query) => {

  const id = query.from.id;

  if (query.data === "criar") {
    userState[id] = { step: "nome" };
    return bot.sendMessage(id, "Digite seu nome:");
  }

  if (query.data === "login") {
    userState[id] = { step: "login" };
    return bot.sendMessage(id, "Digite seu nome cadastrado:");
  }
});

// ================= MENSAGENS =================
bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  const s = userState[id];

  if (s) {

    if (s.step === "nome") {
      s.nome = text;
      s.step = "whatsapp";
      return bot.sendMessage(id, "Digite seu WhatsApp:");
    }

    if (s.step === "whatsapp") {

      await db.collection("usuarios").doc(String(id)).set({
        nome: s.nome,
        whatsapp: text,
        criadoEm: Date.now()
      });

      delete userState[id];

      bot.sendMessage(id, "✅ Conta criada!");
      return menuPrincipal(id);
    }

    if (s.step === "login") {

      const doc = await db.collection("usuarios").doc(String(id)).get();

      if (!doc.exists) {
        return bot.sendMessage(id, "❌ Conta não encontrada.");
      }

      delete userState[id];

      bot.sendMessage(id, "✅ Login realizado!");
      return menuPrincipal(id);
    }
  }

  // ================= ADMIN FLOW =================
  const adminFlow = adminState[id];

  if (adminFlow && isAdmin(id)) {

    if (adminFlow.step === "vendedor") {
      adminFlow.vendedor = text;
      adminFlow.step = "produto";
      return bot.sendMessage(id, "Produto:");
    }

    if (adminFlow.step === "produto") {
      adminFlow.produto = text;
      adminFlow.step = "valor";
      return bot.sendMessage(id, "Valor:");
    }

    if (adminFlow.step === "valor") {
      adminFlow.valor = Number(String(text).replace(",", "."));
      adminFlow.step = "descricao";
      return bot.sendMessage(id, "Descrição:");
    }

    if (adminFlow.step === "descricao") {
      adminFlow.descricao = text;
      adminFlow.step = "whatsapp";
      return bot.sendMessage(id, "WhatsApp:");
    }

    if (adminFlow.step === "whatsapp") {
      adminFlow.whatsapp = text;
      adminFlow.step = "link";
      return bot.sendMessage(id, "Link:");
    }

    if (adminFlow.step === "link") {

      await db.collection("produtos").add({
        vendedor: adminFlow.vendedor,
        produto: adminFlow.produto,
        valor: adminFlow.valor,
        descricao: adminFlow.descricao,
        whatsapp: adminFlow.whatsapp,
        link: text,
        criadoEm: Date.now()
      });

      delete adminState[id];

      return bot.sendMessage(id, "✅ Produto cadastrado!");
    }
  }
});

// ================= MENU =================
function menuPrincipal(chatId) {
  setTimeout(() => {
    bot.sendMessage(chatId, `
📦 MENU PRINCIPAL

/produtos
/id
/suporte
/admin_contato
`);
  }, 2000);
}

// ================= COMANDOS =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 ID: ${msg.from.id}`);
});

bot.onText(/\/admin_contato/, (msg) => {
  bot.sendMessage(msg.chat.id, `📞 WhatsApp: 51981528372`);
});

bot.onText(/\/suporte/, (msg) => {
  bot.sendMessage(msg.chat.id, "📲 Suporte:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Abrir WhatsApp", url: WHATSAPP }]
      ]
    }
  });
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Nenhum produto.");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `
📦 ${p.produto}
💰 R$ ${p.valor}

🆔 ID PRODUTO: ${doc.id}

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

📦 ${p.produto}
💰 R$ ${p.valor}

🔑 ${CHAVE_PIX}

👤 Vendedor: ${p.vendedor}

📲 Envie comprovante:
`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "WhatsApp", url: WHATSAPP }]
      ]
    }
  });
});

// ================= ADMIN =================
const adminState = {};

bot.onText(/\/admin/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙️ ADMIN

/adicionar_produto
/deletar_tudo
/listar_usuarios
/listar_produtos
/liberar ID_USER ID_PRODUTO
`);
});

// ================= EXTRA ADMIN =================
bot.onText(/\/listar_produtos/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("produtos").get();

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `
📦 ${p.produto}
🆔 ${doc.id}
`);
  });
});

bot.onText(/\/listar_usuarios/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("usuarios").get();

  snap.forEach(doc => {
    const u = doc.data();

    bot.sendMessage(msg.chat.id, `
👤 ${u.nome}
📱 ${u.whatsapp}
🆔 ${doc.id}
`);
  });
});

// ================= LIBERAR (CORRIGIDO) =================
bot.onText(/\/liberar (.+) (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const userId = String(match[1]);
  const produtoId = match[2];

  try {

    const doc = await db.collection("produtos").doc(produtoId).get();

    if (!doc.exists) {
      return bot.sendMessage(msg.chat.id, "❌ Produto não encontrado.");
    }

    const p = doc.data();

    await bot.sendMessage(userId, `
✅ PAGAMENTO CONFIRMADO!

📦 ${p.produto}

🔗 ${p.link}
`);

    bot.sendMessage(msg.chat.id, "✅ Produto entregue!");

  } catch (err) {
    bot.sendMessage(msg.chat.id, "❌ Erro ao liberar.");
  }
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT 100% FUNCIONANDO");
});
