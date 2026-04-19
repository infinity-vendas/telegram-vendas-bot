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
const OWNER = "Faelzin";
const BOT_VERSION = "v7.2";

// ================= LAYOUT ORIGINAL =================
const INFO_TEXT =
`⚡INFINITY CLIENTE VENDAS ON-LINE

⚡+10X comandos atualizados todos os dias
⚡Bot funcionando perfeitamente, sem bugs

⚡Loja Profissional Ativa

━━━━━━━━━━━━━━

⚡version atual: ${BOT_VERSION}
⚡whatsapp 51981528372
⚡suporte: suporte@InfinityTermux.com

⚡Redes sociais:
⚡@Infinity_termux_ofc
⚡YouTube @Infinity_termux_ofc
⚡Telegram @InfinityTermux`;

// ================= CONTROLE ADD PRODUTO =================
const addStep = {};
const addData = {};

// ================= START =================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, INFO_TEXT);

  setTimeout(() => {
    bot.sendMessage(chatId,
`⚡MENU

⚡/produtos
⚡/addproduto
⚡/status`);
  }, 1500);
});

// ================= MENU =================
bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id,
`⚡MENU

⚡/produtos
⚡/addproduto
⚡/status`);
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "⚡Nenhum produto disponível");
  }

  let text = "⚡PRODUTOS DISPONÍVEIS:\n\n";

  snap.forEach(d => {
    const p = d.data();

    text +=
`⚡ Nome: ${p.nome}
⚡ Valor: R$ ${p.valor}
⚡ Descrição: ${p.descricao}
⚡ Tipo: ${p.tipo}
⚡ Categoria: ${p.categoria}
⚡ WhatsApp: ${p.whatsapp}
⚡ Instagram: ${p.instagram}
━━━━━━━━━━━━━━
`;
  });

  bot.sendMessage(msg.chat.id, text);
});

// ================= ADD PRODUTO =================
bot.onText(/\/addproduto/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "⚡Sem permissão");
  }

  const id = msg.from.id;

  addStep[id] = "nome";

  bot.sendMessage(msg.chat.id, "⚡Digite o NOME do produto:");
});

// ================= FLUXO =================
bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;
  if (!addStep[id]) return;

  if (!addData[id]) addData[id] = {};

  if (addStep[id] === "nome") {
    addData[id].nome = text;
    addStep[id] = "valor";
    return bot.sendMessage(msg.chat.id, "⚡Digite o VALOR:");
  }

  if (addStep[id] === "valor") {
    addData[id].valor = text;
    addStep[id] = "descricao";
    return bot.sendMessage(msg.chat.id, "⚡Digite a DESCRIÇÃO:");
  }

  if (addStep[id] === "descricao") {
    addData[id].descricao = text;
    addStep[id] = "tipo";
    return bot.sendMessage(msg.chat.id, "⚡Digite o TIPO:");
  }

  if (addStep[id] === "tipo") {
    addData[id].tipo = text;
    addStep[id] = "categoria";
    return bot.sendMessage(msg.chat.id, "⚡Digite a CATEGORIA:");
  }

  if (addStep[id] === "categoria") {
    addData[id].categoria = text;
    addStep[id] = "whatsapp";
    return bot.sendMessage(msg.chat.id, "⚡Digite o WHATSAPP:");
  }

  if (addStep[id] === "whatsapp") {
    addData[id].whatsapp = text;
    addStep[id] = "instagram";
    return bot.sendMessage(msg.chat.id, "⚡Digite o INSTAGRAM:");
  }

  if (addStep[id] === "instagram") {
    addData[id].instagram = text;

    await db.collection("produtos").add(addData[id]);

    delete addStep[id];
    delete addData[id];

    return bot.sendMessage(msg.chat.id, "⚡Produto cadastrado com sucesso!");
  }
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
`⚡Bot online
⚡DEV: ${OWNER}
⚡versão: ${BOT_VERSION}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("⚡BOT V7.2 PADRONIZADO ONLINE");
});
