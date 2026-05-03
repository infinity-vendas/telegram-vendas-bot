require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
app.use(express.json());

// CONFIG
const ADMIN_ID = "6863505946";

// ================= FIREBASE =================
let db = null;

try {
  if (!process.env.FIREBASE_CONFIG) throw new Error("Sem Firebase");

  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  initializeApp({
    credential: cert(serviceAccount)
  });

  db = getFirestore();
  console.log("🔥 Firebase conectado");

} catch (e) {
  console.log("⚠️ Firebase erro:", e.message);
}

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: true
});

const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;

// ================= WEBHOOK =================
app.post(SECRET_PATH, (req, res) => {
  res.sendStatus(200);
  try {
    bot.processUpdate(req.body);
  } catch (e) {
    console.error("Erro webhook:", e);
  }
});

app.get('/', (req, res) => res.send("🔥 ONLINE"));

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  if (!db) return bot.sendMessage(msg.chat.id, "Banco offline");

  const id = String(msg.from.id);
  const doc = await db.collection('users').doc(id).get();

  if (!doc.exists) {
    return bot.sendMessage(msg.chat.id,
`📋 Cadastro

Envie:
Nick | Idade | Whatsapp`);
  }

  bot.sendMessage(msg.chat.id, "🔥 Bem-vindo!");
});

// ================= CADASTRO =================
bot.on("message", async (msg) => {

  if (!db) return;

  const text = msg.text;
  const id = String(msg.from.id);

  if (!text || !text.includes("|")) return;

  const [nome, idade, whatsapp] = text.split("|");

  await db.collection('users').doc(id).set({
    nome: nome.trim(),
    idade: idade.trim(),
    whatsapp: whatsapp.trim(),
    criadoEm: new Date()
  });

  bot.sendMessage(msg.chat.id, "✅ Cadastro salvo");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {

  console.log("🔥 Servidor ONLINE");

  try {
    const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

    await bot.deleteWebHook();
    await bot.setWebHook(url);

    console.log("✅ Webhook:", url);

  } catch (e) {
    console.error("Erro webhook:", e);
  }
});
