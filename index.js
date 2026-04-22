const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");
const axios = require("axios");

// ===== CONFIG =====
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const MP_TOKEN = "APP_USR-4934588586838432-XXXXXXXX-241983636";

const ADMINS = ["6863505946"];

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

// ================= WEBHOOK TELEGRAM =================
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ================= WEBHOOK MERCADO PAGO =================
app.post("/mp-webhook", async (req, res) => {

  try {
    const paymentId = req.body.data.id;

    const payment = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${MP_TOKEN}` }
      }
    );

    const data = payment.data;

    if (data.status === "approved") {

      const userId = data.metadata.user_id;

      await db.collection("users").doc(userId).update({
        vip: true
      });

      bot.sendMessage(userId, "✅ Pagamento aprovado! VIP liberado!");
    }

  } catch (err) {
    console.log("Erro MP:", err.message);
  }

  res.sendStatus(200);
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
          email: "cliente@email.com"
        },
        metadata: {
          user_id: userId
        }
      },
      {
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`
        }
      }
    );

    const link = payment.data.point_of_interaction.transaction_data.ticket_url;

    bot.sendMessage(msg.chat.id, `
💰 PAGAMENTO GERADO

Pague aqui:
${link}

Após pagamento, liberação automática 🚀
`);

  } catch (err) {
    bot.sendMessage(msg.chat.id, "❌ Erro ao gerar pagamento");
  }
});

// ================= RESTO DO SEU BOT =================

// (mantém tudo igual ao seu código atual aqui)

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  await bot.setWebHook(`${URL}/webhook`);

  console.log("🚀 BOT COM PAGAMENTO ONLINE");
});
