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

// ================= CONFIG =================
const OWNER = "INFINITY CLIENTE";
const BOT_VERSION = "v1";

const WHATSAPP_NUMBER = "5551981528372";
const PIX_KEY = "51981528372";

// ================= MEMORY CONTROL =================
const cadastroStep = {};
const cadastroData = {};

const addStep = {};
const addData = {};

const deleteProductsConfirm = {};
const deleteUsersConfirm = {};

// ================= PLANOS =================
const PLANOS = {
  "1day": 1, "2day": 2, "3day": 3,
  "4day": 4, "5day": 5, "6day": 6,
  "7day": 7, "14day": 14,
  "21day": 21, "30day": 30
};

// ================= TEXTOS =================
const START_TEXT = `
Dono: INFINITY CLIENTE
Validity: 99.99.9999
Created by: @Infity_cliente_oficial
Parcerias: nenhuma
vendedores (1) admin
divulgadores: nenhum
Facebook: indisponível
Instagram: disponível
YouTube: Em Breve
TikTok: indisponível
Kwai: indisponível
patrocinadores: nenhum

Aceitamos pagamento Pix / cartão: em breve!
Transições 100% manual e seguras

Unidos, fortes venceremos!
`;

const MENU_TEXT = `
INFINITY STORE

/produtos
/addprodutos
/deletarprodutos
/deletarusuarios
/status
/id
`;

// ================= FIREBASE CHECK =================
async function isBlocked(userId, chatId) {

  const doc = await db.collection("users").doc(String(userId)).get();

  if (!doc.exists) {
    bot.sendMessage(chatId, "⛔ Você precisa se cadastrar usando /start");
    return true;
  }

  return false;
}

// ================= PLANO CHECK =================
async function checkAcesso(userId, chatId) {

  const doc = await db.collection("alugueis").doc(String(userId)).get();

  if (!doc.exists || !doc.data().ativo) {
    bot.sendMessage(chatId, "Sem plano ativo.");
    return false;
  }

  if (Date.now() > doc.data().expiraEm) {

    await db.collection("alugueis").doc(String(userId)).update({
      ativo: false
    });

    bot.sendMessage(chatId, "Plano expirado.");
    return false;
  }

  return true;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);

  const doc = await db.collection("users").doc(id).get();

  if (doc.exists) {

    const ok = await checkAcesso(id, msg.chat.id);
    if (!ok) return;

    bot.sendMessage(msg.chat.id, START_TEXT);
    setTimeout(() => bot.sendMessage(msg.chat.id, MENU_TEXT), 5000);

    return;
  }

  cadastroStep[id] = "nome";
  cadastroData[id] = {};

  bot.sendMessage(msg.chat.id,
`SEU ID: ${id}

Digite seu nome:`);
});

// ================= MESSAGE CENTRAL =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;

  if (!text) return;

  // ignora comandos
  if (text.startsWith("/")) return;

  // ===== CADASTRO =====
  if (cadastroStep[id]) {

    if (cadastroStep[id] === "nome") {
      cadastroData[id].nome = text;
      cadastroStep[id] = "whatsapp";
      return bot.sendMessage(msg.chat.id, "Digite seu WhatsApp:");
    }

    if (cadastroStep[id] === "whatsapp") {
      cadastroData[id].whatsapp = text;
      cadastroStep[id] = "confirm";
      return bot.sendMessage(msg.chat.id, `Confirme seu ID:\n${id}`);
    }

    if (cadastroStep[id] === "confirm") {

      if (text !== id) {
        return bot.sendMessage(msg.chat.id, "ID incorreto.");
      }

      await db.collection("users").doc(id).set({
        nome: cadastroData[id].nome,
        whatsapp: cadastroData[id].whatsapp,
        userId: id,
        username: msg.from.username || "sem_username",
        criadoEm: Date.now()
      });

      delete cadastroStep[id];
      delete cadastroData[id];

      bot.sendMessage(msg.chat.id, "Cadastro concluído.");
      setTimeout(() => bot.sendMessage(msg.chat.id, START_TEXT), 2000);
      setTimeout(() => bot.sendMessage(msg.chat.id, MENU_TEXT), 5000);
    }
  }

  // ===== ADD PRODUTO =====
  if (addStep[id]) {

    if (addStep[id] === "nome") {
      addData[id].nome = text;
      addStep[id] = "valor";
      return bot.sendMessage(msg.chat.id, "Valor:");
    }

    if (addStep[id] === "valor") {
      addData[id].valor = text;
      addStep[id] = "descricao";
      return bot.sendMessage(msg.chat.id, "Descrição:");
    }

    if (addStep[id] === "descricao") {

      addData[id].descricao = text;

      await db.collection("produtos").add(addData[id]);

      delete addStep[id];
      delete addData[id];

      return bot.sendMessage(msg.chat.id, "Produto cadastrado.");
    }
  }

  // ===== DELETE PRODUTOS CONFIRM =====
  if (deleteProductsConfirm[id]) {

    if (text == deleteProductsConfirm[id]) {

      const snap = await db.collection("produtos").get();
      const batch = db.batch();

      snap.forEach(doc => batch.delete(doc.ref));

      await batch.commit();

      delete deleteProductsConfirm[id];

      return bot.sendMessage(msg.chat.id, "✔ Produtos deletados.");
    }

    return bot.sendMessage(msg.chat.id, "❌ Código inválido.");
  }

  // ===== DELETE USERS CONFIRM =====
  if (deleteUsersConfirm[id]) {

    if (text == deleteUsersConfirm[id]) {

      const snap = await db.collection("users").get();
      const batch = db.batch();

      snap.forEach(doc => batch.delete(doc.ref));

      await batch.commit();

      delete deleteUsersConfirm[id];

      return bot.sendMessage(msg.chat.id, "✔ Usuários deletados.");
    }

    return bot.sendMessage(msg.chat.id, "❌ Código inválido.");
  }

  // ===== BLOQUEIO GLOBAL =====
  const doc = await db.collection("users").doc(id).get();

  if (!doc.exists) {
    return bot.sendMessage(msg.chat.id, "Use /start para se cadastrar.");
  }
});

// ================= ID =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id,
`ID: ${msg.from.id}
User: @${msg.from.username || "nenhum"}`);
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const block = await isBlocked(msg.from.id, msg.chat.id);
  if (block) return;

  const ok = await checkAcesso(msg.from.id, msg.chat.id);
  if (!ok) return;

  const snap = await db.collection("produtos").get();

  let buttons = [];

  snap.forEach(d => {
    const p = d.data();

    buttons.push([{
      text: p.nome,
      callback_data: `produto_${d.id}`
    }]);
  });

  bot.sendMessage(msg.chat.id, "Selecione:", {
    reply_markup: { inline_keyboard: buttons }
  });
});

// ================= DELETE PRODUTOS =================
bot.onText(/\/deletarprodutos/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const code = Math.floor(100000 + Math.random() * 900000);
  deleteProductsConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id,
`⚠️ Confirmação necessária

Código: ${code}`);
});

// ================= DELETE USERS =================
bot.onText(/\/deletarusuarios/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const code = Math.floor(100000 + Math.random() * 900000);
  deleteUsersConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id,
`⚠️ APAGAR TODOS USUÁRIOS

Código: ${code}`);
});

// ================= ADD PRODUTO =================
bot.onText(/\/addprodutos/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  addStep[msg.from.id] = "nome";
  addData[msg.from.id] = {};

  bot.sendMessage(msg.chat.id, "Nome do produto:");
});

// ================= LIBERAR PLANO =================
bot.onText(/\/liberar (.+) (.+)/, async (msg, match) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const userId = match[1];
  const plano = match[2];

  const dias = PLANOS[plano];
  const expira = Date.now() + dias * 86400000;

  await db.collection("alugueis").doc(userId).set({
    ativo: true,
    plano,
    expiraEm: expira
  });

  bot.sendMessage(msg.chat.id, "Plano liberado");
});

// ================= STATUS =================
bot.onText(/\/status/, async (msg) => {

  const block = await isBlocked(msg.from.id, msg.chat.id);
  if (block) return;

  const ok = await checkAcesso(msg.from.id, msg.chat.id);
  if (!ok) return;

  bot.sendMessage(msg.chat.id,
`Bot online
${OWNER}
versão ${BOT_VERSION}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("BOT FINAL BLINDADO 🚀");
});
