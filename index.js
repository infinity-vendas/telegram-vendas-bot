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

// ================= CONTROLE =================
const cadastroStep = {};
const cadastroData = {};

const addStep = {};
const addData = {};

const deleteProductsConfirm = {};

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);

  cadastroStep[id] = "nome";
  cadastroData[id] = {};

  bot.sendMessage(msg.chat.id,
`🚀 Cadastro

Seu ID: ${id}

Digite seu nome:`);
});

// ================= MESSAGE =================
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
      return bot.sendMessage(msg.chat.id, "WhatsApp:");
    }

    if (cadastroStep[id] === "whatsapp") {

      cadastroData[id].whatsapp = text;

      try {
        await db.collection("users").doc(id).set({
          ...cadastroData[id],
          userId: id,
          criadoEm: Date.now()
        });

        console.log("SALVO FIREBASE:", id);

      } catch (e) {
        console.log("ERRO FIREBASE:", e);
        return bot.sendMessage(msg.chat.id, "Erro ao salvar cadastro.");
      }

      delete cadastroStep[id];
      delete cadastroData[id];

      return bot.sendMessage(msg.chat.id, "✔ Cadastro salvo no Firebase");
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

      try {
        await db.collection("produtos").add(addData[id]);
        console.log("PRODUTO SALVO");
      } catch (e) {
        console.log("ERRO PRODUTO:", e);
        return bot.sendMessage(msg.chat.id, "Erro ao salvar produto.");
      }

      delete addStep[id];
      delete addData[id];

      return bot.sendMessage(msg.chat.id, "✔ Produto salvo");
    }

    return;
  }

  // ================= DELETE CONFIRM =================
  if (deleteProductsConfirm[id]) {

    if (text === String(deleteProductsConfirm[id])) {

      try {
        const snap = await db.collection("produtos").get();

        if (snap.empty) {
          delete deleteProductsConfirm[id];
          return bot.sendMessage(msg.chat.id, "Nenhum produto.");
        }

        const batch = db.batch();

        snap.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();

        console.log("PRODUTOS DELETADOS");

        delete deleteProductsConfirm[id];

        return bot.sendMessage(msg.chat.id, "✔ Todos produtos deletados");

      } catch (e) {
        console.log("ERRO DELETE:", e);
        return bot.sendMessage(msg.chat.id, "Erro ao deletar.");
      }
    }

    return bot.sendMessage(msg.chat.id, "Código inválido.");
  }

});

// ================= ADD PRODUTO =================
bot.onText(/\/addprodutos/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "Sem permissão");
  }

  addStep[msg.from.id] = "nome";
  addData[msg.from.id] = {};

  bot.sendMessage(msg.chat.id, "Nome do produto:");
});

// ================= DELETE PRODUTOS =================
bot.onText(/\/deletarprodutos/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "Sem permissão");
  }

  const code = Math.floor(100000 + Math.random() * 900000);

  deleteProductsConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id,
`⚠️ CONFIRMAÇÃO

Código: ${code}

Digite o código para deletar tudo`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("BOT FUNCIONANDO FIREBASE 🚀");
});
