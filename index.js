const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const ADMINS = ["6863505946"];

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


// ================= LAYOUT =================
const START_TEXT = `
━━━━━━━━━━━━━━━━━━
🏆 INFINITY CLIENTE
━━━━━━━━━━━━━━━━━━
✔ Sistema ativo
✔ Painel liberado

Bem-vindo ao sistema oficial
━━━━━━━━━━━━━━━━━━
`;

const MENU_TEXT = `
━━━━━━━━━━━━━━━━━━
📦 INFINITY STORE
━━━━━━━━━━━━━━━━━━

👤 USUÁRIO:
/produtos
/status
/id

🛠 ADMIN:
/admin
━━━━━━━━━━━━━━━━━━
`;


// ================= TEMPO =================
const TEMPO = {
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


// ================= MEMORY =================
const cadastro = {};
const adminSession = {};


// ================= UTIL =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

function formatDate(ms) {
  return new Date(ms).toLocaleString("pt-BR");
}


// ================= CHECK ACESSO =================
async function checkAccess(id) {
  const doc = await db.collection("alugueis").doc(id).get();

  if (!doc.exists) return false;
  if (!doc.data().ativo) return false;
  if (Date.now() > doc.data().expiraEm) return false;

  return true;
}


// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const user = await db.collection("users").doc(id).get();

  if (!user.exists) {
    cadastro[id] = { step: "nome" };
    return bot.sendMessage(msg.chat.id, "👤 Digite seu nome:");
  }

  bot.sendMessage(msg.chat.id, START_TEXT);
  setTimeout(() => bot.sendMessage(msg.chat.id, MENU_TEXT), 1000);
});


// ================= CADASTRO =================
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

    return bot.sendMessage(msg.chat.id, "✔ Cadastro concluído");
  }
});


// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const ok = await checkAccess(String(msg.from.id));
  if (!ok) return bot.sendMessage(msg.chat.id, "❌ Acesso bloqueado ou expirado");

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

  if (!doc.exists) return bot.sendMessage(msg.chat.id, "Sem plano ativo");

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

  let buttons = [];

  users.forEach(u => {
    buttons.push([{
      text: `👤 ${u.data().nome}`,
      callback_data: `user_${u.id}`
    }]);
  });

  bot.sendMessage(msg.chat.id, "👥 Selecionar usuário:", {
    reply_markup: { inline_keyboard: buttons }
  });
});


// ================= CALLBACK =================
bot.on("callback_query", async (cb) => {

  const adminId = cb.from.id;
  const data = cb.data;

  if (!isAdmin(adminId)) return;

  // escolher usuário
  if (data.startsWith("user_")) {

    const userId = data.replace("user_", "");
    adminSession[adminId] = { userId };

    const buttons = Object.keys(TEMPO).map(t => ([{
      text: `⏱ ${t}`,
      callback_data: `set_${t}_${userId}`
    }]));

    return bot.sendMessage(adminId, "⏳ Definir tempo:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // aplicar tempo
  if (data.startsWith("set_")) {

    const [, t, userId] = data.split("_");

    const expiraEm = Date.now() + TEMPO[t];

    await db.collection("alugueis").doc(userId).set({
      ativo: true,
      expiraEm,
      plano: t
    }, { merge: true });

    return bot.sendMessage(adminId, `✔ Aplicado: ${t}`);
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
  console.log("🚀 INFINITY STORE BASE LIMPA ONLINE");
});
