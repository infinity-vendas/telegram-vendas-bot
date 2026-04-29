require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const ADMIN_ID = "6863505946";
const BOT_USERNAME = "SellForge_bot";

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

async function getUser(id) {
  const ref = db.collection('users').doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set({
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
    });

    return (await ref.get()).data();
  }

  return doc.data();
}

async function addPontos(id, valor) {
  const user = await getUser(id);

  await db.collection('users').doc(id).set({
    pontos: (user.pontos || 0) + valor
  }, { merge: true });
}

async function ativarVIP(id, dias) {
  const user = await getUser(id);

  let base = new Date();

  if (user.vipExpira && user.vipExpira.toDate() > new Date()) {
    base = user.vipExpira.toDate();
  }

  base.setDate(base.getDate() + dias);

  await db.collection('users').doc(id).set({
    vip: true,
    vipExpira: base
  }, { merge: true });
}

async function isVIP(id) {
  const user = await getUser(id);

  if (!user.vip || !user.vipExpira) return false;

  return user.vipExpira.toDate() > new Date();
}

// ================= START =================

bot.onText(/\/start$/, async (msg) => {

  const id = String(msg.from.id);
  const user = await getUser(id);

  if (user.banido) {
    return bot.sendMessage(msg.chat.id, "🚫 Você foi banido");
  }

  await bot.sendPhoto(msg.chat.id, "https://i.postimg.cc/Y9FHz03z/logo.jpg");

  bot.sendMessage(msg.chat.id, `
🔥 SELLFORGE BOT 🔥

👤 CLIENTE
/ver ID
/status
/denunciar ID

💼 VENDEDOR
/addproduto
/produtos
/deletar ID
/deletartudo
/link
/pontos
/saldo
/resgatarvip
/vip

👑 ADMIN
/aprovar ID
/ban ID
/aprovarproduto USER PROD
/addsaldo ID VALOR
/verusuarios
/broadcast TEXTO
`);
});

// ================= LINK AFILIADO =================

bot.onText(/\/start (.+)/, async (msg, match) => {

  const vendedorId = match[1];
  const userId = String(msg.from.id);

  if (userId !== vendedorId) {
    const user = await getUser(userId);

    if (!user.referidoPor) {
      await db.collection('users').doc(userId).set({
        referidoPor: vendedorId
      }, { merge: true });

      await addPontos(vendedorId, 10);
    }
  }

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

// ================= VENDEDOR =================

bot.onText(/\/addproduto/, async (msg) => {

  const id = String(msg.from.id);
  const user = await getUser(id);

  if (!user.aprovado) {
    return bot.sendMessage(msg.chat.id, "⛔ Não autorizado");
  }

  if (!(await isVIP(id))) {
    return bot.sendMessage(msg.chat.id, "🔒 Apenas VIP pode usar");
  }

  if ((user.saldo || 0) < 2.9) {
    return bot.sendMessage(msg.chat.id, "💰 Saldo insuficiente");
  }

  userState[id] = { step: "foto" };

  bot.sendMessage(msg.chat.id, "📸 Envie a foto do produto");
});

// ================= PRODUTOS =================

bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection('produtos')
    .doc(String(msg.from.id))
    .collection('itens')
    .get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Nenhum produto");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `🆔 ${doc.id}`);

    bot.sendPhoto(msg.chat.id, p.foto, {
      caption: `${p.nome} - ${p.preco} (${p.status})`
    });
  });
});

// ================= FLUXO PRODUTO =================

bot.on('message', async (msg) => {

  try {

    if (!msg.text && !msg.photo) return;
    if (msg.text && msg.text.startsWith("/")) return;

    const id = String(msg.from.id);
    const state = userState[id];

    // FOTO
    if (state?.step === "foto" && msg.photo) {
      state.foto = msg.photo[msg.photo.length - 1].file_id;
      state.step = "dados";

      return bot.sendMessage(msg.chat.id, "nome | preco | descricao | link");
    }

    // DADOS
    if (state?.step === "dados" && msg.text.includes("|")) {

      const user = await getUser(id);

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

      await db.collection('users').doc(id).set({
        saldo: user.saldo - 2.9
      }, { merge: true });

      userState[id] = null;

      await bot.sendMessage(msg.chat.id, "📦 Produto enviado para análise");

      return bot.sendMessage(ADMIN_ID,
`🆕 Produto novo
/aprovarproduto ${id} ${docRef.id}`);
    }

  } catch (err) {
    console.log(err);
  }
});

// ================= COMPRA =================

bot.on("callback_query", async (q) => {

  try {

    const [_, prodId, vendedorId] = q.data.split("_");

    await db.collection('vendas').add({
      vendedor: vendedorId,
      cliente: q.from.id,
      produto: prodId,
      data: new Date()
    });

    await addPontos(vendedorId, 15);

    bot.answerCallbackQuery(q.id, { text: "Compra registrada" });

  } catch (err) {
    console.log(err);
  }
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

  bot.sendMessage(msg.chat.id, "🚨 Denúncia enviada");
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
    .set({
      status: "aprovado"
    }, { merge: true });

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
