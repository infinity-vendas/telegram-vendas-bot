const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const axios = require("axios");

// ================= CONFIG =================
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const MP_TOKEN = "APP_USR-4934588586838432-XXXXXXXX-241983636";

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

// ================= WEBHOOK TELEGRAM =================
app.post("/webhook", (req, res) => {
  try {
    bot.processUpdate(req.body);
  } catch (e) {
    console.log("Telegram error:", e.message);
  }
  res.sendStatus(200);
});

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);

  const userRef = db.collection("users").doc(id);
  const userDoc = await userRef.get();

  const TEXT = `
Bem-vindo à INFINITY CLIENTES 🚀

Aqui você encontra serviços, produtos e acesso VIP.

Sistema automatizado e seguro.
`;

  if (!userDoc.exists) {
    await userRef.set({
      id,
      vip: false,
      criadoEm: Date.now()
    });

    return bot.sendMessage(msg.chat.id, TEXT + "\n\nDigite /comprar para acessar VIP.");
  }

  bot.sendMessage(msg.chat.id, TEXT + "\n\nUse /comprar ou /status");
});

// ================= STATUS =================
bot.onText(/\/status/, async (msg) => {

  const id = String(msg.from.id);
  const user = await db.collection("users").doc(id).get();

  if (!user.exists) return;

  bot.sendMessage(msg.chat.id, `
👤 ID: ${id}
⭐ VIP: ${user.data().vip ? "SIM" : "NÃO"}
`);
});

// ================= PAGAMENTO CORRETO =================
bot.onText(/\/comprar/, async (msg) => {

  const userId = String(msg.from.id);

  try {

    const response = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      {
        items: [
          {
            title: "Plano VIP",
            quantity: 1,
            currency_id: "BRL",
            unit_price: 30
          }
        ],
        payer: {
          email: "cliente@infinity.com"
        },
        metadata: {
          user_id: userId
        },
        notification_url: `${URL}/mp-webhook`,
        auto_return: "approved"
      },
      {
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`
        }
      }
    );

    const link = response.data.init_point;

    bot.sendMessage(msg.chat.id, `
💰 PAGAMENTO GERADO

🔗 Pague aqui:
${link}

Após pagamento, VIP é liberado automaticamente 🚀
`);

  } catch (err) {
    console.log(err.response?.data || err.message);
    bot.sendMessage(msg.chat.id, "❌ Erro ao gerar pagamento");
  }
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
          Authorization: `Bearer ${MP_TOKEN}`
        }
      }
    );

    const payment = response.data;

    if (payment.status !== "approved") return res.sendStatus(200);

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

  } catch (err) {
    console.log("MP error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  await bot.setWebHook(`${URL}/webhook`);

  console.log("🚀 BOT ONLINE COM PAGAMENTO FUNCIONANDO");
});
