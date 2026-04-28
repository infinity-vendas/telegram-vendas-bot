require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

// 🔐 Firebase via variável de ambiente (Render)
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🤖 Bot Telegram
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// 🚀 START
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🔥 SellForge online com Firebase!");
});

// 💾 Salvar usuário automaticamente
bot.on('message', async (msg) => {
  try {
    const userId = String(msg.from.id);

    await db.collection('users').doc(userId).set({
      nome: msg.from.first_name || "User",
      id: userId,
      data: new Date()
    });

    console.log("Usuário salvo:", userId);

  } catch (error) {
    console.error("Erro ao salvar usuário:", error);
  }
});
