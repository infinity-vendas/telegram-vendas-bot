require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ✅ Mercado Pago NOVO
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

// ================= WEBHOOK MERCADO PAGO =================
app.post('/webhook/mp', async (req, res) => {
  try {
    const data = req.body;

    if (data.type === "payment") {
      const paymentId = data.data.id;

      const payment = new Payment(mpClient);
      const result = await payment.get({ id: paymentId });

      if (result.status === "approved") {

        console.log("💰 PAGAMENTO APROVADO:", result.transaction_amount);

        // 🔥 procura no banco
        const snap = await db.collection('pagamentos')
          .where("paymentId", "==", paymentId)
          .get();

        snap.forEach(async doc => {
          const d = doc.data();

          // marca como pago
          await doc.ref.update({ status: "pago" });

          // envia confirmação
          bot.sendMessage(d.chatId,
`✅ PAGAMENTO CONFIRMADO!

Produto: ${d.produto}
Valor: R$${d.valor}

🎉 Obrigado pela compra!`);
        });
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("Erro webhook:", err.message);
    res.sendStatus(500);
  }
});

// ================= ESTADO =================
const userState = {};
const LOGO = "https://i.postimg.cc/g2JJvqHN/logo.jpg";

function limparState(id) {
  if (userState[id]) delete userState[id];
}

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

  // 🔥 MENSAGEM ORIGINAL (INTACTA)
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

  if (!BOT_ATIVO && id !== MASTER) {
    return bot.sendMessage(msg.chat.id, "🚫 Bot temporariamente desligado");
  }

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

  // ===== PRODUTOS =====
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
});

// ================= COMPRA PIX =================
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

  // salva pagamento
  await db.collection('pagamentos').add({
    paymentId: result.id,
    chatId: q.message.chat.id,
    produto: p.nome,
    valor: p.preco,
    status: "pendente"
  });

  const pix = result.point_of_interaction.transaction_data.qr_code;

  bot.sendMessage(q.message.chat.id,
`💸 PAGAMENTO PIX

Produto: ${p.nome}
Valor: R$${p.preco}

🔑 Copie o código PIX:

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

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;
