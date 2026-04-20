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

// ================= CONTROLE =================
const OWNER = "INFINITY CLIENTE";
const BOT_VERSION = "v1";

const WHATSAPP_NUMBER = "5551981528372";
const PIX_KEY = "51981528372";

const deleteConfirm = {};
const addStep = {};
const addData = {};

// ================= START =================
const START_TEXT = `Dono: INFINITY CLIENTE
Validity: 25.04.2026
Created by: @Infity_cliente_oficial
Parcerias: nenhuma
vendedores (1) admin
divulgadores: nenhum
Instagram: disponível
YouTube: em breve
TikTok: indisponível
Kwai: indisponível

Pagamento Pix / cartão: em breve
Transações manuais seguras

Unidos venceremos`;

// ================= MENU =================
const MENU_TEXT = `INFINITY STORE

/produtos
/addprodutos
/deletarprodutos
/status`;

// ================= START =================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, START_TEXT);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, MENU_TEXT);
  }, 3000);
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "Nenhum produto disponível");
  }

  let buttons = [];

  snap.forEach((d) => {
    const p = d.data();

    buttons.push([
      {
        text: p.nome,
        callback_data: `produto_${d.id}`
      }
    ]);
  });

  bot.sendMessage(msg.chat.id, "SELECIONE UM PRODUTO", {
    reply_markup: { inline_keyboard: buttons }
  });
});

// ================= DETALHE PRODUTO =================
bot.on("callback_query", async (query) => {

  if (!query.data.startsWith("produto_")) return;

  const id = query.data.split("_")[1];
  const doc = await db.collection("produtos").doc(id).get();

  if (!doc.exists) return;

  const p = doc.data();

  const msgWhats = encodeURIComponent(
`Produto: ${p.nome}
Valor: R$ ${p.valor}`
  );

  bot.sendMessage(query.message.chat.id,
`PRODUTO

${p.nome}
R$ ${p.valor}
${p.descricao}

PIX: ${PIX_KEY}`, {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "Adquirir agora",
          url: `https://wa.me/${WHATSAPP_NUMBER}?text=${msgWhats}`
        }
      ]]
    }
  });
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

// ================= FLUXO ADD =================
bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  if (!text) return;

  // ================= CORREÇÃO AQUI (DELETE PRIORITÁRIO) =================
  if (deleteConfirm[id]) {

    if (text == deleteConfirm[id]) {

      const snap = await db.collection("produtos").get();
      const batch = db.batch();

      snap.forEach(doc => batch.delete(doc.ref));

      await batch.commit();

      delete deleteConfirm[id];

      return bot.sendMessage(msg.chat.id, "Produtos deletados com sucesso!");
    }

    return bot.sendMessage(msg.chat.id, "Código inválido");
  }

  // ================= IGNORA COMANDOS =================
  if (text.startsWith("/")) return;

  // ================= ADD PRODUTO =================
  if (!addStep[id]) return;

  const step = addStep[id];

  if (step === "nome") {
    addData[id].nome = text;
    addStep[id] = "valor";
    return bot.sendMessage(msg.chat.id, "Valor:");
  }

  if (step === "valor") {
    addData[id].valor = text;
    addStep[id] = "descricao";
    return bot.sendMessage(msg.chat.id, "Descrição:");
  }

  if (step === "descricao") {

    addData[id].descricao = text;

    await db.collection("produtos").add(addData[id]);

    delete addStep[id];
    delete addData[id];

    return bot.sendMessage(msg.chat.id, "Produto cadastrado com sucesso!");
  }
});

// ================= DELETE PRODUTOS =================
bot.onText(/\/deletarprodutos/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "Sem permissão");
  }

  const code = Math.floor(10000 + Math.random() * 90000);

  deleteConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id,
`CONFIRMAÇÃO

Código: ${code}

Digite para deletar tudo`);
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
`Bot online
${OWNER}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("BOT PRO CORRIGIDO ONLINE");
});
