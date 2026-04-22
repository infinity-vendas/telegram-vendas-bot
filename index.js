const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const axios = require("axios");

// ===== CONFIG =====
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const MP_TOKEN = "APP_USR-4934588586838432-XXXXXXXX-241983636";

const ADMINS = ["6863505946"];

// ===== IMAGEM =====
const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";

// ===== FIREBASE =====
const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ===== BOT =====
const bot = new TelegramBot(TOKEN, { webHook: true });

const app = express();
app.use(express.json());

// ================= TELEGRAM WEBHOOK =================
app.post("/webhook", (req, res) => {
  try {
    bot.processUpdate(req.body);
  } catch (e) {
    console.log("Erro Telegram:", e.message);
  }
  res.sendStatus(200);
});

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);

  try {

    const userRef = db.collection("users").doc(id);
    const userDoc = await userRef.get();

    bot.sendPhoto(msg.chat.id, LOGO);

    const TEXTO = `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!

Aqui você encontra um ambiente totalmente estruturado, com atendimento rápido, organizado e seguro.

INFINITY CLIENTES – confiança, organização e resultado em um só lugar 🚀
`;

    // NOVO USUÁRIO
    if (!userDoc.exists) {

      await userRef.set({
        id,
        criadoEm: Date.now(),
        vip: false
      });

      return setTimeout(() => {
        bot.sendMessage(msg.chat.id, TEXTO + "\n\n✅ Cadastro automático concluído!");
      }, 2000);
    }

    // USUÁRIO EXISTENTE
    setTimeout(() => {
      bot.sendMessage(msg.chat.id, TEXTO);
    }, 2000);

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, `
📦 MENU PRINCIPAL

/comprar - Comprar VIP
/status - Ver status
`);
    }, 4000);

  } catch (err) {
    console.log("Erro /start:", err.message);
  }
});

// ================= STATUS =================
bot.onText(/\/status/, async (msg) => {

  const id = String(msg.from.id);

  const user = await db.collection("users").doc(id).get();

  if (!user.exists) {
    return bot.sendMessage(msg.chat.id, "❌ Faça /start primeiro");
  }

  const data = user.data();

  bot.sendMessage(msg.chat.id, `
👤 ID: ${id}
⭐ VIP: ${data.vip ? "SIM" : "NÃO"}
`);
});

// ================= GERAR PAGAMENTO =================
bot.onText(/\/comprar/, async (msg) => {

  const userId = String(msg.from.id);

  try {

    const payment = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: 30,
        description: "Plano VIP",
        payment_method_id: "pix",
        payer: {
          email: `user${userId}@teste.com`
        },
        metadata: {
          user_id: userId
        },
        notification_url: `${URL}/mp-webhook`
      },
      {
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const link =
      payment.data?.point_of_interaction?.transaction_data?.ticket_url;

    if (!link) {
      return bot.sendMessage(msg.chat.id, "❌ Erro ao gerar PIX");
    }

    bot.sendMessage(msg.chat.id, `
💰 PAGAMENTO GERADO

🔗 Pague aqui:
${link}

⏳ Após pagamento, liberação automática 🚀
`);

  } catch (err) {
    console.log("Erro pagamento:", err.response?.data || err.message);
    bot.sendMessage(msg.chat.id, "❌ Erro ao gerar pagamento");
  }
});

// ================= WEBHOOK MERCADO PAGO =================
app.post("/mp-webhook", async (req, res) => {

  try {

    const type = req.body?.type;
    const paymentId = req.body?.data?.id || req.query?.id;

    if (type !== "payment" || !paymentId) {
      return res.sendStatus(200);
    }

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`
        }
      }
    );

    const payment = response.data;

    if (payment.status !== "approved") {
      return res.sendStatus(200);
    }

    const userId = payment.metadata?.user_id;

    if (!userId) return res.sendStatus(200);

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return res.sendStatus(200);

    if (userDoc.data().vip === true) return res.sendStatus(200);

    await userRef.update({
      vip: true,
      pagoEm: Date.now()
    });

    bot.sendMessage(userId, "✅ Pagamento aprovado! VIP liberado 🚀");

    console.log("VIP liberado:", userId);

  } catch (err) {
    console.log("Erro MP:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// ================= ADMIN =================
bot.onText(/\/admin/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  bot.sendMessage(msg.chat.id, `
⚙ PAINEL ADMIN

/ids - listar usuários
/vip ID - dar VIP
/removervip ID - remover VIP
`);
});

// LISTAR IDS
bot.onText(/\/ids/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const snap = await db.collection("users").get();

  let txt = "🆔 IDS:\n\n";

  snap.forEach(u => {
    txt += `${u.id}\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// DAR VIP
bot.onText(/\/vip (.+)/, async (msg, match) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  await db.collection("users").doc(match[1]).update({ vip: true });

  bot.sendMessage(msg.chat.id, "✅ VIP aplicado");
});

// REMOVER VIP
bot.onText(/\/removervip (.+)/, async (msg, match) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  await db.collection("users").doc(match[1]).update({ vip: false });

  bot.sendMessage(msg.chat.id, "❌ VIP removido");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  await bot.setWebHook(`${URL}/webhook`);

  console.log("🚀 BOT FINAL ONLINE COM PAGAMENTO");
});
