const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const axios = require("axios");

// ================= CONFIG =================
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const MP_TOKEN = "APP_USR-5364485461402569-042206-d7728868cf6e70a9f34584e0584fdb22-2339435531";

const ADMINS = ["6863505946"];

// ================= FIREBASE =================
const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ================= BOT =================
const bot = new TelegramBot(TOKEN, { webHook: true });

const app = express();
app.use(express.json());

// ================= TELEGRAM WEBHOOK =================
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ================= MERCADO PAGO WEBHOOK =================
app.post("/mp-webhook", async (req, res) => {

  try {

    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${MP_TOKEN}` }
      }
    );

    const payment = response.data;

    console.log("STATUS:", payment.status);

    if (payment.status === "approved") {

      const userId = payment.metadata?.user_id;
      const produtoId = payment.metadata?.produto_id;

      if (!userId || !produtoId) return res.sendStatus(200);

      const ref = db.collection("produtos").doc(produtoId);
      const doc = await ref.get();

      if (!doc.exists) return res.sendStatus(200);

      const produto = doc.data();

      const novoEstoque = Math.max(0, Number(produto.estoque) - 1);

      await ref.update({
        estoque: novoEstoque
      });

      bot.sendMessage(userId, `
✅ PAGAMENTO APROVADO!

📦 Produto: ${produto.nome}

🔗 Acesse seu produto:
${produto.link}

Obrigado pela compra!
`);

    }

  } catch (err) {
    console.log("ERRO WEBHOOK:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// ================= UTILS =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";

  const TEXTO = `Bem-vindo à INFINITY CLIENTES!

Sistema automatizado com entrega instantânea.`;

  bot.sendPhoto(msg.chat.id, LOGO);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, TEXTO);
  }, 3000);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, menuUser());
  }, 6000);
});

// ================= MENU =================
function menuUser() {
  return `
📦 MENU

/produtos
/id
/status
/admin
`;
}

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Sem produtos.");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `
📦 ${p.nome}
💰 R$ ${p.valor}
📦 Estoque: ${p.estoque}

👉 /comprar_${doc.id}
`);
  });
});

// ================= COMPRA PIX =================
bot.onText(/\/comprar_(.+)/, async (msg, match) => {

  const idProduto = match[1];
  const userId = String(msg.from.id);

  const doc = await db.collection("produtos").doc(idProduto).get();
  if (!doc.exists) return;

  const p = doc.data();

  // 🔥 CORREÇÃO DO VALOR
  const valor = Number(String(p.valor).replace(",", "."));

  if (!valor || isNaN(valor) || valor <= 0) {
    return bot.sendMessage(msg.chat.id, "❌ Valor inválido.");
  }

  try {

    const pagamento = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: valor,
        description: p.nome,
        payment_method_id: "pix",
        payer: {
          email: "github.script.oficial@gmail.com" // 🔥 COLOQUE SEU EMAIL AQUI
        },
        metadata: {
          user_id: userId,
          produto_id: idProduto
        },
        notification_url: `${URL}/mp-webhook`
      },
      {
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`
        }
      }
    );

    const data = pagamento.data;

    const qr = data.point_of_interaction.transaction_data.qr_code_base64;
    const copia = data.point_of_interaction.transaction_data.qr_code;

    const buffer = Buffer.from(qr, "base64");

    await bot.sendPhoto(msg.chat.id, buffer, {
      caption: `
💰 PAGAMENTO PIX

📦 ${p.nome}
💰 R$ ${valor}

📋 Copia e cola:
${copia}

⚡ Pagamento automático!
`
    });

  } catch (err) {
    console.log("ERRO PIX DETALHADO:", err.response?.data || err.message);

    bot.sendMessage(msg.chat.id, "❌ Erro ao gerar PIX.");
  }
});

// ================= ADMIN =================
bot.onText(/\/admin/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙️ ADMIN

/adicionar
/deletar_produto ID
/alterar_estoque ID VALOR
`);
});

// ================= CADASTRO =================
const adminState = {};

bot.onText(/\/adicionar/, (msg) => {
  if (!isAdmin(msg.from.id)) return;

  adminState[msg.from.id] = { step: "produto" };
  bot.sendMessage(msg.chat.id, "Produto:");
});

bot.on("message", async (msg) => {

  const id = msg.from.id;
  const s = adminState[id];
  if (!s || !isAdmin(id)) return;

  const t = msg.text;

  if (s.step === "produto") {
    s.nome = t;
    s.step = "valor";
    return bot.sendMessage(id, "Valor:");
  }

  if (s.step === "valor") {
    s.valor = t;
    s.step = "descricao";
    return bot.sendMessage(id, "Descrição:");
  }

  if (s.step === "descricao") {
    s.descricao = t;
    s.step = "whatsapp";
    return bot.sendMessage(id, "WhatsApp:");
  }

  if (s.step === "whatsapp") {
    s.whatsapp = t;
    s.step = "estoque";
    return bot.sendMessage(id, "Estoque:");
  }

  if (s.step === "estoque") {
    s.estoque = t;
    s.step = "link";
    return bot.sendMessage(id, "Link produto:");
  }

  if (s.step === "link") {

    await db.collection("produtos").add({
      nome: s.nome,
      valor: Number(String(s.valor).replace(",", ".")), // 🔥 CORREÇÃO
      descricao: s.descricao,
      whatsapp: s.whatsapp,
      estoque: Number(s.estoque),
      link: t,
      criadoEm: Date.now()
    });

    delete adminState[id];

    bot.sendMessage(id, "✅ Produto cadastrado!");
  }
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT 100% AUTOMÁTICO");
});
