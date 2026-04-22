const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const axios = require("axios");

// ================= CONFIG =================
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

// 💰 MERCADO PAGO (SUA CHAVE AQUI)
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

// ================= FUNÇÃO MP (SEGURANÇA / PADRÃO) =================
function getMPToken() {
  return MP_TOKEN;
}

// ================= WEBHOOK TELEGRAM =================
app.post("/webhook", (req, res) => {
  try {
    bot.processUpdate(req.body);
  } catch (e) {
    console.log("Erro webhook:", e.message);
  }
  res.sendStatus(200);
});

// ================= WEBHOOK MERCADO PAGO =================
app.post("/mp-webhook", async (req, res) => {

  try {

    const paymentId = req.body?.data?.id;

    if (!paymentId) return res.sendStatus(200);

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${getMPToken()}`
        }
      }
    );

    const payment = response.data;

    console.log("Pagamento status:", payment.status);

    if (payment.status === "approved") {

      const userId = payment.metadata?.user_id;

      if (!userId) return res.sendStatus(200);

      await db.collection("users").doc(userId).update({
        vip: true
      });

      bot.sendMessage(userId, "✅ Pagamento aprovado! VIP liberado automaticamente!");
    }

  } catch (err) {
    console.log("MP webhook erro:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// ================= MEMÓRIA =================
const cadastro = {};
const adminState = {};
const iaTimer = {};

// ================= UTIL =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

// ================= START (SEU PADRÃO MANTIDO) =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const user = await db.collection("users").doc(id).get();

  const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";

  const TEXTO = `
Bem-vindo à INFINITY CLIENTES!

Sistema automatizado de serviços e produtos.

Organização, suporte e entrega rápida.
`;

  bot.sendPhoto(msg.chat.id, LOGO);

  if (!user.exists) {

    cadastro[id] = { step: "nome" };

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, TEXTO + "\n\nDigite seu nome:");
    }, 2000);

    return;
  }

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, TEXTO);
  }, 2000);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, menuUser());
  }, 4000);

  iniciarIA(msg.chat.id);
});

// ================= CADASTRO (PROTEGIDO) =================
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
        criadoEm: Date.now(),
        vip: false
      });

      delete cadastro[id];

      bot.sendMessage(msg.chat.id, "✅ Cadastro concluído!");

      setTimeout(() => {
        bot.sendMessage(msg.chat.id, menuUser());
      }, 2000);

      iniciarIA(msg.chat.id);
    }
  }

  // ================= ADMIN PRODUTO =================
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
      s.step = "instagram";
      return bot.sendMessage(id, "📸 Instagram:");
    }

    if (s.step === "instagram") {
      s.instagram = text;
      s.step = "youtube";
      return bot.sendMessage(id, "📺 YouTube:");
    }

    if (s.step === "youtube") {
      s.youtube = text;
      s.step = "whatsapp";
      return bot.sendMessage(id, "📲 WhatsApp:");
    }

    if (s.step === "whatsapp") {

      await db.collection("produtos").add({
        nome: s.nome,
        valor: s.valor,
        descricao: s.descricao,
        vendedor: s.vendedor,
        instagram: s.instagram,
        youtube: s.youtube,
        whatsapp: s.whatsapp,
        criadoEm: Date.now()
      });

      delete adminState[id];

      return bot.sendMessage(id, "✅ Produto cadastrado com sucesso!");
    }
  }
});

// ================= MENU =================
function menuUser() {
  return `
📦 MENU PRINCIPAL

/produtos
/clientes_premium
/administradores
/suporte
/status
/comprar
/admin
`;
}

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "Sem produtos cadastrados.");
  }

  snap.forEach(p => {
    const d = p.data();

    bot.sendMessage(msg.chat.id, `
📦 ${d.nome}
💰 R$ ${d.valor}

📝 ${d.descricao}

👤 ${d.vendedor}
📲 ${d.whatsapp}
`);
  });
});

// ================= 💰 PAGAMENTO =================
bot.onText(/\/comprar/, async (msg) => {

  const userId = String(msg.from.id);

  try {

    const pagamento = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      {
        items: [
          {
            title: "Plano VIP INFINITY CLIENTES",
            quantity: 1,
            currency_id: "BRL",
            unit_price: 30
          }
        ],
        metadata: {
          user_id: userId
        },
        notification_url: `${URL}/mp-webhook`
      },
      {
        headers: {
          Authorization: `Bearer ${getMPToken()}`
        }
      }
    );

    const link = pagamento.data.init_point;

    bot.sendMessage(msg.chat.id, `
💰 PAGAMENTO GERADO

🔗 ${link}

Após pagamento você receberá VIP automático.
`);

  } catch (err) {
    console.log("Erro pagamento:", err.response?.data || err.message);
    bot.sendMessage(msg.chat.id, "❌ Erro ao gerar pagamento");
  }
});

// ================= ADMIN =================
bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙ PAINEL ADMIN

/addproduto
/delprodutos
/deluser ID
/ids
/vip ID
/removervip ID
`);
});

// ================= SUPORTE =================
bot.onText(/\/suporte/, (msg) => {
  bot.sendMessage(msg.chat.id, "📞 Suporte: https://wa.me/5551981528372");
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ Sistema online");
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
  console.log("🚀 BOT COMPLETO COM MERCADO PAGO ONLINE");
});
