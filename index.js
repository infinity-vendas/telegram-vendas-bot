require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const { MercadoPagoConfig, Payment } = require('mercadopago');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

const mpPayment = new Payment(mpClient);

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

const userState = {};
const LOGO = "https://i.postimg.cc/g2JJvqHN/logo.jpg";

// ================= WEBHOOK MP =================
app.post('/webhook/mp', async (req, res) => {
  try {
    const data = req.body;

    if (data.type === "payment") {

      const paymentId = data.data.id;
      const payment = await mpPayment.get({ id: paymentId });

      if (payment.status === "approved") {

        const venda = await db.collection('pagamentos').doc(String(paymentId)).get();
        if (!venda.exists) return res.sendStatus(200);

        const info = venda.data();

        await bot.sendMessage(info.chatId,
`✅ Pagamento aprovado!

📦 Produto: ${info.produto}
💰 Valor: R$ ${info.valor}

📲 Finalize aqui:
https://wa.me/${info.whatsapp}`);
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("❌ ERRO WEBHOOK:", err);
    res.sendStatus(500);
  }
});

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

// ================= MESSAGE GLOBAL (ÚNICO) =================
bot.on("message", async (msg) => {

  if (!msg.text) return;

  const id = String(msg.from.id);
  const text = msg.text;
  const state = userState[id];

  if (!BOT_ATIVO && id !== MASTER) {
    return bot.sendMessage(msg.chat.id, "🚫 Bot temporariamente desligado");
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
    return bot.sendMessage(msg.chat.id, "✅ Cadastro concluído!\nDigite /start");
  }

  // ===== PRODUTOS =====
  if (text === "📦 Produtos") {

    const snap = await db.collection('produtos').get();

    if (snap.empty)
      return bot.sendMessage(msg.chat.id, "❌ Nenhum produto");

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
            callback_data: `buy_${doc.id}`
          }]]
        }
      });
    }
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

// ================= COMPRA PIX =================
bot.on("callback_query", async (q) => {

  const idProduto = q.data.replace("buy_", "");
  const doc = await db.collection('produtos').doc(idProduto).get();
  const p = doc.data();

  const payment = await mpPayment.create({
    body: {
      transaction_amount: Number(p.preco),
      description: p.nome,
      payment_method_id: "pix",
      payer: {
        email: "cliente@email.com"
      }
    }
  });

  const qr = payment.point_of_interaction.transaction_data.qr_code_base64;
  const copia = payment.point_of_interaction.transaction_data.qr_code;
  const paymentId = payment.id;

  await db.collection('pagamentos').doc(String(paymentId)).set({
    chatId: q.message.chat.id,
    produto: p.nome,
    valor: p.preco,
    whatsapp: p.whatsapp
  });

  bot.sendPhoto(q.message.chat.id, Buffer.from(qr, 'base64'), {
    caption:
`💰 PAGAMENTO PIX

📦 ${p.nome}
💲 R$ ${p.preco}

📋 Copia e Cola:
${copia}

⏳ Aguardando pagamento...`
  });

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

👑 MASTER:
/desligar_bot
/ligar_bot`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;
  await bot.setWebHook(url);

  console.log("Webhook:", url);
});
