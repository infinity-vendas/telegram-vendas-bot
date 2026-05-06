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

// ================= ESTADO =================
const userState = {};
const LOGO = "https://i.postimg.cc/g2JJvqHN/logo.jpg";

// ================= WEBHOOK MP =================
app.post('/webhook/mp', async (req, res) => {
  try {
    const data = req.body;

    if (data.type === "payment") {
      const payment = await mpPayment.get({ id: data.data.id });

      if (payment.status === "approved") {

        const venda = await db.collection('pagamentos').doc(String(payment.id)).get();
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
  bot.sendMessage(msg.chat.id, "📦 Nome do produto:");
});

// ================= DEL PRODUTO =================
bot.onText(/\/del_produto (.+)/, async (msg, m) => {
  const id = String(msg.from.id);
  if (id !== MASTER && !ADMINS.includes(id)) return;

  await db.collection('produtos').doc(m[1]).delete();
  bot.sendMessage(msg.chat.id, "🗑 Produto deletado");
});

// ================= BOT ON/OFF =================
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

// ================= MESSAGE GLOBAL =================
bot.on("message", async (msg) => {

  if (!msg.text) return;

  const id = String(msg.from.id);
  const text = msg.text;
  const state = userState[id];

  console.log("MSG:", text);

  // Reset estado ao usar comando
  if (text.startsWith("/")) {
    userState[id] = null;
  }

  if (!BOT_ATIVO && id !== MASTER) {
    return bot.sendMessage(msg.chat.id, "🚫 Bot temporariamente desligado");
  }

  // ===== FLUXO ADD PRODUTO =====
  if (state?.step === "nome") {
    state.nome = text;
    state.step = "preco";
    return bot.sendMessage(msg.chat.id, "💰 Valor:");
  }

  if (state?.step === "preco") {
    state.preco = text;
    state.step = "desc";
    return bot.sendMessage(msg.chat.id, "📝 Descrição:");
  }

  if (state?.step === "desc") {
    state.desc = text;
    state.step = "img";
    return bot.sendMessage(msg.chat.id, "🖼️ Link imagem:");
  }

  if (state?.step === "img") {
    state.img = text;
    state.step = "zap";
    return bot.sendMessage(msg.chat.id, "📲 WhatsApp:");
  }

  if (state?.step === "zap") {

    await db.collection('produtos').add({
      nome: state.nome,
      preco: state.preco,
      desc: state.desc,
      img: state.img,
      whatsapp: text,
      criadoPor: id
    });

    userState[id] = null;
    return bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
  }

  // ===== MENU =====
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
});

// ================= PIX =================
bot.on("callback_query", async (q) => {

  bot.answerCallbackQuery(q.id);

  const idProduto = q.data.replace("buy_", "");
  const doc = await db.collection('produtos').doc(idProduto).get();
  const p = doc.data();

  if (!p) {
    return bot.sendMessage(q.message.chat.id, "❌ Produto não encontrado");
  }

  const payment = await mpPayment.create({
    body: {
      transaction_amount: Number(p.preco),
      description: p.nome,
      payment_method_id: "pix",
      payer: { email: "cliente@email.com" }
    }
  });

  const qr = payment.point_of_interaction.transaction_data.qr_code_base64;
  const copia = payment.point_of_interaction.transaction_data.qr_code;

  await db.collection('pagamentos').doc(String(payment.id)).set({
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

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;
  await bot.setWebHook(url);

  console.log("Webhook:", url);
});
