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

// ================= LAYOUT GLOBAL =================
const L = `
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
`;

// ================= TEMPOS RESET =================
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

// ================= START =================
const START_TEXT = `
${L}
Dono: INFINITY CLIENTE
Validity: 99.99.9999
Created by: @Infity_cliente_oficial
Parcerias: farias
Divulgadores: Farias (a)
Instagram: @infinity_client_oficial

🔥 Eitaaa Faelzin endoidou de vez 😅

💰 Planos VIP a partir de $0,15  
⚡ Ultra plano 1 Day: $0,97  

📅 Promoção válida até 22.04.2026 - 23:59

🚀 Melhor sistema para vendas e divulgações ilimitadas!

💡 Cansado de pagar caro e ainda sair no prejuízo?  
Aqui você lucra de verdade.

📦 Infinity Cliente é sua solução definitiva!
${L}
`;

// ================= MENU =================
const MENU_TEXT = `
${L}
📦 INFINITY STORE

👤 USUÁRIO:
/produtos
/status
/id

🛠 ADMIN:
/admin
${L}
`;

// ================= MEMORY =================
const cadastroStep = {};
const cadastroData = {};
const adminState = {};

// ================= UTIL =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

function formatar(ms) {
  return new Date(ms).toLocaleString("pt-BR");
}

// ================= CHECK ACESSO =================
async function checkAcesso(id) {
  const doc = await db.collection("alugueis").doc(id).get();
  if (!doc.exists) return false;
  if (!doc.data().ativo) return false;
  if (Date.now() > doc.data().expiraEm) return false;
  return true;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const doc = await db.collection("users").doc(id).get();

  if (!doc.exists) {
    cadastroStep[id] = "nome";
    cadastroData[id] = {};
    return bot.sendMessage(msg.chat.id, `${L}\nDigite seu nome:\n${L}`);
  }

  bot.sendMessage(msg.chat.id, START_TEXT);
  setTimeout(() => bot.sendMessage(msg.chat.id, MENU_TEXT), 1200);
});

// ================= CADASTRO =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  if (cadastroStep[id]) {

    if (cadastroStep[id] === "nome") {
      cadastroData[id].nome = text;
      cadastroStep[id] = "whatsapp";
      return bot.sendMessage(msg.chat.id, `${L}\nWhatsApp:\n${L}`);
    }

    if (cadastroStep[id] === "whatsapp") {

      cadastroData[id].whatsapp = text;

      await db.collection("users").doc(id).set({
        ...cadastroData[id],
        criadoEm: Date.now()
      });

      delete cadastroStep[id];
      return bot.sendMessage(msg.chat.id, `${L}\n✔ Cadastro concluído\n${L}`);
    }
  }
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const ok = await checkAcesso(String(msg.from.id));
  if (!ok) return bot.sendMessage(msg.chat.id, `${L}\n❌ Acesso expirado\n${L}`);

  const snap = await db.collection("produtos").get();

  let txt = `${L}\n📦 PRODUTOS:\n\n`;

  snap.forEach(d => {
    const p = d.data();
    txt += `${p.nome} - R$ ${p.valor}\n`;
  });

  txt += `\n${L}`;

  bot.sendMessage(msg.chat.id, txt);
});

// ================= STATUS =================
bot.onText(/\/status/, async (msg) => {

  const doc = await db.collection("alugueis").doc(String(msg.from.id)).get();

  if (!doc.exists) return bot.sendMessage(msg.chat.id, `${L}\nSem plano\n${L}`);

  bot.sendMessage(msg.chat.id,
`${L}
Plano: ${doc.data().plano}
Expira: ${formatar(doc.data().expiraEm)}
${L}`);
});

// ================= ID =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `${L}\nID: ${msg.from.id}\n${L}`);
});

// ================= ADMIN =================
bot.onText(/\/admin/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const users = await db.collection("users").get();

  let buttons = [];

  users.forEach(doc => {
    buttons.push([{
      text: `👤 ${doc.data().nome}`,
      callback_data: `user_${doc.id}`
    }]);
  });

  bot.sendMessage(msg.chat.id, `${L}\n👥 SELECIONE USUÁRIO:\n${L}`, {
    reply_markup: { inline_keyboard: buttons }
  });
});

// ================= CALLBACK =================
bot.on("callback_query", async (cb) => {

  const id = cb.from.id;
  const data = cb.data;

  if (!isAdmin(id)) return;

  if (data.startsWith("user_")) {

    const userId = data.replace("user_", "");
    adminState[id] = { userId };

    const buttons = Object.keys(TEMPOS).map(t => ([{
      text: `Reset ${t}`,
      callback_data: `set_${t}_${userId}`
    }]));

    return bot.sendMessage(id, `${L}\n⏱ RESET VALIDADE:\n${L}`, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  if (data.startsWith("set_")) {

    const [, tempo, userId] = data.split("_");

    const novoTempo = Date.now() + TEMPOS[tempo];

    await db.collection("alugueis").doc(userId).set({
      ativo: true,
      expiraEm: novoTempo
    }, { merge: true });

    return bot.sendMessage(id, `${L}\n✔ Reset aplicado: ${tempo}\n${L}`);
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

      bot.sendMessage(doc.id, `${L}\n❌ Acesso expirado\n${L}`);
    }
  });

}, 60000);

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 INFINITY STORE COM LAYOUT ATIVO");
});
