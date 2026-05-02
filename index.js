require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const ADMIN_ID = "6863505946";
const BOT_USERNAME = "SellForge_bot";
const MAX_USERS = 2;

// ================= FIREBASE =================
let serviceAccount;

try {
  serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
} catch (e) {
  console.error("❌ Erro Firebase:", e);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore({
  ignoreUndefinedProperties: true
});

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: { port: process.env.PORT || 3000 }
});

// ================= WEBHOOK =================
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;

app.post(SECRET_PATH, (req, res) => {
  res.sendStatus(200);

  try {
    bot.processUpdate(req.body);
  } catch (e) {
    console.error("Erro update:", e);
  }
});

app.get('/', (req, res) => res.send("🤖 ONLINE"));

// configurar webhook
(async () => {
  try {
    const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

    await bot.deleteWebHook();
    await bot.setWebHook(url);

    console.log("✅ Webhook:", url);

    const info = await bot.getWebHookInfo();
    console.log("📡 Info:", info);

  } catch (err) {
    console.error("❌ Webhook erro:", err);
  }
})();

// ================= KEEP ALIVE =================
setInterval(() => {
  fetch(process.env.RENDER_EXTERNAL_URL)
    .then(() => console.log("🔄 Alive"))
    .catch(() => {});
}, 1000 * 60 * 5);

// ================= SEGURANÇA =================
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// ================= CONTROLE =================
const userState = {};
const startTime = Date.now();

// ================= FUNÇÕES =================
async function getUser(id) {
  const ref = db.collection('users').doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    const data = {
      id,
      nome: "User",
      aprovado: false,
      banido: false,
      pontos: 0,
      saldo: 0,
      denuncias: 0,
      vip: false,
      vipExpira: null,
      criadoEm: new Date()
    };

    await ref.set(data);
    return data;
  }

  return doc.data();
}

async function addPontos(id, valor) {
  const user = await getUser(id);

  await db.collection('users').doc(id).set({
    pontos: (user.pontos || 0) + valor
  }, { merge: true });
}

async function isVIP(id) {
  const user = await getUser(id);

  if (!user.vip || !user.vipExpira) return false;

  return user.vipExpira.toDate() > new Date();
}

// ================= FILA =================
async function verificarEntrada(userId) {

  const doc = await db.collection('users').doc(userId).get();

  if (doc.exists && !doc.data().banido) return { status: "ok" };

  if (await isVIP(userId)) return { status: "ok" };

  const usersSnap = await db.collection('users').get();
  const ativos = usersSnap.docs.filter(d => !d.data().banido);

  if (ativos.length < MAX_USERS) return { status: "ok" };

  const filaRef = db.collection('fila').doc(userId);
  const filaDoc = await filaRef.get();

  if (!filaDoc.exists) {
    await filaRef.set({
      id: userId,
      entrouEm: new Date()
    });
  }

  return { status: "fila" };
}

async function processarFila() {

  const usersSnap = await db.collection('users').get();
  const ativos = usersSnap.docs.filter(d => !d.data().banido);

  if (ativos.length >= MAX_USERS) return;

  const filaSnap = await db.collection('fila')
    .orderBy("entrouEm")
    .limit(1)
    .get();

  if (filaSnap.empty) return;

  const userId = filaSnap.docs[0].id;

  await db.collection('users').doc(userId).set({
    id: userId,
    nome: "User",
    aprovado: false,
    banido: false,
    pontos: 0,
    saldo: 0,
    criadoEm: new Date()
  });

  await db.collection('fila').doc(userId).delete();

  bot.sendMessage(userId, "🎉 Sua vaga foi liberada!");
}

// ================= START =================
bot.onText(/\/start$/, async (msg) => {

  const id = String(msg.from.id);

  const check = await verificarEntrada(id);

  if (check.status === "fila") {
    return bot.sendMessage(msg.chat.id,
`🚫 Bot lotado (${MAX_USERS} usuários)

⏳ Você entrou na fila`);
  }

  const user = await getUser(id);

  if (user.banido) {
    return bot.sendMessage(msg.chat.id, "🚫 Banido");
  }

  bot.sendMessage(msg.chat.id,
`🔥 SELLFORGE BOT

Use /start ID para ver produtos`);
});

// ================= LINK =================
bot.onText(/\/start (.+)/, async (msg, match) => {

  const vendedorId = match[1];

  const snap = await db.collection('produtos')
    .doc(vendedorId)
    .collection('itens')
    .where("status", "==", "aprovado")
    .get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "🚫 Nenhum produto");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendPhoto(msg.chat.id, p.foto, {
      caption: `${p.nome}\n💰 ${p.preco}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Comprar", callback_data: `buy_${doc.id}_${vendedorId}` }]
        ]
      }
    });
  });
});

// ================= ADD PRODUTO =================
bot.onText(/\/addproduto/, async (msg) => {

  const id = String(msg.from.id);
  const user = await getUser(id);

  if (!user.aprovado)
    return bot.sendMessage(msg.chat.id, "🚫 Não autorizado");

  userState[id] = { step: "foto" };
  bot.sendMessage(msg.chat.id, "📸 Envie a foto");
});

// fluxo produto
bot.on('message', async (msg) => {

  if (!msg.text && !msg.photo) return;
  if (msg.text && msg.text.startsWith("/")) return;

  const id = String(msg.from.id);
  const state = userState[id];

  if (state?.step === "foto" && msg.photo) {
    state.foto = msg.photo[msg.photo.length - 1].file_id;
    state.step = "dados";
    return bot.sendMessage(msg.chat.id, "nome | preco | descricao | link");
  }

  if (state?.step === "dados" && msg.text.includes("|")) {

    const [nome, preco, descricao, link] = msg.text.split("|");

    const docRef = await db.collection('produtos')
      .doc(id)
      .collection('itens')
      .add({
        nome: nome.trim(),
        preco: preco.trim(),
        descricao: descricao.trim(),
        link: link.trim(),
        foto: state.foto,
        status: "pendente"
      });

    userState[id] = null;

    bot.sendMessage(msg.chat.id, "⏳ Enviado para análise");

    bot.sendMessage(ADMIN_ID,
`Novo produto:
/aprovarproduto ${id} ${docRef.id}`);
  }
});

// ================= COMPRA =================
bot.on("callback_query", async (q) => {

  if (!q.data.startsWith("buy_")) return;

  const [_, prodId, vendedorId] = q.data.split("_");

  await db.collection('vendas').add({
    vendedor: vendedorId,
    cliente: q.from.id,
    produto: prodId,
    data: new Date()
  });

  await addPontos(vendedorId, 15);

  bot.answerCallbackQuery(q.id, { text: "✅ Compra registrada" });
});

// ================= DENÚNCIA =================
bot.onText(/\/denunciar (.+)/, async (msg, m) => {

  const ref = db.collection('users').doc(m[1]);
  const doc = await ref.get();
  if (!doc.exists) return;

  const user = doc.data();
  const denuncias = (user.denuncias || 0) + 1;

  await ref.set({
    denuncias,
    pontos: (user.pontos || 0) - 1,
    banido: denuncias >= 5
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "⚠️ Denunciado");

  if (denuncias >= 5) {
    await processarFila();
  }
});

// ================= ADMIN =================
bot.onText(/\/aprovar (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('users').doc(m[1]).set({
    aprovado: true
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "✅ Vendedor aprovado");
});

bot.onText(/\/aprovarproduto (.+) (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  await db.collection('produtos')
    .doc(m[1])
    .collection('itens')
    .doc(m[2])
    .set({ status: "aprovado" }, { merge: true });

  bot.sendMessage(msg.chat.id, "✅ Produto aprovado");
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
`⏱️ Online há ${Math.floor((Date.now() - startTime)/1000)}s`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 BOT RODANDO");
});
