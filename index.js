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
Bem-vindo à INFINITY CLIENTES 🚀

Sistema de vendas via PIX manual.

Após pagar, envie comprovante no WhatsApp.
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
  }, 4000);
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

// ================= MESSAGE =================
const adminState = {};

bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  // ================= USER FLOW =================
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
  const a = adminState[id];

  if (a && isAdmin(id)) {

    if (a.step === "produto") {
      a.nome = text;
      a.step = "valor";
      return bot.sendMessage(id, "Valor:");
    }

    if (a.step === "valor") {
      a.valor = Number(String(text).replace(",", "."));
      a.step = "link";
      return bot.sendMessage(id, "Link:");
    }

    if (a.step === "link") {

      await db.collection("produtos").add({
        nome: a.nome,
        valor: a.valor,
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
  bot.sendMessage(chatId, `
📦 MENU

/produtos
/id
/suporte
`);
}

// ================= COMANDOS =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 ${msg.from.id}`);
});

bot.onText(/\/suporte/, (msg) => {
  bot.sendMessage(msg.chat.id, "📲 Enviar comprovante:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "WhatsApp", url: WHATSAPP }]
      ]
    }
  });
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
📦 ${p.nome}
💰 R$ ${p.valor}

🆔 ID: ${doc.id}

👉 /comprar_${doc.id}
`);
  });
});

// ================= COMPRA =================
bot.onText(/\/comprar_(.+)/, async (msg, match) => {

  const produtoId = match[1];
  const userId = String(msg.from.id);

  const doc = await db.collection("produtos").doc(produtoId).get();
  if (!doc.exists) return;

  const p = doc.data();

  // salva pedido
  const pedido = await db.collection("pedidos").add({
    userId,
    produtoId,
    status: "pendente",
    criadoEm: Date.now()
  });

  bot.sendMessage(msg.chat.id, `
💰 PAGAMENTO PIX

📦 ${p.nome}
💰 R$ ${p.valor}

🔑 ${CHAVE_PIX}

📲 Envie comprovante no WhatsApp

🧾 ID DO PEDIDO:
${pedido.id}
`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Enviar comprovante", url: WHATSAPP }]
      ]
    }
  });
});

// ================= ADMIN =================
bot.onText(/\/admin/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙️ ADMIN

/adicionar
/pedidos
/liberar ID_PEDIDO
/deletar_produtos
`);
});

// ================= VER PEDIDOS =================
bot.onText(/\/pedidos/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("pedidos")
    .where("status", "==", "pendente")
    .get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "✅ Sem pedidos.");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `
🧾 ${doc.id}
👤 ${p.userId}
📦 ${p.produtoId}

👉 /liberar ${doc.id}
`);
  });
});

// ================= LIBERAR =================
bot.onText(/\/liberar (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const pedidoId = match[1];

  const ref = db.collection("pedidos").doc(pedidoId);
  const pedidoDoc = await ref.get();

  if (!pedidoDoc.exists) {
    return bot.sendMessage(msg.chat.id, "❌ Pedido não encontrado.");
  }

  const pedido = pedidoDoc.data();

  const produtoDoc = await db.collection("produtos")
    .doc(pedido.produtoId).get();

  const produto = produtoDoc.data();

  await ref.update({ status: "entregue" });

  bot.sendMessage(pedido.userId, `
✅ PAGAMENTO CONFIRMADO!

📦 ${produto.nome}

🔗 ${produto.link}
`);

  bot.sendMessage(msg.chat.id, "✅ Liberado!");
});

// ================= ADICIONAR =================
bot.onText(/\/adicionar/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  adminState[msg.from.id] = { step: "produto" };
  bot.sendMessage(msg.chat.id, "Produto:");
});

// ================= DELETAR =================
bot.onText(/\/deletar_produtos/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("produtos").get();
  snap.forEach(doc => doc.ref.delete());

  bot.sendMessage(msg.chat.id, "🗑️ Produtos deletados.");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT MANUAL ONLINE");
});
