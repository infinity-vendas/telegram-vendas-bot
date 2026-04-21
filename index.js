const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const ADMINS = ["6863505946"];

// 🔥 LOGO
const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";

// 🎤 ÁUDIO
const AUDIO = "https://files.catbox.moe/9dv9ln.mp3";

// 💳 PIX
const PIX_QR = "https://i.postimg.cc/c1hS77Rh/Qr-Code.jpg";
const PIX_KEY = "51981528372";
const PIX_NAME = "RAPHAEL DE MATOS";

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
    console.log("Webhook error:", e);
  }
  res.sendStatus(200);
});

// ================= TEMPOS =================
const TEMPOS = {
  "1min": 60000,
  "10min": 600000,
  "30min": 1800000,
  "60min": 3600000,
  "7d": 604800000,
  "14d": 1209600000,
  "21d": 1814400000,
  "30d": 2592000000
};

// ================= LAYOUT =================
const START_TEXT = `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!

Na INFINITY CLIENTES você não perde tempo. Tudo foi pensado para ser simples, direto e eficiente.

INFINITY CLIENTES – confiança, organização e resultado em um só lugar.
`;

const MENU_TEXT = `
📦 MENU PRINCIPAL

/produtos
/status
/id
/admin
`;

// ================= EXPIRADO =================
function expiredMessage() {
  return `
❌ PLANO EXPIRADO OU INEXISTENTE

💳 PIX: ${PIX_KEY}
👤 ${PIX_NAME}

📷 QR CODE:
${PIX_QR}

Envie:
- Comprovante
- Data
- Horário

Após confirmação seu acesso será reativado automaticamente.
`;
}

// ================= MEMORY =================
const cadastro = {};
const adminState = {};

// ================= UTIL =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {
  const id = String(msg.from.id);

  try {
    const user = await db.collection("users").doc(id).get();

    if (!user.exists) {
      cadastro[id] = { step: "nome" };

      return bot.sendPhoto(msg.chat.id, LOGO, {
        caption: "👤 Digite seu nome:"
      });
    }

    await bot.sendPhoto(msg.chat.id, LOGO, {
      caption: START_TEXT
    });

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, MENU_TEXT);
    }, 1000);

  } catch (e) {
    bot.sendMessage(msg.chat.id, "Erro no sistema.");
  }
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

      await db.collection("users").doc(id).set({
        nome: cadastro[id].nome,
        whatsapp: cadastro[id].whatsapp,
        criadoEm: Date.now()
      });

      delete cadastro[id];

      // 🎤 ÁUDIO (SÓ APÓS CADASTRO)
      bot.sendAudio(msg.chat.id, AUDIO);

      setTimeout(() => {
        bot.sendMessage(msg.chat.id, "⏳ Aguarde a liberação...");
      }, 3000);

      setTimeout(() => {
        bot.sendPhoto(msg.chat.id, LOGO, {
          caption: START_TEXT
        });
      }, 12000);

      setTimeout(() => {
        bot.sendMessage(msg.chat.id, MENU_TEXT);
      }, 17000);

      return;
    }
  }

  // ================= ADMIN FLOW =================
  if (adminState[id] && isAdmin(id)) {

    if (adminState[id].step === "nome") {
      adminState[id].nome = text;
      adminState[id].step = "valor";
      return bot.sendMessage(id, "💰 Valor:");
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

  if (!doc.exists || !doc.data()?.ativo) {
    return bot.sendMessage(msg.chat.id, expiredMessage());
  }

  bot.sendMessage(msg.chat.id, `📊 STATUS\n\nPlano: ${doc.data().plano}`);
});

// ================= ADMIN =================
bot.onText(/\/admin/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const buttons = [
    [{ text: "➕ Add Produto", callback_data: "add_product" }],
    [{ text: "❌ Deletar Produtos", callback_data: "del_products" }]
  ];

  Object.keys(TEMPOS).forEach(t => {
    buttons.push([{
      text: `⏱ Reset ${t}`,
      callback_data: `reset_${t}`
    }]);
  });

  bot.sendMessage(msg.chat.id, "⚙ PAINEL ADMIN:", {
    reply_markup: { inline_keyboard: buttons }
  });
});

// ================= CALLBACK =================
bot.on("callback_query", async (cb) => {

  const id = cb.from.id;
  const data = cb.data;

  if (!isAdmin(id)) return;

  if (data === "add_product") {
    adminState[id] = { step: "nome" };
    return bot.sendMessage(id, "Nome do produto:");
  }

  if (data === "del_products") {
    const snap = await db.collection("produtos").get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return bot.sendMessage(id, "❌ Produtos deletados");
  }

  if (data.startsWith("reset_")) {

    const tempo = data.replace("reset_", "");

    const users = await db.collection("users").get();

    users.forEach(async (u) => {
      await db.collection("alugueis").doc(u.id).set({
        ativo: true,
        expiraEm: Date.now() + TEMPOS[tempo],
        plano: tempo
      }, { merge: true });
    });

    return bot.sendMessage(id, `✔ Reset aplicado: ${tempo}`);
  }
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 INFINITY CLIENTES ONLINE");
});
