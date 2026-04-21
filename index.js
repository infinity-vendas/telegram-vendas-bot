const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const ADMINS = ["6863505946"];

// 🔥 LOGO
const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";

const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bot = new TelegramBot(TOKEN);
const app = express();

app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ================= TEMPOS =================
const TEMPOS = {
  "1h": 3600000,
  "2h": 7200000,
  "1d": 86400000,
  "3d": 259200000,
  "7d": 604800000,
  "14d": 1209600000,
  "21d": 1814400000,
  "30d": 2592000000,
  "60d": 5184000000,
  "90d": 7776000000
};

// ================= LAYOUT =================
const START_TEXT = `
━━━━━━━━━━━━━━━━━━
⚡ INFINITY CLIENTES IC ⚡
━━━━━━━━━━━━━━━━━━

Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!

Aqui você encontra um ambiente totalmente estruturado para facilitar sua experiência, com atendimento rápido, organizado e focado em entregar o melhor resultado possível para cada cliente.

Nosso compromisso é com a transparência, a segurança e a satisfação.

━━━━━━━━━━━━━━━━━━
INFINITY CLIENTES – confiança, organização e resultado em um só lugar
━━━━━━━━━━━━━━━━━━
`;

const MENU_TEXT = `
━━━━━━━━━━━━━━━━━━
📦 INFINITY STORE
━━━━━━━━━━━━━━━━━━

🆔 USUÁRIO:
/produtos
/status
/id

⚡ ADMIN:
/admin
━━━━━━━━━━━━━━━━━━
`;

// ================= MEMORY =================
const cadastro = {};
const adminState = {};

// ================= UTIL =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

function formatDate(ms) {
  return new Date(ms).toLocaleString("pt-BR");
}

// ================= START (CORRIGIDO) =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const user = await db.collection("users").doc(id).get();

  // 🔥 NOVO USUÁRIO
  if (!user.exists) {
    cadastro[id] = { step: "nome" };

    return bot.sendPhoto(msg.chat.id, LOGO, {
      caption: "👤 Bem-vindo! Digite seu nome:"
    });
  }

  // 🔥 USUÁRIO NORMAL
  await bot.sendPhoto(msg.chat.id, LOGO, {
    caption: START_TEXT
  });

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, MENU_TEXT);
  }, 1200);
});

// ================= CADASTRO (CORRIGIDO) =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;

  if (!text || text.startsWith("/")) return;
  if (!cadastro[id]) return;

  if (cadastro[id].step === "nome") {

    cadastro[id].nome = text;
    cadastro[id].step = "whatsapp";

    return bot.sendMessage(msg.chat.id, "📱 WhatsApp:");
  }

  if (cadastro[id].step === "whatsapp") {

    cadastro[id].whatsapp = text;

    await db.collection("users").doc(id).set({
      nome: cadastro[id].nome,
      whatsapp: cadastro[id].whatsapp,
      criadoEm: Date.now()
    });

    delete cadastro[id];

    // 🔥 MOSTRA SISTEMA APÓS CADASTRO
    await bot.sendPhoto(msg.chat.id, LOGO, {
      caption: START_TEXT
    });

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, MENU_TEXT);
    }, 1200);

    return;
  }
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  let txt = "📦 PRODUTOS:\n\n";

  snap.forEach(p => {
    const d = p.data();
    txt += `• ${d.nome} - R$ ${d.valor}\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// ================= STATUS =================
bot.onText(/\/status/, async (msg) => {

  const doc = await db.collection("alugueis").doc(String(msg.from.id)).get();

  if (!doc.exists) return bot.sendMessage(msg.chat.id, "Sem plano");

  bot.sendMessage(msg.chat.id,
`📊 STATUS

Plano: ${doc.data().plano}
Expira: ${formatDate(doc.data().expiraEm)}`);
});

// ================= ID =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `Seu ID: ${msg.from.id}`);
});

// ================= ADMIN =================
bot.onText(/\/admin/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const users = await db.collection("users").get();

  let buttons = [
    [{ text: "➕ Adicionar Produto", callback_data: "add_product" }],
    [{ text: "❌ Deletar TODOS Produtos", callback_data: "del_products" }]
  ];

  users.forEach(u => {
    buttons.push([{
      text: `⏱ Reset ${u.data().nome}`,
      callback_data: `user_${u.id}`
    }]);
  });

  bot.sendMessage(msg.chat.id, "⚙ PAINEL ADMIN:", {
    reply_markup: { inline_keyboard: buttons }
  });
});

// ================= CALLBACK =================
bot.on("callback_query", async (cb) => {

  const adminId = cb.from.id;
  const data = cb.data;

  if (!isAdmin(adminId)) return;

  // RESET USER
  if (data.startsWith("user_")) {

    const userId = data.replace("user_", "");
    adminState[adminId] = { userId };

    const buttons = Object.keys(TEMPOS).map(t => ([{
      text: `⏱ ${t}`,
      callback_data: `set_${t}_${userId}`
    }]));

    return bot.sendMessage(adminId, "⏳ RESET VALIDADE:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // APPLY RESET
  if (data.startsWith("set_")) {

    const [, tempo, userId] = data.split("_");

    const expiraEm = Date.now() + TEMPOS[tempo];

    await db.collection("alugueis").doc(userId).set({
      ativo: true,
      expiraEm,
      plano: tempo
    }, { merge: true });

    return bot.sendMessage(adminId, `✔ Reset aplicado: ${tempo}`);
  }

  // DELETE ALL PRODUCTS
  if (data === "del_products") {

    const snap = await db.collection("produtos").get();
    const batch = db.batch();

    snap.forEach(d => batch.delete(d.ref));

    await batch.commit();

    return bot.sendMessage(adminId, "❌ Todos produtos deletados");
  }

  // ADD PRODUCT
  if (data === "add_product") {
    adminState[adminId] = { step: "nome" };
    return bot.sendMessage(adminId, "Nome do produto:");
  }
});

// ================= ADD PRODUCT FLOW =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;

  if (!adminState[id]) return;
  if (!isAdmin(id)) return;

  if (adminState[id].step === "nome") {
    adminState[id].nome = text;
    adminState[id].step = "valor";
    return bot.sendMessage(id, "Valor:");
  }

  if (adminState[id].step === "valor") {

    await db.collection("produtos").add({
      nome: adminState[id].nome,
      valor: text,
      criadoEm: Date.now()
    });

    delete adminState[id];

    return bot.sendMessage(id, "✔ Produto adicionado");
  }
});

// ================= BLOQUEIO =================
setInterval(async () => {

  const snap = await db.collection("alugueis").get();

  snap.forEach(async (doc) => {

    const d = doc.data();

    if (d.ativo && Date.now() > d.expiraEm) {
      await db.collection("alugueis").doc(doc.id).update({
        ativo: false
      });

      bot.sendMessage(doc.id, "❌ Seu acesso expirou");
    }
  });

}, 60000);

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 INFINITY CLIENTES ONLINE");
});
