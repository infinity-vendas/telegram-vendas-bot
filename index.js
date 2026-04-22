const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

// ===== CONFIG =====
const TOKEN = "SEU_TOKEN_NOVO";
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

// 🔥 IMPORTANTE
const bot = new TelegramBot(TOKEN, { webHook: true });

const app = express();
app.use(express.json());

// ===== WEBHOOK =====
app.post("/webhook", (req, res) => {
  try {
    bot.processUpdate(req.body);
  } catch (e) {
    console.log("Erro webhook:", e);
  }
  res.sendStatus(200);
});

// ===== MEMÓRIA =====
const cadastro = {};
const adminState = {};
const iaTimer = {};

// ===== TEMPOS =====
const TEMPOS = {
  "1h": 3600000,
  "24h": 86400000,
  "3d": 259200000,
  "7d": 604800000,
  "14d": 1209600000,
  "21d": 1814400000,
  "30d": 2592000000,
  "60d": 5184000000,
  "90d": 7776000000
};

// ===== UTIL =====
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

async function isRegistered(id) {
  try {
    const doc = await db.collection("users").doc(id).get();
    return doc.exists;
  } catch {
    return false;
  }
}

async function checkAccess(msg) {
  if (!(await isRegistered(String(msg.from.id)))) {
    bot.sendMessage(msg.chat.id, "❌ Faça cadastro com /start");
    return false;
  }
  return true;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);

  let user;
  try {
    user = await db.collection("users").doc(id).get();
  } catch (e) {
    return bot.sendMessage(msg.chat.id, "Erro no banco.");
  }

  bot.sendPhoto(msg.chat.id, LOGO);

  const TEXTO = `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!

INFINITY CLIENTES – confiança, organização e resultado em um só lugar
`;

  if (!user.exists) {

    cadastro[id] = { step: "nome" };

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, TEXTO + "\n\nDigite seu nome:");
    }, 2000);

    return;
  }

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, TEXTO);
  }, 2000);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, menuUser());
  }, 4000);

  iniciarIA(msg.chat.id);
});

// ================= CADASTRO =================
bot.on("message", async (msg) => {

  const id = String(msg.from.id);
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  if (cadastro[id]) {

    const s = cadastro[id];

    if (s.step === "nome") {
      s.nome = text;
      s.step = "whatsapp";
      return bot.sendMessage(msg.chat.id, "📱 WhatsApp:");
    }

    if (s.step === "whatsapp") {
      s.whatsapp = text;
      s.step = "instagram";
      return bot.sendMessage(msg.chat.id, "📸 Instagram:");
    }

    if (s.step === "instagram") {

      await db.collection("users").doc(id).set({
        id,
        nome: s.nome,
        whatsapp: s.whatsapp,
        instagram: text,
        criadoEm: Date.now(),
        vip: false
      });

      delete cadastro[id];

      bot.sendMessage(msg.chat.id, "✅ Cadastro concluído!");
      setTimeout(() => bot.sendMessage(msg.chat.id, menuUser()), 2000);

      iniciarIA(msg.chat.id);
      return;
    }
  }

  // ===== ADMIN PRODUTO =====
  if (adminState[id] && isAdmin(id)) {

    const s = adminState[id];

    if (s.step === "nome") {
      s.nome = text;
      s.step = "valor";
      return bot.sendMessage(id, "💰 Valor:");
    }

    if (s.step === "valor") {
      s.valor = text;
      s.step = "descricao";
      return bot.sendMessage(id, "📝 Descrição:");
    }

    if (s.step === "descricao") {
      s.descricao = text;
      s.step = "vendedor";
      return bot.sendMessage(id, "👤 Vendedor:");
    }

    if (s.step === "vendedor") {
      s.vendedor = text;
      s.step = "instagram";
      return bot.sendMessage(id, "📸 Instagram:");
    }

    if (s.step === "instagram") {
      s.instagram = text;
      s.step = "youtube";
      return bot.sendMessage(id, "📺 YouTube:");
    }

    if (s.step === "youtube") {
      s.youtube = text;
      s.step = "whatsapp";
      return bot.sendMessage(id, "📲 WhatsApp:");
    }

    if (s.step === "whatsapp") {

      await db.collection("produtos").add({
        nome: s.nome,
        valor: s.valor,
        descricao: s.descricao,
        vendedor: s.vendedor,
        instagram: s.instagram,
        youtube: s.youtube,
        whatsapp: text,
        criadoEm: Date.now()
      });

      delete adminState[id];

      return bot.sendMessage(id, "✅ Produto cadastrado!");
    }
  }
});

// ================= MENU =================
function menuUser() {
  return `
📦 MENU PRINCIPAL

/produtos
/clientes_premium
/administradores
/suporte
/status
/admin
`;
}

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  if (!(await checkAccess(msg))) return;

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "Sem produtos.");
  }

  snap.forEach(p => {
    const d = p.data();

    bot.sendMessage(msg.chat.id, `
📦 ${d.nome}
💰 R$ ${d.valor}

📝 ${d.descricao}

👤 ${d.vendedor}
📲 ${d.whatsapp}
`);
  });
});

// ================= ADMIN =================
bot.onText(/\/admin/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙ ADMIN

/addproduto
/delprodutos
/deluser ID
/ids
/vip ID
/removervip ID
/reset ID tempo

Ex: /reset 123456 7d
`);
});

// ================= RESET =================
bot.onText(/\/reset (.+) (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const userId = match[1];
  const tempo = match[2];

  if (!TEMPOS[tempo]) {
    return bot.sendMessage(msg.chat.id, "❌ Tempo inválido");
  }

  try {
    await db.collection("alugueis").doc(userId).set({
      ativo: true,
      plano: tempo,
      expiraEm: Date.now() + TEMPOS[tempo]
    }, { merge: true });

    bot.sendMessage(msg.chat.id, "✅ Reset aplicado");
  } catch (e) {
    bot.sendMessage(msg.chat.id, "Erro ao resetar");
  }
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
  try {
    await bot.setWebHook(`${URL}/webhook`);
    console.log("🚀 BOT ONLINE V1.9 FIX");
  } catch (e) {
    console.log("Erro webhook:", e);
  }
});
