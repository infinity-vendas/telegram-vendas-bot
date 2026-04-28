require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// 🔐 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🤖 Bot SEM polling
const bot = new TelegramBot(process.env.BOT_TOKEN);

// 🔗 URL do Render
const url = process.env.RENDER_EXTERNAL_URL;

// 🚀 definir webhook
bot.setWebHook(`${url}/bot${process.env.BOT_TOKEN}`);

// 📩 receber mensagens
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// START
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🔥 SellForge rodando com Webhook!");
});

// salvar usuário
bot.on('message', async (msg) => {
  try {
    const userId = String(msg.from.id);

    await db.collection('users').doc(userId).set({
      nome: msg.from.first_name || "User",
      id: userId
    });

  } catch (err) {
    console.log(err);
  }
});

// 🌐 servidor
app.get('/', (req, res) => {
  res.send("Bot online 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando...");
});
