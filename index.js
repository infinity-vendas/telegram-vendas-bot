require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
app.use(express.json());

// CONFIG
const ADMIN_ID = "6863505946";
const WHATSAPP = "551981528372";
const BOT_USERNAME = "@SellForge_bot"; // ALTERAR

// FIREBASE
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

// BOT
const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;

// WEBHOOK
app.post(SECRET_PATH, (req, res) => {
  res.sendStatus(200);
  bot.processUpdate(req.body);
});

app.get('/', (req, res) => res.send("🚀 INFINITY CLIENTES ONLINE"));

// ESTADO
const userState = {};

// LOGO
const LOGO = "https://i.postimg.cc/g2JJvqHN/logo.jpg";

// ================= START =================
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {

  const chatId = msg.chat.id;
  const ref = match[1];

  await bot.sendPhoto(chatId, LOGO);

  // ===== VALIDAÇÃO VENDEDOR =====
  if (ref) {
    const vendedor = await db.collection('vendedores').doc(ref).get();

    if (!vendedor.exists || !vendedor.data().ativo) {
      return bot.sendMessage(chatId,
`🚫 Link não autorizado

Fale com suporte`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "📲 WhatsApp",
      url: `https://wa.me/${WHATSAPP}`
    }]]
  }
});
    }

    await bot.sendMessage(chatId, `👤 Indicado por: ${ref}`);
  }

  // ===== SUA MENSAGEM ORIGINAL =====
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
      ["🤖 Alugar Bot", "📲 Suporte"]
    ],
    resize_keyboard: true
  }
});

  // ===== MENU ADMIN =====
  if (String(msg.from.id) === ADMIN_ID) {
    bot.sendMessage(chatId,
`🔐 ADMIN

/comandos_admin`);
  }
});

// ================= MENU =================
bot.on("message", async (msg) => {

  if (!msg.text) return;

  const text = msg.text;
  const id = String(msg.from.id);
  const state = userState[id];

  // ===== CADASTRO PRODUTO =====
  if (state?.step === "nome") {
    userState[id] = { step: "preco", nome: text };
    return bot.sendMessage(msg.chat.id, "💰 Valor (ex: R$10,00)");
  }

  if (state?.step === "preco") {
    state.preco = text;
    state.step = "desc";
    return bot.sendMessage(msg.chat.id, "📝 Descrição");
  }

  if (state?.step === "desc") {
    state.desc = text;
    state.step = "img";
    return bot.sendMessage(msg.chat.id, "🖼️ Link da imagem");
  }

  if (state?.step === "img") {
    state.img = text;
    state.step = "zap";
    return bot.sendMessage(msg.chat.id, "📲 WhatsApp (+55...)");
  }

  if (state?.step === "zap") {

    await db.collection('produtos').add({
      nome: state.nome,
      preco: state.preco,
      desc: state.desc,
      img: state.img,
      whatsapp: text
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id, "✅ Produto cadastrado");
  }

  // ===== PRODUTOS =====
  if (text === "📦 Produtos") {

    const snap = await db.collection('produtos').get();

    if (snap.empty)
      return bot.sendMessage(msg.chat.id, "Sem produtos");

    for (const doc of snap.docs) {
      const p = doc.data();

      await bot.sendPhoto(msg.chat.id, p.img, {
        caption:
`📦 ${p.nome}
💰 ${p.preco}

📝 ${p.desc}`,
        reply_markup: {
          inline_keyboard: [[{
            text: "🛒 Comprar",
            url: `https://wa.me/${p.whatsapp.replace(/\D/g, '')}`
          }]]
        }
      });
    }
  }

  // ===== PLANOS =====
  if (text === "📊 Planos") {
    bot.sendMessage(msg.chat.id,
`📊 PLANOS

1D = R$5
3D = R$15
10D = R$30
20D = R$60
30D = R$90
40D = R$120
50D = R$150
60D = R$180
90D = R$210`);
  }

  // ===== ALUGAR BOT =====
  if (text === "🤖 Alugar Bot") {
    bot.sendMessage(msg.chat.id,
`🤖 ALUGAR BOT

24h = R$6
48h = R$8`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "📲 Contratar",
      url: `https://wa.me/${WHATSAPP}?text=Quero%20alugar%20bot`
    }]]
  }
});
  }

  // ===== SUPORTE =====
  if (text === "📲 Suporte") {
    bot.sendMessage(msg.chat.id,
"Fale conosco 👇",
{
  reply_markup: {
    inline_keyboard: [[{
      text: "WhatsApp",
      url: `https://wa.me/${WHATSAPP}`
    }]]
  }
});
  }
});

// ================= ADMIN =================

// menu admin
bot.onText(/\/comandos_admin/, (msg) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  bot.sendMessage(msg.chat.id,
`🔐 COMANDOS ADMIN

/Produtos
/ativar vendedor ID nome
/link vendedor nome
/excluir vendedor nome`);
});

// criar produto
bot.onText(/\/Produtos/, (msg) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  userState[msg.from.id] = { step: "nome" };

  bot.sendMessage(msg.chat.id, "📦 Nome do produto");
});

// ativar vendedor
bot.onText(/\/ativar vendedor (\d+) (.+)/, async (msg, m) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  const userId = m[1];
  const nome = m[2].toLowerCase();

  await db.collection('vendedores').doc(nome).set({
    userId,
    ativo: true
  });

  bot.sendMessage(msg.chat.id,
`✅ Vendedor ativado

🔗 Link:
https://t.me/${BOT_USERNAME}?start=${nome}`);
});

// gerar link
bot.onText(/\/link vendedor (.+)/, (msg, m) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  const nome = m[1];

  bot.sendMessage(msg.chat.id,
`🔗 Link do vendedor:

https://t.me/${BOT_USERNAME}?start=${nome}`);
});

// excluir vendedor
bot.onText(/\/excluir vendedor (.+)/, async (msg, m) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('vendedores').doc(m[1]).delete();

  bot.sendMessage(msg.chat.id, "❌ Vendedor removido");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

  await bot.setWebHook(url);

  console.log("Webhook:", url);
});
