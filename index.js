require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const os = require('os');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
app.use(express.json());

// CONFIG
const ADMIN_ID = "6863505946";
const WHATSAPP = "551981528372";
const BOT_USERNAME = "SellForge_bot";
const BOT_VERSION = "v4.0 GOD";

// FIREBASE
let db;

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  initializeApp({
    credential: cert(serviceAccount)
  });

  db = getFirestore();
  console.log("🔥 Firebase conectado");

} catch (e) {
  console.log("❌ Firebase erro:", e.message);
}

// BOT
const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;

app.post(SECRET_PATH, (req, res) => {
  res.sendStatus(200);
  bot.processUpdate(req.body);
});

app.get('/', (req, res) => res.send("🚀 INFINITY CLIENTES ONLINE"));

const userState = {};
const LOGO = "https://i.postimg.cc/g2JJvqHN/logo.jpg";

// ================= START =================
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {

  const chatId = msg.chat.id;
  const id = String(msg.from.id);
  const ref = match[1];

  await bot.sendPhoto(chatId, LOGO);

  const userDoc = await db.collection('users').doc(id).get();

  // CADASTRO
  if (!userDoc.exists || !userDoc.data().nome) {
    userState[id] = { step: "cad_nome" };
    return bot.sendMessage(chatId,
`📋 CADASTRO OBRIGATÓRIO

Digite seu nome:`);
  }

  // LINK VENDEDOR
  if (ref) {
    const vendedor = await db.collection('vendedores').doc(ref).get();

    if (!vendedor.exists || !vendedor.data().ativo) {
      return bot.sendMessage(chatId, `🚫 Link não autorizado`);
    }

    await bot.sendMessage(chatId, `👤 Indicado por: ${ref}`);
  }

  // MENSAGEM ORIGINAL (100% intacta)
  await bot.sendMessage(chatId,
`Olá 👋

Sou seu assistente virtual 🤖

Como posso lhe ajudar hoje?

🔥 Confira nossos planos ULTRA MAX

Cansado de alugar bots caros e sem resultado?

Apresento a você a INFINITY CLIENTES 🚀

✔ Transparência
✔ Qualidade
✔ Desempenho

#EQUIPE IC ®

Escolha abaixo 👇`,
{
  reply_markup: {
    keyboard: [
      ["📦 Produtos", "📊 Planos"],
      ["🤖 Alugar Bot", "📲 Suporte"],
      ["🔗 Meu Link", "🚨 Denunciar"]
    ],
    resize_keyboard: true
  }
});

  if (id === ADMIN_ID) {
    bot.sendMessage(chatId, `🔐 ADMIN LIBERADO\n/comandos_admin`);
  }
});

// ================= MENU =================
bot.on("message", async (msg) => {

  if (!msg.text) return;

  const text = msg.text;
  const id = String(msg.from.id);
  const state = userState[id];

  // ===== CADASTRO =====
  if (state?.step === "cad_nome") {
    userState[id] = { nome: text, step: "cad_idade" };
    return bot.sendMessage(msg.chat.id, "Digite sua idade:");
  }

  if (state?.step === "cad_idade") {
    state.idade = text;
    state.step = "cad_whatsapp";
    return bot.sendMessage(msg.chat.id, "Digite seu WhatsApp:");
  }

  if (state?.step === "cad_whatsapp") {
    state.whatsapp = text;
    state.step = "cad_insta";
    return bot.sendMessage(msg.chat.id, "Digite seu Instagram:");
  }

  if (state?.step === "cad_insta") {

    await db.collection('users').doc(id).set({
      nome: state.nome,
      idade: state.idade,
      whatsapp: state.whatsapp,
      instagram: text,
      criadoEm: new Date()
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id,
"✅ Cadastro concluído!\nDigite /start");
  }

  // ===== BLOQUEIO =====
  const vendedor = await db.collection('vendedores').doc(id).get();

  if (vendedor.exists) {
    const v = vendedor.data();

    if (v.banido === "perm")
      return bot.sendMessage(msg.chat.id, "🚫 Banido permanente");

    if (v.banido === "temp" && Date.now() < v.banExpira)
      return bot.sendMessage(msg.chat.id, "🚫 Banimento ativo");
  }

  // ===== DENUNCIA =====
  if (text === "🚨 Denunciar") {
    userState[id] = { step: "denuncia" };
    return bot.sendMessage(msg.chat.id, "Digite o nome do vendedor");
  }

  if (state?.step === "denuncia") {
    state.vendedor = text;
    state.step = "motivo";
    return bot.sendMessage(msg.chat.id, "Digite o motivo");
  }

  if (state?.step === "motivo") {
    await db.collection('denuncias').add({
      vendedor: state.vendedor,
      motivo: text,
      user: id,
      data: new Date()
    });

    userState[id] = null;

    return bot.sendMessage(msg.chat.id, "🚨 Denúncia enviada");
  }

  // ===== PRODUTOS =====
  if (text === "📦 Produtos") {

    const snap = await db.collection('produtos').get();

    if (snap.empty)
      return bot.sendMessage(msg.chat.id, "❌ Nenhum produto");

    for (const doc of snap.docs) {
      const p = doc.data();

      if (p.estoque <= 0) continue;

      await bot.sendPhoto(msg.chat.id, p.img, {
        caption:
`📦 ${p.nome}
💰 ${p.preco}

📝 ${p.desc}
📦 Estoque: ${p.estoque}`,
        reply_markup: {
          inline_keyboard: [[{
            text: "🛒 Comprar",
            callback_data: `buy_${doc.id}`
          }]]
        }
      });
    }
  }

  // ===== PLANOS =====
  if (text === "📊 Planos") {
    bot.sendMessage(msg.chat.id,
`📊 PLANOS DISPONÍVEIS

1D = R$5
3D = R$15
10D = R$30
20D = R$60
30D = R$90
40D = R$120
50D = R$150
60D = R$180
90D = R$210`);
  }

  // ===== ALUGAR =====
  if (text === "🤖 Alugar Bot") {
    bot.sendMessage(msg.chat.id,
`🤖 ALUGAR BOT

24h = R$6
48h = R$8`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "📲 Contratar",
      url: `https://wa.me/${WHATSAPP}`
    }]]
  }
});
  }

  // ===== SUPORTE =====
  if (text === "📲 Suporte") {
    bot.sendMessage(msg.chat.id,
"Fale conosco 👇",
{
  reply_markup: {
    inline_keyboard: [[{
      text: "WhatsApp",
      url: `https://wa.me/${WHATSAPP}`
    }]]
  }
});
  }

  // ===== LINK =====
  if (text === "🔗 Meu Link") {

    if (!vendedor.exists || !vendedor.data().ativo || vendedor.data().banido) {
      return bot.sendMessage(msg.chat.id,
`🚫 Você não está autorizado`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "📲 Solicitar acesso",
      url: `https://wa.me/${WHATSAPP}`
    }]]
  }
});
    }

    const nome = vendedor.data().nome;

    bot.sendMessage(msg.chat.id,
`🔗 https://t.me/${BOT_USERNAME}?start=${nome}`);
  }
});

// ===== COMPRA =====
bot.on("callback_query", async (q) => {

  const idProduto = q.data.replace("buy_", "");
  const doc = await db.collection('produtos').doc(idProduto).get();
  const p = doc.data();

  if (!p || p.estoque <= 0)
    return bot.answerCallbackQuery(q.id, { text: "❌ Sem estoque" });

  // salvar venda COMPLETA
  await db.collection('vendas').add({
    produto: p.nome,
    preco: p.preco,
    desc: p.desc,
    img: p.img,
    whatsapp: p.whatsapp,
    vendedor: p.criadoPor,
    data: new Date()
  });

  await doc.ref.update({ estoque: p.estoque - 1 });

  bot.answerCallbackQuery(q.id, { text: "✅ Pedido registrado" });

  bot.sendMessage(q.message.chat.id,
`🛒 Finalize aqui:
https://wa.me/${p.whatsapp}`);
});

// ===== ADMIN =====
bot.onText(/\/comandos_admin/, (msg) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  bot.sendMessage(msg.chat.id,
`🔐 ADMIN

/ban_temp ID
/ban_perm ID
/estoque ID QTD
/ranking
/reset_total`);
});

// ===== BAN TEMP =====
bot.onText(/\/ban_temp (.+)/, async (msg, m) => {

  const id = m[1];
  const expira = Date.now() + (30 * 86400000);

  await db.collection('vendedores').doc(id).set({
    banido: "temp",
    banExpira: expira
  }, { merge: true });

  const prod = await db.collection('produtos').where("criadoPor","==",id).get();
  for (const d of prod.docs) await d.ref.delete();

  bot.sendMessage(msg.chat.id, "🚫 Ban TEMP aplicado");
});

// ===== BAN PERM =====
bot.onText(/\/ban_perm (.+)/, async (msg, m) => {

  const id = m[1];

  await db.collection('vendedores').doc(id).set({
    banido: "perm"
  }, { merge: true });

  const prod = await db.collection('produtos').where("criadoPor","==",id).get();
  for (const d of prod.docs) await d.ref.delete();

  bot.sendMessage(msg.chat.id, "🚫 Ban PERM aplicado");
});

// ===== RANKING =====
bot.onText(/\/ranking/, async (msg) => {

  const snap = await db.collection('vendas').get();
  let r = {};

  snap.forEach(doc=>{
    const v = doc.data().vendedor;
    r[v] = (r[v]||0)+1;
  });

  let txt="🏆 Ranking\n\n";

  Object.entries(r).sort((a,b)=>b[1]-a[1])
  .forEach((v,i)=>{
    txt += `${i+1}. ${v[0]} - ${v[1]} vendas\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// ===== RESET =====
bot.onText(/\/reset_total/, async (msg) => {

  if (String(msg.from.id) !== ADMIN_ID) return;

  const cols = ["users","produtos","vendas","vendedores","denuncias"];

  for (const c of cols) {
    const snap = await db.collection(c).get();
    for (const d of snap.docs) await d.ref.delete();
  }

  bot.sendMessage(msg.chat.id, "💀 BANCO RESETADO");
});

// SERVER
app.listen(process.env.PORT || 3000, async () => {

  console.log("🚀 ONLINE");

  const url = `${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

  await bot.setWebHook(url);

  console.log("Webhook:", url);
});
