require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const MASTER = "6863505946";
const ADMINS = ["8510878195"];

const WHATSAPP = "551981528372";
const BOT_USERNAME = "SellForge_bot";
const BOT_VERSION = "v4.0 GOD";

let BOT_ATIVO = true;

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
    return bot.sendMessage(chatId,
`📋 CADASTRO OBRIGATÓRIO

Digite seu nome:`);
  }

  if (ref) {
    const vendedor = await db.collection('vendedores').doc(ref).get();

    if (!vendedor.exists || !vendedor.data().ativo) {
      return bot.sendMessage(chatId, `🚫 Link não autorizado`);
    }

    await bot.sendMessage(chatId, `👤 Indicado por: ${ref}`);
  }

  // 🔥 MENSAGEM INTACTA
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

// ================= MESSAGE =================
bot.on("message", async (msg) => {

  if (!msg.text) return;

  const id = String(msg.from.id);
  const text = msg.text;
  const state = userState[id];

  // 🔴 BOT DESLIGADO
  if (!BOT_ATIVO && id !== MASTER) {
    return bot.sendMessage(msg.chat.id,
"🚫 Bot temporariamente desligado");
  }

  // ===== CADASTRO =====
  if (state?.step === "cad_nome") {
    userState[id] = { nome: text, step: "cad_idade" };
    return bot.sendMessage(msg.chat.id, "Digite sua idade:");
  }

  if (state?.step === "cad_idade") {
    state.idade = text;
    state.step = "cad_whatsapp";
    return bot.sendMessage(msg.chat.id, "Digite seu WhatsApp:");
  }

  if (state?.step === "cad_whatsapp") {
    state.whatsapp = text;
    state.step = "cad_insta";
    return bot.sendMessage(msg.chat.id, "Digite seu Instagram:");
  }

  if (state?.step === "cad_insta") {

    await db.collection('users').doc(id).set({
      nome: state.nome,
      idade: state.idade,
      whatsapp: state.whatsapp,
      instagram: text,
      criadoEm: new Date()
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id,
"✅ Cadastro concluído!\nDigite /start");
  }

  // ===== MENU =====
  if (text === "📦 Produtos") {

    const snap = await db.collection('produtos').get();

    if (snap.empty)
      return bot.sendMessage(msg.chat.id, "❌ Nenhum produto");

    for (const doc of snap.docs) {
      const p = doc.data();

      if (p.estoque <= 0) continue;

      await bot.sendPhoto(msg.chat.id, p.img, {
        caption:
`📦 ${p.nome}
💰 ${p.preco}

📝 ${p.desc}
📦 Estoque: ${p.estoque}`,
        reply_markup: {
          inline_keyboard: [[{
            text: "🛒 Comprar",
            callback_data: `buy_${doc.id}`
          }]]
        }
      });
    }
  }

  if (text === "📊 Planos") {
    return bot.sendMessage(msg.chat.id,
`📊 PLANOS DISPONÍVEIS

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

  if (text === "🤖 Alugar Bot") {
    return bot.sendMessage(msg.chat.id,
`🤖 ALUGAR BOT

24h = R$6
48h = R$8`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "📲 Contratar",
      url: `https://wa.me/${WHATSAPP}`
    }]]
  }
});
  }

  if (text === "📲 Suporte") {
    return bot.sendMessage(msg.chat.id,
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
    state.preco = text;
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

    userState[id] = null;

    return bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
  }

});

// ===== COMPRA =====
bot.on("callback_query", async (q) => {

  const idProduto = q.data.replace("buy_", "");
  const doc = await db.collection('produtos').doc(idProduto).get();
  const p = doc.data();

  if (!p || p.estoque <= 0)
    return bot.answerCallbackQuery(q.id, { text: "❌ Sem estoque" });

  await db.collection('vendas').add({
    produto: p.nome,
    preco: p.preco,
    desc: p.desc,
    img: p.img,
    whatsapp: p.whatsapp,
    vendedor: p.criadoPor,
    data: new Date()
  });

  await doc.ref.update({ estoque: p.estoque - 1 });

  bot.answerCallbackQuery(q.id, { text: "✅ Pedido registrado" });

  bot.sendMessage(q.message.chat.id,
`🛒 Finalize aqui:
https://wa.me/${p.whatsapp}`);
});

// ===== ADMIN =====
bot.onText(/\/comandos_admin/, (msg) => {

  const id = String(msg.from.id);

  if (id !== MASTER && !ADMINS.includes(id)) return;

  bot.sendMessage(msg.chat.id,
`🔐 ADMIN

/add_produto
/del_produto ID
/ban_temp ID
/ranking

👑 MASTER:
/ban_perm ID
/reset_total
/desligar_bot
/ligar_bot`);
});

// ===== DESLIGAR BOT =====
bot.onText(/\/desligar_bot/, async (msg) => {

  if (String(msg.from.id) !== MASTER) {
    return bot.sendMessage(msg.chat.id,
"🚫 Sem autorização\nContate dono oficial +55 51 981528372");
  }

  BOT_ATIVO = false;
  bot.sendMessage(msg.chat.id, "🔴 BOT DESLIGADO");
});

// ===== LIGAR BOT =====
bot.onText(/\/ligar_bot/, async (msg) => {

  if (String(msg.from.id) !== MASTER) return;

  BOT_ATIVO = true;
  bot.sendMessage(msg.chat.id, "🟢 BOT LIGADO");
});

// ===== SERVER =====
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

  await bot.setWebHook(url);

  console.log("Webhook:", url);
});
