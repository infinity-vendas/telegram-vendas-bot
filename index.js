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
const bot = new TelegramBot(TOKEN);
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

// ================= MEMORY =================
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

// ================= LAYOUT =================
const START_TEXT = `
Dono: INFINITY CLIENTE
Validity: 25,00
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
¡compre somente comigo atualmente!

Unidos , fortes venceremos !
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

// ================= CHECK USER =================
async function checkCadastro(userId, chatId) {
  const doc = await db.collection("users").doc(String(userId)).get();

  if (!doc.exists) {
    cadastroStep[userId] = "nome";
    cadastroData[userId] = {};

    bot.sendMessage(chatId,
`🚀 CADASTRO OBRIGATÓRIO

Digite seu nome:`);
    return false;
  }

  return true;
}

// ================= CHECK PLANO =================
async function checkPlano(userId) {

  const doc = await db.collection("alugueis").doc(String(userId)).get();

  if (!doc.exists || !doc.data().ativo) return false;

  if (Date.now() > doc.data().expiraEm) {

    await db.collection("alugueis").doc(String(userId)).update({
      ativo: false
    });

    return false;
  }

  return true;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);

  const okCadastro = await checkCadastro(id, msg.chat.id);
  if (!okCadastro) return;

  const hasPlano = await checkPlano(id);

  bot.sendMessage(msg.chat.id, START_TEXT);

  setTimeout(() => {

    if (hasPlano) {
      bot.sendMessage(msg.chat.id, MENU_TEXT);
    } else {
      bot.sendMessage(msg.chat.id,
`⚠️ Você não possui plano ativo

Fale com o administrador para ativação.`);
    }

  }, 2000);
});

// ================= MESSAGE HANDLER =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;

  if (!text) return;
  if (text.startsWith("/")) return;

  // ================= CADASTRO =================
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
        return bot.sendMessage(msg.chat.id, "❌ ID incorreto.");
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

      bot.sendMessage(msg.chat.id, "✔ Cadastro concluído");

      setTimeout(() => bot.sendMessage(msg.chat.id, START_TEXT), 1500);
      setTimeout(() => bot.sendMessage(msg.chat.id, MENU_TEXT), 3000);
    }

    return;
  }

  // ================= ADD PRODUTO =================
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

      return bot.sendMessage(msg.chat.id, "✔ Produto adicionado");
    }

    return;
  }

  // ================= DELETE PRODUTOS =================
  if (deleteProductsConfirm[id]) {

    if (text === String(deleteProductsConfirm[id])) {

      const snap = await db.collection("produtos").get();
      const batch = db.batch();

      snap.forEach(d => batch.delete(d.ref));

      await batch.commit();

      delete deleteProductsConfirm[id];

      return bot.sendMessage(msg.chat.id, "✔ Produtos deletados");
    }

    return bot.sendMessage(msg.chat.id, "❌ Código inválido");
  }

  // ================= DELETE USERS =================
  if (deleteUsersConfirm[id]) {

    if (text === String(deleteUsersConfirm[id])) {

      const snap = await db.collection("users").get();
      const batch = db.batch();

      snap.forEach(d => batch.delete(d.ref));

      await batch.commit();

      delete deleteUsersConfirm[id];

      return bot.sendMessage(msg.chat.id, "✔ Usuários deletados");
    }

    return bot.sendMessage(msg.chat.id, "❌ Código inválido");
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

  const ok = await checkCadastro(msg.from.id, msg.chat.id);
  if (!ok) return;

  const hasPlano = await checkPlano(msg.from.id);
  if (!hasPlano) {
    return bot.sendMessage(msg.chat.id, "❌ Sem plano ativo");
  }

  const snap = await db.collection("produtos").get();

  let buttons = [];

  snap.forEach(d => {
    const p = d.data();

    buttons.push([{
      text: p.nome,
      callback_data: `produto_${d.id}`
    }]);
  });

  if (buttons.length === 0) {
    return bot.sendMessage(msg.chat.id, "Nenhum produto.");
  }

  bot.sendMessage(msg.chat.id, "Selecione:", {
    reply_markup: { inline_keyboard: buttons }
  });
});

// ================= ADMIN =================
bot.onText(/\/addprodutos/, (msg) => {
  if (!ADMINS.includes(String(msg.from.id))) return;

  addStep[msg.from.id] = "nome";
  addData[msg.from.id] = {};

  bot.sendMessage(msg.chat.id, "Nome do produto:");
});

// ================= DELETE PRODUTOS =================
bot.onText(/\/deletarprodutos/, (msg) => {
  if (!ADMINS.includes(String(msg.from.id))) return;

  const code = Math.floor(100000 + Math.random() * 900000);
  deleteProductsConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id, `Código: ${code}`);
});

// ================= DELETE USERS =================
bot.onText(/\/deletarusuarios/, (msg) => {
  if (!ADMINS.includes(String(msg.from.id))) return;

  const code = Math.floor(100000 + Math.random() * 900000);
  deleteUsersConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id, `Código: ${code}`);
});

// ================= STATUS =================
bot.onText(/\/status/, async (msg) => {

  const ok = await checkCadastro(msg.from.id, msg.chat.id);
  if (!ok) return;

  bot.sendMessage(msg.chat.id,
`Bot online
${OWNER}
versão ${BOT_VERSION}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("BOT ESTÁVEL ONLINE 🚀");
});
