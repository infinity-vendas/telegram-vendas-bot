require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ✅ NOVO MERCADO PAGO
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const MASTER = "6863505946";
const ADMINS = ["8510878195"];

const WHATSAPP = "551981528372";
const BOT_USERNAME = "SellForge_bot";

let BOT_ATIVO = true;

// ================= MERCADO PAGO =================
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

// ================= FIREBASE =================
let db;

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  initializeApp({
    credential: cert(serviceAccount)
  });

  db = getFirestore();
  console.log("🔥 Firebase conectado");

} catch (e) {
  console.log("❌ Firebase erro:", e.message);
}

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;

app.post(SECRET_PATH, (req, res) => {
  res.sendStatus(200);
  bot.processUpdate(req.body);
});

app.get('/', (req, res) => res.send("🚀 INFINITY CLIENTES ONLINE"));

// ================= ESTADO =================
const userState = {};
const LOGO = "https://i.postimg.cc/g2JJvqHN/logo.jpg";

// ================= TEMPO =================
function getTempo(ms) {
  const mapa = {
    "1m": 60000,
    "10m": 600000,
    "1h": 3600000,
    "24h": 86400000,
    "48h": 172800000,
    "5d": 432000000,
    "30d": 2592000000,
    "60d": 5184000000,
    "90d": 7776000000,
    "120d": 10368000000
  };
  return mapa[ms] || null;
}

// ================= START =================
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {

  if (!BOT_ATIVO) return;

  const chatId = msg.chat.id;
  const id = String(msg.from.id);
  const ref = match[1];

  await bot.sendPhoto(chatId, LOGO);

  const userDoc = await db.collection('users').doc(id).get();

  if (!userDoc.exists || !userDoc.data().nome) {
    userState[id] = { step: "cad_nome" };
    return bot.sendMessage(chatId, "📋 CADASTRO OBRIGATÓRIO\n\nDigite seu nome:");
  }

  if (ref) {
    const vendedor = await db.collection('vendedores').doc(ref).get();
    if (!vendedor.exists || !vendedor.data().ativo) {
      return bot.sendMessage(chatId, `🚫 Link não autorizado`);
    }
    await bot.sendMessage(chatId, `👤 Indicado por: ${ref}`);
  }

  // 🔥 MENSAGEM ORIGINAL (NÃO ALTERADA)
  await bot.sendMessage(chatId,
`Olá 👋

Sou seu assistente virtual 🤖

Como posso lhe ajudar hoje?

🔥 Confira nossos planos ULTRA MAX

Cansado de alugar bots caros e sem resultado?

Apresento a você a INFINITY CLIENTES 🚀

✔ Transparência
✔ Qualidade
✔ Desempenho

#EQUIPE IC ®

Escolha abaixo 👇`,
{
  reply_markup: {
    keyboard: [
      ["📦 Produtos", "📊 Planos"],
      ["🤖 Alugar Bot", "📲 Suporte"],
      ["🔗 Meu Link", "🚨 Denunciar"]
    ],
    resize_keyboard: true
  }
});

  if (id === MASTER || ADMINS.includes(id)) {
    bot.sendMessage(chatId, `🔐 ADMIN LIBERADO\n/comandos_admin`);
  }
});

// ================= RESET STATE BUG =================
function limparState(id) {
  if (userState[id]) delete userState[id];
}

// ================= MESSAGE =================
bot.on("message", async (msg) => {

  if (!msg.text) return;

  const id = String(msg.from.id);
  const text = msg.text;
  const state = userState[id];

  if (!BOT_ATIVO && id !== MASTER) {
    return bot.sendMessage(msg.chat.id, "🚫 Bot temporariamente desligado");
  }

  // 🔥 EVITA BUG DE TRAVAMENTO
  if (text.startsWith("/")) limparState(id);

  // ===== ADD PRODUTO =====
  if (text === "/add_produto") {
    if (id !== MASTER && !ADMINS.includes(id)) return;

    userState[id] = { step: "add_nome" };
    return bot.sendMessage(msg.chat.id, "📦 Nome do produto:");
  }

  if (state?.step === "add_nome") {
    state.nome = text;
    state.step = "add_preco";
    return bot.sendMessage(msg.chat.id, "💰 Valor:");
  }

  if (state?.step === "add_preco") {
    state.preco = Number(text);
    state.step = "add_desc";
    return bot.sendMessage(msg.chat.id, "📝 Descrição:");
  }

  if (state?.step === "add_desc") {
    state.desc = text;
    state.step = "add_img";
    return bot.sendMessage(msg.chat.id, "🖼️ Link imagem:");
  }

  if (state?.step === "add_img") {
    state.img = text;
    state.step = "add_zap";
    return bot.sendMessage(msg.chat.id, "📲 WhatsApp:");
  }

  if (state?.step === "add_zap") {

    await db.collection('produtos').add({
      nome: state.nome,
      preco: state.preco,
      desc: state.desc,
      img: state.img,
      whatsapp: text,
      criadoPor: id,
      estoque: 10
    });

    limparState(id);
    return bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
  }
});

// ================= PIX PAGAMENTO =================
bot.on("callback_query", async (q) => {

  const idProduto = q.data.replace("buy_", "");
  const doc = await db.collection('produtos').doc(idProduto).get();
  const p = doc.data();

  if (!p) return;

  const payment = new Payment(mpClient);

  const result = await payment.create({
    body: {
      transaction_amount: Number(p.preco),
      description: p.nome,
      payment_method_id: "pix",
      payer: { email: "cliente@email.com" }
    }
  });

  const pix = result.point_of_interaction.transaction_data.qr_code;

  bot.sendMessage(q.message.chat.id,
`💸 PAGAMENTO PIX

Produto: ${p.nome}
Valor: R$${p.preco}

🔑 Copie o código PIX abaixo:

${pix}`);
});

// ================= ADMIN =================
bot.onText(/\/comandos_admin/, (msg) => {

  const id = String(msg.from.id);
  if (id !== MASTER && !ADMINS.includes(id)) return;

  bot.sendMessage(msg.chat.id,
`🔐 ADMIN

/add_produto
/del_produto ID
/unban ID
/set_tempo ID tempo
/ranking

👑 MASTER:
/ban_perm ID
/reset_total
/desligar_bot
/ligar_bot`);
});

// ===== UNBAN =====
bot.onText(/\/unban (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== MASTER && !ADMINS.includes(String(msg.from.id))) return;

  await db.collection('vendedores').doc(m[1]).set({
    banido: null
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "✅ Vendedor desbloqueado");
});

// ===== TEMPO =====
bot.onText(/\/set_tempo (.+) (.+)/, async (msg, m) => {

  const tempo = getTempo(m[2]);
  if (!tempo) return bot.sendMessage(msg.chat.id, "❌ Tempo inválido");

  await db.collection('vendedores').doc(m[1]).set({
    ativo: true,
    expiraEm: Date.now() + tempo
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "⏱ Tempo atualizado");
});

// ===== DESLIGAR =====
bot.onText(/\/desligar_bot/, (msg) => {

  if (String(msg.from.id) !== MASTER) {
    return bot.sendMessage(msg.chat.id,
"🚫 Sem autorização\nContate dono oficial +55 51 981528372");
  }

  BOT_ATIVO = false;
  bot.sendMessage(msg.chat.id, "🔴 BOT DESLIGADO");
});

// ===== LIGAR =====
bot.onText(/\/ligar_bot/, (msg) => {

  if (String(msg.from.id) !== MASTER) return;

  BOT_ATIVO = true;
  bot.sendMessage(msg.chat.id, "🟢 BOT LIGADO");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;
  await bot.setWebHook(url);

  console.log("Webhook:", url);
});
