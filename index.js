const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const axios = require("axios");

// ================= CONFIG =================
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const MP_TOKEN = "APP_USR-4934588586838432-XXXXXXXX-241983636";
const URL = "https://seu-app.onrender.com";

// ================= FIREBASE =================
const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ================= BOT =================
const bot = new TelegramBot(TOKEN);
const app = express();
app.use(express.json());

// ================= LOGO =================
const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";

// ================= MEMÓRIA =================
const cadastro = {};
const adminState = {};
const iaTimer = {};

// ================= ADMIN =================
const ADMINS = ["6863505946"];

function isAdmin(id) {
  return ADMINS.includes(String(id));
}

// ================= CHECK USER =================
async function isRegistered(id) {
  const doc = await db.collection("users").doc(id).get();
  return doc.exists;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const user = await db.collection("users").doc(id).get();

  bot.sendPhoto(msg.chat.id, LOGO);

  const TEXTO = `
Bem-vindo à INFINITY CLIENTES 🚀
Seu sistema de serviços e produtos.

Digite seu nome para continuar:
`;

  if (!user.exists) {
    cadastro[id] = { step: "nome" };

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, TEXTO);
    }, 2000);

    return;
  }

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, menu());
  }, 2000);

  iniciarIA(msg.chat.id);
});

// ================= CADASTRO =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  if (cadastro[id]) {

    if (cadastro[id].step === "nome") {
      cadastro[id].nome = text;
      cadastro[id].step = "whatsapp";
      return bot.sendMessage(msg.chat.id, "📱 WhatsApp:");
    }

    if (cadastro[id].step === "whatsapp") {
      cadastro[id].whatsapp = text;
      cadastro[id].step = "instagram";
      return bot.sendMessage(msg.chat.id, "📸 Instagram:");
    }

    if (cadastro[id].step === "instagram") {

      await db.collection("users").doc(id).set({
        id,
        nome: cadastro[id].nome,
        whatsapp: cadastro[id].whatsapp,
        instagram: text,
        vip: false,
        criadoEm: Date.now()
      });

      delete cadastro[id];

      bot.sendMessage(msg.chat.id, "✅ Cadastro concluído!");
      setTimeout(() => bot.sendMessage(msg.chat.id, menu()), 2000);

      iniciarIA(msg.chat.id);
    }
  }

  // ================= ADMIN ADD PRODUTO =================
  if (adminState[id] && isAdmin(id)) {

    const s = adminState[id];

    if (s.step === "nome") {
      s.nome = text;
      s.step = "valor";
      return bot.sendMessage(id, "💰 Valor:");
    }

    if (s.step === "valor") {
      s.valor = text;
      s.step = "descricao";
      return bot.sendMessage(id, "📝 Descrição:");
    }

    if (s.step === "descricao") {
      s.descricao = text;
      s.step = "vendedor";
      return bot.sendMessage(id, "👤 Vendedor:");
    }

    if (s.step === "vendedor") {
      s.vendedor = text;
      s.step = "contato";
      return bot.sendMessage(id, "📲 WhatsApp:");
    }

    if (s.step === "contato") {

      await db.collection("produtos").add({
        nome: s.nome,
        valor: s.valor,
        descricao: s.descricao,
        vendedor: s.vendedor,
        whatsapp: text,
        criadoEm: Date.now()
      });

      delete adminState[id];

      return bot.sendMessage(id, "✅ Produto cadastrado!");
    }
  }
});

// ================= MENU =================
function menu() {
  return `
📦 MENU

/produtos
/vip
/comprar
/me
/suporte
`;
}

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "Sem produtos.");
  }

  let txt = "📦 PRODUTOS:\n\n";

  snap.forEach(p => {
    const d = p.data();
    txt += `• ${d.nome} - R$ ${d.valor}\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// ================= VIP =================
bot.onText(/\/vip/, async (msg) => {

  const doc = await db.collection("users").doc(String(msg.from.id)).get();

  if (!doc.exists) return;

  const vip = doc.data().vip;

  bot.sendMessage(msg.chat.id, vip ? "🔥 Você é VIP" : "❌ Não é VIP");
});

// ================= PAGAMENTO =================
bot.onText(/\/comprar/, async (msg) => {

  const link = await criarPagamento(msg.chat.id, 30, "VIP INFINITY CLIENTES");

  if (!link) {
    return bot.sendMessage(msg.chat.id, "Erro ao gerar pagamento.");
  }

  bot.sendMessage(msg.chat.id, `
💳 PAGAMENTO GERADO

${link}
`);
});

// ================= MERCADO PAGO =================
async function criarPagamento(chatId, valor, descricao) {

  try {

    const res = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      {
        items: [{
          title: descricao,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(valor)
        }],
        metadata: {
          chat_id: String(chatId)
        },
        notification_url: `${URL}/webhook-mp`
      },
      {
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`
        }
      }
    );

    return res.data.init_point;

  } catch (e) {
    console.log(e.message);
    return null;
  }
}

// ================= WEBHOOK MP =================
app.post("/webhook-mp", async (req, res) => {

  try {

    const payment = req.body;

    if (payment.type === "payment") {

      const id = payment.data.id;

      const info = await axios.get(
        `https://api.mercadopago.com/v1/payments/${id}`,
        {
          headers: {
            Authorization: `Bearer ${MP_TOKEN}`
          }
        }
      );

      const data = info.data;

      if (data.status === "approved") {

        const chatId = data.metadata.chat_id;

        await db.collection("users").doc(String(chatId)).set({
          vip: true
        }, { merge: true });

        bot.sendMessage(chatId, "✅ Pagamento aprovado! VIP liberado.");
      }
    }

  } catch (e) {
    console.log("MP ERROR:", e.message);
  }

  res.sendStatus(200);
});

// ================= SUPORTE =================
bot.onText(/\/suporte/, (msg) => {
  bot.sendMessage(msg.chat.id, "📲 Suporte ativo 24h");
});

// ================= IA =================
function iniciarIA(chatId) {

  if (iaTimer[chatId]) return;

  iaTimer[chatId] = setInterval(() => {
    bot.sendMessage(chatId, "🤖 Precisa de ajuda? Use /suporte");
  }, 60000);
}

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT COMPLETO ONLINE");
});
