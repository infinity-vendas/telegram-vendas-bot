const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const ADMINS = ["6863505946"];

// ===== IMAGENS =====
const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";

// ===== WHATSAPP =====
const WA_SUPORTE = "https://wa.me/5551981528372";

// ===== FIREBASE =====
const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bot = new TelegramBot(TOKEN);

const app = express();
app.use(express.json());

// ================= WEBHOOK =================
app.post("/webhook", (req, res) => {
  try {
    bot.processUpdate(req.body);
  } catch (e) {
    console.log("Erro webhook:", e);
  }
  res.sendStatus(200);
});

// ================= STATES =================
const cadastro = {};
const adminState = {};
const iaTimer = {};
let restartLock = false;
let shutdownLock = false;

// ================= UTIL =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

async function isRegistered(id) {
  const doc = await db.collection("users").doc(id).get();
  return doc.exists;
}

async function checkAccess(msg) {
  if (!(await isRegistered(String(msg.from.id)))) {
    bot.sendMessage(msg.chat.id, "❌ Use /start e complete cadastro.");
    return false;
  }
  return true;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const user = await db.collection("users").doc(id).get();

  bot.sendPhoto(msg.chat.id, LOGO);

  const TEXT = `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!

Aqui você encontra um ambiente estruturado, rápido e seguro.

INFINITY CLIENTES – confiança, organização e resultado.
`;

  if (!user.exists) {

    cadastro[id] = { step: "nome" };

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, TEXT + "\n\nDigite seu nome:");
    }, 2500);

    return;
  }

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, TEXT);
  }, 2500);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, menuUser());
  }, 5000);

  iniciarIA(msg.chat.id);
});

// ================= CADASTRO =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  if (cadastro[id]) {

    if (cadastro[id].step === "nome") {
      cadastro[id].nome = text;
      cadastro[id].step = "whatsapp";
      return bot.sendMessage(msg.chat.id, "📱 WhatsApp:");
    }

    if (cadastro[id].step === "whatsapp") {
      cadastro[id].whatsapp = text;
      cadastro[id].step = "instagram";
      return bot.sendMessage(msg.chat.id, "📸 Instagram:");
    }

    if (cadastro[id].step === "instagram") {

      await db.collection("users").doc(id).set({
        id,
        nome: cadastro[id].nome,
        whatsapp: cadastro[id].whatsapp,
        instagram: text,
        criadoEm: Date.now(),
        vip: false
      });

      delete cadastro[id];

      bot.sendMessage(msg.chat.id, "✅ Cadastro concluído!");

      setTimeout(() => bot.sendMessage(msg.chat.id, menuUser()), 2000);

      iniciarIA(msg.chat.id);
    }
  }

  // ===== ADMIN PRODUTO =====
  if (adminState[id] && isAdmin(id)) {

    const s = adminState[id];

    if (!s.nome) {
      s.nome = text;
      return bot.sendMessage(id, "💰 Valor:");
    }

    if (!s.valor) {
      s.valor = text;
      return bot.sendMessage(id, "📝 Descrição:");
    }

    if (!s.descricao) {
      s.descricao = text;
      return bot.sendMessage(id, "👤 Vendedor:");
    }

    if (!s.vendedor) {
      s.vendedor = text;
      return bot.sendMessage(id, "📲 WhatsApp:");
    }

    if (!s.whatsapp) {
      s.whatsapp = text;

      await db.collection("produtos").add({
        nome: s.nome,
        valor: s.valor,
        descricao: s.descricao,
        vendedor: s.vendedor,
        whatsapp: s.whatsapp,
        criadoEm: Date.now()
      });

      delete adminState[id];

      return bot.sendMessage(id, "✅ Produto salvo no Firebase!");
    }
  }
});

// ================= MENU =================
function menuUser() {
  return `
📦 MENU

/produtos
/clientes_premium
/admin
/suporte
/status
/restart
/shutdown
`;
}

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  if (!(await checkAccess(msg))) return;

  const snap = await db.collection("produtos").get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, "Sem produtos.");

  snap.forEach(p => {
    const d = p.data();
    bot.sendMessage(msg.chat.id,
`📦 ${d.nome}
💰 ${d.valor}
📝 ${d.descricao}
👤 ${d.vendedor}
📲 ${d.whatsapp}`);
  });
});

// ================= ADMIN PANEL =================
bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙ ADMIN

/addproduto
/delprodutos
/deluser ID
/restart
/shutdown
`);
});

// ================= ADD PRODUTO =================
bot.onText(/\/addproduto/, (msg) => {
  if (!isAdmin(msg.from.id)) return;

  adminState[msg.from.id] = {};
  bot.sendMessage(msg.chat.id, "📦 Nome do produto:");
});

// ================= RESET RESTART =================
bot.onText(/\/restart/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  if (restartLock) return;

  restartLock = true;

  bot.sendMessage(msg.chat.id, "🔄 Confirmar restart: /confirmar_restart");
});

bot.onText(/\/confirmar_restart/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, "♻ Reiniciando bot...");

  setTimeout(() => process.exit(1), 3000);
});

// ================= SHUTDOWN =================
bot.onText(/\/shutdown/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  shutdownLock = true;

  bot.sendMessage(msg.chat.id, "🛑 Confirmar shutdown: /confirmar_shutdown");
});

bot.onText(/\/confirmar_shutdown/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, "⛔ Desligando bot...");

  setTimeout(() => process.exit(0), 3000);
});

// ================= IA =================
function iniciarIA(chatId) {

  if (iaTimer[chatId]) return;

  iaTimer[chatId] = setInterval(() => {
    bot.sendMessage(chatId, "🤖 Precisa de ajuda? Use /suporte");
  }, 60000);
}

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT PROFISSIONAL ONLINE");
});
