require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

//  Firebase
const serviceAccount = require('./firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

//  Bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// START
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, " SellForge com Firebase ativo!");
});

// SALVAR USUÁRIO
bot.on('message', async (msg) => {
  const userId = String(msg.from.id);

  await db.collection('users').doc(userId).set({
    nome: msg.from.first_name || "User",
    id: userId
  });

  console.log("Usuário salvo:", userId);
});