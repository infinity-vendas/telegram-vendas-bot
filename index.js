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
const OWNER = "Faelzin Vendas";
const BOT_VERSION = "v1";

// ================= ÁUDIO =================
const AUDIO_URL = "https://files.catbox.moe/p6wlxb.mp3";

// ================= CONTROLES =================
const deleteConfirm = {};
const addStep = {};
const addData = {};

// ================= MENU =================
const MENU_TEXT = `⬛⬛⬛ INFINITY STORE ⬛⬛⬛

━━━━━━━━━━━━━━━━━━

💎 BEM-VINDO AO SISTEMA VIP

⚡ Acesso liberado com sucesso
⚡ Produtos atualizados diariamente
⚡ Plataforma segura e estável

━━━━━━━━━━━━━━━━━━

📦 SERVIÇOS DISPONÍVEIS:

⚡ /produtos
⚡ /addproduto
⚡ /deletarprodutos
⚡ /importarprodutos
⚡ /status

━━━━━━━━━━━━━━━━━━

🛡️ Proteção ativa
📢 Suporte direto
💰 Melhor custo benefício

━━━━━━━━━━━━━━━━━━

🔥 POWERED BY INFINITY SYSTEM`;

// ================= START TEXTO =================
const START_TEXT = `⚡ Nick Dono: Faelzin Vendas
⚡ Validad day: 25.04.2026
⚡ Expires: 99.99.9999
⚡ Type: VIP

━━━━━━━━━━━━━━━━━━

⚡ Parcerias: ATIVO
⚡ Redes sociais: ATIVO
⚡ WhatsApp desenvolvedor: 51981528372

━━━━━━━━━━━━━━━━━━

⚡ Vendedores: no momento não tenho
⚡ Divulgadores: no momento não tenho

━━━━━━━━━━━━━━━━━━

⚡ Bot criado por: Faelzin Dono
⚡ Suporte: Direto chat PV

━━━━━━━━━━━━━━━━━━

📢 Redes sociais atuais:

⚡ WhatsApp
⚡ Facebook
⚡ Instagram
⚡ TikTok
⚡ Kwai
⚡ Telegram
⚡ Twitter`;

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  // 🎧 ÁUDIO PRIMEIRO
  try {
    await bot.sendAudio(chatId, AUDIO_URL);
  } catch (e) {
    console.log("Erro áudio:", e.message);
  }

  // 📝 TEXTO
  setTimeout(() => {
    bot.sendMessage(chatId, START_TEXT);
  }, 2000);

  // ⏳ LIBERA MENU (tempo do áudio)
  setTimeout(() => {
    bot.sendMessage(chatId, MENU_TEXT);
  }, 15000);
});

// ================= MENU =================
bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, MENU_TEXT);
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "⚡ Nenhum produto disponível");
  }

  let text = "⬛⬛⬛ PRODUTOS ⬛⬛⬛\n\n";

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
━━━━━━━━━━━━━━━━━━
`;
  });

  bot.sendMessage(msg.chat.id, text);
});

// ================= ADD PRODUTO =================
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

// ================= DELETE PRODUTOS =================
bot.onText(/\/deletarprodutos/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "⚡ Sem permissão");
  }

  const code = Math.floor(10000 + Math.random() * 90000);
  deleteConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id,
`⚠️ CONFIRMAÇÃO NECESSÁRIA

🔐 Código: ${code}

⚡ Digite para confirmar`);
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

    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    delete deleteConfirm[id];

    return bot.sendMessage(msg.chat.id, "⚡ Produtos deletados com sucesso!");
  }

  if (deleteConfirm[id]) {
    return bot.sendMessage(msg.chat.id, "⚡ Código inválido");
  }
});

// ================= IMPORTAR PRODUTOS =================
bot.onText(/\/importarprodutos/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "⚡ Sem permissão");
  }

  const produtos = [
    { nome:"Pack FF", valor:"0,97", descricao:"Completo", tipo:"básico", categoria:"ff", whatsapp:"51981528372", instagram:"@Infinity" }
  ];

  for (const p of produtos) {
    await db.collection("produtos").add(p);
  }

  bot.sendMessage(msg.chat.id, "⚡ Produtos importados!");
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
  console.log("⚡ BOT START NOVO ATIVO");
});
