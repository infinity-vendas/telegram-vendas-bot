require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const ADMIN_ID = "6863505946";
const BOT_USERNAME = "SellForge_bot";
const MAX_USERS = 2;

// ================= FIREBASE =================
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// ================= WEBHOOK =================
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;

bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`);

app.post(SECRET_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send("🔥 ONLINE"));

// ================= CONTROLE =================
const userState = {};
const startTime = Date.now();

// ================= FUNÇÕES =================

// pegar ou criar usuário
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

// pontos
async function addPontos(id, valor) {
  const user = await getUser(id);

  await db.collection('users').doc(id).set({
    pontos: (user.pontos || 0) + valor
  }, { merge: true });
}

// VIP check
async function isVIP(id) {
  const user = await getUser(id);

  if (!user.vip || !user.vipExpira) return false;

  return user.vipExpira.toDate() > new Date();
}

// ================= SISTEMA DE VAGAS =================

async function verificarEntrada(userId) {

  const ref = db.collection('users').doc(userId);
  const doc = await ref.get();

  // já ativo
  if (doc.exists && !doc.data().banido) {
    return { status: "ok" };
  }

  // VIP fura fila
  if (doc.exists && doc.data().vip) {
    return { status: "ok" };
  }

  // contar usuários ativos
  const usersSnap = await db.collection('users')
    .where("banido", "==", false)
    .get();

  if (usersSnap.size < MAX_USERS) {
    return { status: "ok" };
  }

  // entrar na fila
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

// liberar vaga
async function processarFila() {

  const usersSnap = await db.collection('users')
    .where("banido", "==", false)
    .get();

  if (usersSnap.size >= MAX_USERS) return;

  const filaSnap = await db.collection('fila')
    .orderBy("entrouEm")
    .limit(1)
    .get();

  if (filaSnap.empty) return;

  const userFila = filaSnap.docs[0];
  const userId = userFila.id;

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
`🚫 Bot lotado (2 usuários)

Você entrou na fila ⏳`);
  }

  const user = await getUser(id);

  if (user.banido) {
    return bot.sendMessage(msg.chat.id, "🚫 Banido");
  }

  bot.sendMessage(msg.chat.id,
`🔥 SELLFORGE BOT

Use /ver ID para ver produtos`);
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
    return bot.sendMessage(msg.chat.id, "❌ Nenhum produto");
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

// ================= PRODUTO =================

bot.onText(/\/addproduto/, async (msg) => {

  const id = String(msg.from.id);
  const user = await getUser(id);

  if (!user.aprovado) return bot.sendMessage(msg.chat.id, "⛔ Não autorizado");

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

    bot.sendMessage(msg.chat.id, "📦 Enviado para análise");

    bot.sendMessage(ADMIN_ID,
`Novo produto:
/aprovarproduto ${id} ${docRef.id}`);
  }
});

// ================= COMPRA =================

bot.on("callback_query", async (q) => {

  const [_, prodId, vendedorId] = q.data.split("_");

  await db.collection('vendas').add({
    vendedor: vendedorId,
    cliente: q.from.id,
    produto: prodId,
    data: new Date()
  });

  await addPontos(vendedorId, 15);

  bot.answerCallbackQuery(q.id, { text: "Compra registrada" });
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

  bot.sendMessage(msg.chat.id, "🚨 Denunciado");

  if (denuncias >= 5) {
    await processarFila();
  }
});

// ================= ADMIN =================

bot.onText(/\/aprovar (.+)/, async (msg, m) => {
  if (msg.from.id != ADMIN_ID) return;

  await db.collection('users').doc(m[1]).set({
    aprovado: true
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "✅ Vendedor aprovado");
});

bot.onText(/\/aprovarproduto (.+) (.+)/, async (msg, m) => {
  if (msg.from.id != ADMIN_ID) return;

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
`⏱️ ${Math.floor((Date.now() - startTime)/1000)}s`);
});

// ================= SERVER =================

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 BOT RODANDO");
});
