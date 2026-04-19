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

// ================= IDENTIDADE =================
const OWNER = "Infinity Vendas e divulgações";
const BOT_VERSION = "v1";

// ================= CONTROLE DELETE =================
const deleteConfirm = {};

// ================= MENU =================
const MENU_TEXT =
`⚡ MENU LIBERADO

⚡ /produtos
⚡ /addproduto
⚡ /deletarprodutos
⚡ /status`;

// ================= LAYOUT ORIGINAL RESTAURADO =================
const START_TEXT =
`⚡Nick Dono: Infinity Vendas e divulgações
Valid 24.04.2026 - 23:59
Type: Premium / Básico
Version atual: v1
Commands atual: X
Expires in: 99/99/9999
status: On-line
Parcerias: OFF
vendedores: OFF
vendedor atual: ADMIN (Eu)

━━━━━━━━━━━━━━

🤜🏻🤛🏿 Lembrando: no momento não estou fechando parcerias.
Empresa nova, vamos evoluir juntos com sinceridade.
Deus no comando acima de tudo.`;

// ================= ÁUDIO =================
const AUDIO_URL = "https://files.catbox.moe/p6wlxb.mp3";

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, START_TEXT);
  await bot.sendAudio(chatId, AUDIO_URL);

  setTimeout(() => {
    bot.sendMessage(chatId, MENU_TEXT);
  }, 15000);
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "⚡ Nenhum produto disponível");
  }

  let text = "⚡ PRODUTOS:\n\n";

  snap.forEach(d => {
    const p = d.data();

    text +=
`⚡ Nome: ${p.nome}
⚡ Valor: R$ ${p.valor}
⚡ Descrição: ${p.descricao}
⚡ Tipo: ${p.tipo}
⚡ Categoria: ${p.categoria}
━━━━━━━━━━━━━━
`;
  });

  bot.sendMessage(msg.chat.id, text);
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

Para deletar TODOS os produtos do Firebase,
digite o código abaixo:

🔐 Código: ${code}

⚡ Esta ação não pode ser desfeita`);
});

// ================= CONFIRMA DELETE =================
bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;
  if (!deleteConfirm[id]) return;

  if (text == deleteConfirm[id]) {

    const snap = await db.collection("produtos").get();
    const batch = db.batch();

    snap.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    delete deleteConfirm[id];

    return bot.sendMessage(msg.chat.id, "⚡ Produtos deletados com sucesso!");
  }

  if (deleteConfirm[id]) {
    return bot.sendMessage(msg.chat.id, "⚡ Código inválido");
  }
});

// ================= ADD PRODUTO =================
const addStep = {};
const addData = {};

bot.onText(/\/addproduto/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "⚡ Sem permissão");
  }

  addStep[msg.from.id] = "nome";

  bot.sendMessage(msg.chat.id, "⚡ Digite o NOME do produto:");
});

bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;
  if (!addStep[id]) return;

  if (!addData[id]) addData[id] = {};

  if (addStep[id] === "nome") {
    addData[id].nome = text;
    addStep[id] = "valor";
    return bot.sendMessage(msg.chat.id, "⚡ Digite o VALOR:");
  }

  if (addStep[id] === "valor") {
    addData[id].valor = text;
    addStep[id] = "descricao";
    return bot.sendMessage(msg.chat.id, "⚡ Digite a DESCRIÇÃO:");
  }

  if (addStep[id] === "descricao") {
    addData[id].descricao = text;
    addStep[id] = "tipo";
    return bot.sendMessage(msg.chat.id, "⚡ Digite o TIPO:");
  }

  if (addStep[id] === "tipo") {
    addData[id].tipo = text;
    addStep[id] = "categoria";
    return bot.sendMessage(msg.chat.id, "⚡ Digite a CATEGORIA:");
  }

  if (addStep[id] === "categoria") {
    addData[id].categoria = text;
    addStep[id] = "whatsapp";
    return bot.sendMessage(msg.chat.id, "⚡ Digite o WHATSAPP:");
  }

  if (addStep[id] === "whatsapp") {
    addData[id].whatsapp = text;
    addStep[id] = "instagram";
    return bot.sendMessage(msg.chat.id, "⚡ Digite o INSTAGRAM:");
  }

  if (addStep[id] === "instagram") {
    addData[id].instagram = text;

    await db.collection("produtos").add(addData[id]);

    delete addStep[id];
    delete addData[id];

    return bot.sendMessage(msg.chat.id, "⚡ Produto cadastrado com sucesso!");
  }
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
  console.log("⚡ BOT V7.6 RESTAURADO ONLINE");
});
