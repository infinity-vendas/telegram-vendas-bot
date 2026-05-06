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

// ================= MERCADO PAGO (NOVO SDK) =================
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

// ================= WEBHOOK =================
app.post('/webhook/mp', async (req, res) => {
  try {
    const data = req.body;

    console.log("📥 Webhook:", data);

    if (data.type === "payment") {

      const paymentId = data.data.id;

      const payment = await mpPayment.get({ id: paymentId });

      if (payment.status === "approved") {

        console.log("✅ PAGAMENTO APROVADO");

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
bot.onText(/\/start/, async (msg) => {

  if (!BOT_ATIVO) return;

  const chatId = msg.chat.id;
  const id = String(msg.from.id);

  await bot.sendPhoto(chatId, LOGO);

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

// ================= PRODUTOS =================
bot.onText(/📦 Produtos/, async (msg) => {

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

👑 MASTER:
/desligar_bot
/ligar_bot`);
});

// ================= ADD PRODUTO =================
bot.onText(/\/add_produto/, (msg) => {

  const id = String(msg.from.id);
  if (id !== MASTER && !ADMINS.includes(id)) return;

  userState[id] = { step: "nome" };
  bot.sendMessage(msg.chat.id, "Nome do produto:");
});

bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const state = userState[id];

  if (!state) return;

  if (state.step === "nome") {
    state.nome = msg.text;
    state.step = "preco";
    return bot.sendMessage(msg.chat.id, "Preço:");
  }

  if (state.step === "preco") {
    state.preco = msg.text;
    state.step = "desc";
    return bot.sendMessage(msg.chat.id, "Descrição:");
  }

  if (state.step === "desc") {
    state.desc = msg.text;
    state.step = "img";
    return bot.sendMessage(msg.chat.id, "Link da imagem:");
  }

  if (state.step === "img") {
    state.img = msg.text;
    state.step = "zap";
    return bot.sendMessage(msg.chat.id, "WhatsApp:");
  }

  if (state.step === "zap") {

    await db.collection('produtos').add({
      nome: state.nome,
      preco: state.preco,
      desc: state.desc,
      img: state.img,
      whatsapp: msg.text
    });

    userState[id] = null;
    bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
  }
});

// ================= LIGAR/DESLIGAR =================
bot.onText(/\/desligar_bot/, (msg) => {

  if (String(msg.from.id) !== MASTER) {
    return bot.sendMessage(msg.chat.id,
"🚫 Sem autorização\nContate dono oficial +55 51 981528372");
  }

  BOT_ATIVO = false;
  bot.sendMessage(msg.chat.id, "🔴 BOT DESLIGADO");
});

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
