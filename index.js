const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const ADMINS = ["6863505946"];

const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();

app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ================= IDENTIDADE =================
const OWNER = "INFINITY CLIENTE";
const BOT_VERSION = "v1";

// ================= WHATSAPP =================
const WHATSAPP_NUMBER = "5551981528372";

// ================= PIX =================
const PIX_KEY = "51981528372";

// ================= CONTROLES =================
const deleteConfirm = {};
const addStep = {};
const addData = {};

// ================= START =================
const START_TEXT = `⚡Dono: INFINITY CLIENTE
✍️Validity: 25.04.2026 - 23:50
🔔Created by: @Infity_cliente_oficial
🌠Parcerias: nenhuma
👀vendedores (1) admin
🎁divulgadores: nenhum
🔥Instagram: disponível
📢YouTube: em breve
💻TikTok: indisponível
⚠️Kwai: indisponível
❌patrocinadores: nenhum

💵Pix / cartão: em breve!
🔐Transações seguras e manuais

🤝 Unidos venceremos !`;

const MENU_TEXT = `⬛⬛⬛ INFINITY STORE ⬛⬛⬛

━━━━━━━━━━━━━━━━━━

💎 SISTEMA ATIVO

⚡ /produtos
⚡ /addproduto
⚡ /deletarprodutos
⚡ /status

━━━━━━━━━━━━━━━━━━`;

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  bot.sendMessage(chatId, START_TEXT);

  setTimeout(() => {
    bot.sendMessage(chatId, MENU_TEXT);
  }, 4000);
});

// ================= PRODUTOS (LISTA CAMADAS) =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "⚡ Nenhum produto disponível");
  }

  let buttons = [];

  snap.forEach((d) => {
    const p = d.data();

    buttons.push([
      {
        text: `⚡ ${p.nome}`,
        callback_data: `produto_${d.id}`
      }
    ]);
  });

  bot.sendMessage(msg.chat.id,
`⚡ SELECIONE UM PRODUTO`,
{
  reply_markup: {
    inline_keyboard: buttons
  }
});
});

// ================= DETALHE PRODUTO + WHATSAPP =================
bot.on("callback_query", async (query) => {

  const data = query.data;
  const chatId = query.message.chat.id;

  if (data.startsWith("produto_")) {

    const id = data.split("_")[1];
    const doc = await db.collection("produtos").doc(id).get();

    if (!doc.exists) {
      return bot.sendMessage(chatId, "⚡ Produto não encontrado");
    }

    const p = doc.data();

    const whatsappMsg = encodeURIComponent(
`Olá! Quero adquirir:

📦 Produto: ${p.nome}
💰 Valor: R$ ${p.valor}
`
    );

    return bot.sendMessage(chatId,
`⚡ PRODUTO SELECIONADO

📦 Produto: ${p.nome}
💰 Valor: R$ ${p.valor}
🔐 PIX: ${PIX_KEY}

━━━━━━━━━━━━━━

📩 Envie comprovante após pagamento`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "🛒 Adquirir agora",
          url: `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`
        }
      ]
    ]
  }
});
  }
});

// ================= ADD PRODUTO (10 CAMPOS) =================
bot.onText(/\/addproduto/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "⚡ Sem permissão");
  }

  addStep[msg.from.id] = "nome";
  addData[msg.from.id] = {};

  bot.sendMessage(msg.chat.id, "⚡ Nome do produto:");
});

bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;
  if (!addStep[id]) return;

  const step = addStep[id];

  if (step === "nome") {
    addData[id].nome = text;
    addStep[id] = "valor";
    return bot.sendMessage(msg.chat.id, "⚡ Valor:");
  }

  if (step === "valor") {
    addData[id].valor = text;
    addStep[id] = "descricao";
    return bot.sendMessage(msg.chat.id, "⚡ Descrição:");
  }

  if (step === "descricao") {
    addData[id].descricao = text;
    addStep[id] = "tipo";
    return bot.sendMessage(msg.chat.id, "⚡ Tipo:");
  }

  if (step === "tipo") {
    addData[id].tipo = text;
    addStep[id] = "plano";
    return bot.sendMessage(msg.chat.id, "⚡ Plano:");
  }

  if (step === "plano") {
    addData[id].plano = text;
    addStep[id] = "estoque";
    return bot.sendMessage(msg.chat.id, "⚡ Estoque:");
  }

  if (step === "estoque") {
    addData[id].estoque = text;
    addStep[id] = "cupom";
    return bot.sendMessage(msg.chat.id, "⚡ Cupom:");
  }

  if (step === "cupom") {
    addData[id].cupom = text;
    addStep[id] = "produtoId";
    return bot.sendMessage(msg.chat.id, "⚡ Produto ID:");
  }

  if (step === "produtoId") {
    addData[id].produtoId = text;
    addStep[id] = "instagram";
    return bot.sendMessage(msg.chat.id, "⚡ Instagram:");
  }

  if (step === "instagram") {
    addData[id].instagram = text;
    addStep[id] = "whatsapp";
    return bot.sendMessage(msg.chat.id, "⚡ WhatsApp:");
  }

  if (step === "whatsapp") {

    addData[id].whatsapp = text;

    await db.collection("produtos").add(addData[id]);

    delete addStep[id];
    delete addData[id];

    return bot.sendMessage(msg.chat.id, "⚡ Produto cadastrado com sucesso!");
  }

  // ================= DELETE CONFIRM =================
  if (deleteConfirm[id]) {

    if (text == deleteConfirm[id]) {

      const snap = await db.collection("produtos").get();
      const batch = db.batch();

      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      delete deleteConfirm[id];

      return bot.sendMessage(msg.chat.id, "⚡ Produtos deletados com sucesso!");
    }

    return bot.sendMessage(msg.chat.id, "⚡ Código inválido");
  }
});

// ================= DELETE PRODUTOS =================
bot.onText(/\/deletarprodutos/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "⚡ Sem permissão");
  }

  const code = Math.floor(10000 + Math.random() * 90000);

  deleteConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id,
`⚠️ CONFIRMAÇÃO NECESSÁRIA

Código: ${code}

Digite para confirmar exclusão`);
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
`⚡ Bot online
⚡ DEV: ${OWNER}
⚡ versão: ${BOT_VERSION}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("⚡ BOT COMPLETO ATUALIZADO ONLINE");
});
