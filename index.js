require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mercadopago = require("mercadopago");

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
mercadopago.configure({
  access_token: process.env.MP_TOKEN
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

// ================= UTILS =================
function resetState(id){
  userState[id] = null;
}

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

// ================= PIX =================
async function criarPIX(valor, nome, userId){
  const payment = await mercadopago.payment.create({
    transaction_amount: Number(valor),
    description: nome,
    payment_method_id: "pix",
    payer: { email: `user${userId}@bot.com` }
  });

  return {
    id: payment.body.id,
    copia: payment.body.point_of_interaction.transaction_data.qr_code
  };
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

  if (!BOT_ATIVO && id !== MASTER) {
    return bot.sendMessage(msg.chat.id, "🚫 Bot desligado");
  }

  // RESET BUG FIX
  if (text.startsWith("/")) resetState(id);

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

    resetState(id);
    return bot.sendMessage(msg.chat.id, "✅ Cadastro concluído!\nDigite /start");
  }

  // ===== PRODUTOS =====
  if (text === "📦 Produtos") {
    const snap = await db.collection('produtos').get();
    if (snap.empty) return bot.sendMessage(msg.chat.id, "❌ Nenhum produto");

    for (const doc of snap.docs) {
      const p = doc.data();
      if (p.estoque <= 0) continue;

      await bot.sendPhoto(msg.chat.id, p.img, {
        caption: `📦 ${p.nome}\n💰 ${p.preco}\n\n📝 ${p.desc}\n📦 Estoque: ${p.estoque}`,
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Comprar", callback_data: `buy_${doc.id}` }]]
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

    resetState(id);
    return bot.sendMessage(msg.chat.id, "✅ Produto adicionado");
  }

});

// ================= COMPRA PIX =================
bot.on("callback_query", async (q) => {

  const idProduto = q.data.replace("buy_", "");
  const doc = await db.collection('produtos').doc(idProduto).get();
  const p = doc.data();

  if (!p || p.estoque <= 0)
    return bot.answerCallbackQuery(q.id, { text: "❌ Sem estoque" });

  const pix = await criarPIX(p.preco, p.nome, q.from.id);

  await db.collection('pagamentos').doc(String(pix.id)).set({
    user: String(q.from.id),
    produto: p.nome,
    preco: p.preco,
    status: "pendente"
  });

  bot.sendMessage(q.message.chat.id,
`💰 PAGAMENTO PIX

${p.nome}
Valor: R$${p.preco}

${pix.copia}

⏳ Aguardando pagamento...`);
});

// ================= WEBHOOK =================
app.post("/webhook/mp", async (req, res) => {

  try {
    const data = req.body;

    if (data.type === "payment") {

      const pagamento = await mercadopago.payment.findById(data.data.id);

      if (pagamento.body.status === "approved") {

        const id = String(pagamento.body.id);
        const doc = await db.collection('pagamentos').doc(id).get();

        if (doc.exists && doc.data().status !== "pago") {

          await db.collection('pagamentos').doc(id).update({ status: "pago" });

          bot.sendMessage(doc.data().user,
            "✅ PAGAMENTO APROVADO! Produto liberado 🚀");
        }
      }
    }

    res.sendStatus(200);

  } catch (e) {
    console.log(e);
    res.sendStatus(500);
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
/unban ID
/set_tempo ID tempo
/stats

👑 MASTER:
/desligar_bot
/ligar_bot`);
});

// ================= STATS =================
bot.onText(/\/stats/, async (msg) => {

  if (String(msg.from.id) !== MASTER) return;

  const snap = await db.collection('pagamentos')
    .where("status","==","pago").get();

  let total = 0;

  snap.forEach(d=>{
    total += Number(d.data().preco);
  });

  bot.sendMessage(msg.chat.id,
`📊 ESTATÍSTICAS

💰 Total: R$${total}
🧾 Pagamentos: ${snap.size}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;
  await bot.setWebHook(url);

  console.log("Webhook:", url);
});
