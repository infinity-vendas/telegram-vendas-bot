const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

// ================= CONFIG =================
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 🔥 SUA CHAVE PIX (email, CPF, aleatória, etc)
const CHAVE_PIX = "infinitycliente.pay.oficial";

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

// ================= WEBHOOK =================
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

  const TEXTO = `
🚀 Bem-vindo à INFINITY CLIENTES

Sistema de vendas via PIX manual.

📌 Como funciona:
1. Escolha um produto
2. Faça o pagamento via PIX
3. Envie "paguei"
4. Aguarde liberação automática pelo admin
`;

  bot.sendMessage(msg.chat.id, TEXTO);
  setTimeout(() => {
    bot.sendMessage(msg.chat.id, menuUser());
  }, 1500);
});

// ================= MENU =================
function menuUser() {
  return `
📦 MENU

/produtos
/id
/status
/admin
`;
}

// ================= COMANDOS =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 Seu ID: ${msg.from.id}`);
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ BOT ONLINE (modo manual)");
});

bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙️ ADMIN

/adicionar
/pedidos
/liberar ID_PEDIDO
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
📦 ${p.nome}
💰 R$ ${p.valor}
📦 Estoque: ${p.estoque}

🆔 ID Produto: ${doc.id}

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

  // salva pedido automático
  const pedidoRef = await db.collection("pedidos").add({
    userId,
    produtoId,
    nomeProduto: p.nome,
    valor: p.valor,
    status: "pendente",
    criadoEm: Date.now()
  });

  bot.sendMessage(msg.chat.id, `
💰 PAGAMENTO PIX

📦 Produto: ${p.nome}
💰 Valor: R$ ${p.valor}

🔑 Chave PIX:
${CHAVE_PIX}

📩 Após pagar, envie:
👉 paguei

🧾 ID do Pedido:
${pedidoRef.id}
`);
});

// ================= PAGUEI =================
bot.onText(/paguei/i, async (msg) => {

  bot.sendMessage(msg.chat.id, `
⏳ Recebido!

Seu pagamento será verificado e liberado em breve.
`);
});

// ================= VER PEDIDOS =================
bot.onText(/\/pedidos/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("pedidos")
    .where("status", "==", "pendente")
    .get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "✅ Nenhum pedido pendente.");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `
🧾 Pedido: ${doc.id}

👤 Cliente: ${p.userId}
📦 Produto: ${p.nomeProduto}
💰 Valor: R$ ${p.valor}

👉 /liberar ${doc.id}
`);
  });
});

// ================= LIBERAR =================
bot.onText(/\/liberar (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const pedidoId = match[1];

  const pedidoRef = db.collection("pedidos").doc(pedidoId);
  const pedidoDoc = await pedidoRef.get();

  if (!pedidoDoc.exists) {
    return bot.sendMessage(msg.chat.id, "❌ Pedido não encontrado.");
  }

  const pedido = pedidoDoc.data();

  const produtoRef = db.collection("produtos").doc(pedido.produtoId);
  const produtoDoc = await produtoRef.get();

  if (!produtoDoc.exists) {
    return bot.sendMessage(msg.chat.id, "❌ Produto não encontrado.");
  }

  const produto = produtoDoc.data();

  // baixa estoque
  await produtoRef.update({
    estoque: Math.max(0, Number(produto.estoque) - 1)
  });

  // marca como entregue
  await pedidoRef.update({
    status: "entregue"
  });

  // entrega produto
  bot.sendMessage(pedido.userId, `
✅ PAGAMENTO CONFIRMADO!

📦 Produto: ${produto.nome}

🔗 Acesse:
${produto.link}
`);

  bot.sendMessage(msg.chat.id, "✅ Produto liberado com sucesso!");
});

// ================= CADASTRO =================
const adminState = {};

bot.onText(/\/adicionar/, (msg) => {
  if (!isAdmin(msg.from.id)) return;

  adminState[msg.from.id] = { step: "produto" };
  bot.sendMessage(msg.chat.id, "Nome do produto:");
});

bot.on("message", async (msg) => {

  const id = msg.from.id;
  const s = adminState[id];

  if (!s || !isAdmin(id)) return;

  const t = msg.text;

  if (s.step === "produto") {
    s.nome = t;
    s.step = "valor";
    return bot.sendMessage(id, "Valor:");
  }

  if (s.step === "valor") {
    s.valor = t;
    s.step = "estoque";
    return bot.sendMessage(id, "Estoque:");
  }

  if (s.step === "estoque") {
    s.estoque = t;
    s.step = "link";
    return bot.sendMessage(id, "Link do produto:");
  }

  if (s.step === "link") {

    await db.collection("produtos").add({
      nome: s.nome,
      valor: Number(String(s.valor).replace(",", ".")),
      estoque: Number(s.estoque),
      link: t,
      criadoEm: Date.now()
    });

    delete adminState[id];

    bot.sendMessage(id, "✅ Produto cadastrado!");
  }
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT MANUAL ONLINE (100% FUNCIONANDO)");
});
