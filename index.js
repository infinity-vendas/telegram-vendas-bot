const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const ADMINS = ["6863505946"];

// 🔥 ASSETS
const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";
const BANNER = "https://i.postimg.cc/LsBBWs6Y/tabela.jpg";

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

// ================= TEXTOS =================
const TEXTO1 = `📊 Confira nossa tabela de preços atualizada!

Chegou a hora de você divulgar seus produtos em nosso servidor Telegram.

📅 Empresa cadastrada: 22/04/2026  
🚀 Estamos em busca de novos clientes e parceiros.

Em breve você receberá nossos produtos oficiais.`;

const TEXTO2 = `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!

Aqui você encontra um ambiente totalmente estruturado para facilitar sua experiência.

INFINITY CLIENTES – confiança, organização e resultado em um só lugar.
`;

// ================= MENUS =================
const MENU_USER = `
📦 MENU COMPLETO

/Adquirir produto
/Suporte
`;

const MENU_ADMIN = `
⚙ MENU ADMIN

/Deletar_users
/Deletar_produtos
/Adicionar_produto
`;

// ================= START FLOW =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  try {

    // 1️⃣ LOGO
    await bot.sendPhoto(chatId, LOGO);

    // delay 6s
    await new Promise(r => setTimeout(r, 6000));

    // 2️⃣ TEXTO 1
    await bot.sendMessage(chatId, TEXTO1);

    await new Promise(r => setTimeout(r, 6000));

    // 3️⃣ TEXTO 2
    await bot.sendMessage(chatId, TEXTO2);

    await new Promise(r => setTimeout(r, 6000));

    // 4️⃣ BANNER
    await bot.sendPhoto(chatId, BANNER);

    await new Promise(r => setTimeout(r, 6000));

    // 5️⃣ BOTÃO CATALOGO
    await bot.sendMessage(chatId, "👇 Escolha seu plano abaixo:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📦 Abrir Catálogo", callback_data: "catalogo" }]
        ]
      }
    });

    await new Promise(r => setTimeout(r, 6000));

    // 6️⃣ LISTA PRODUTOS
    await bot.sendMessage(chatId,
`🔥 Mais vendidos:

• Contas Google
• Contas Free Fire
• Pack Sensibilidade
`);

    await new Promise(r => setTimeout(r, 6000));

    // 7️⃣ LOADING
    await bot.sendMessage(chatId, "⏳ Carregando sistema...");

    await new Promise(r => setTimeout(r, 6000));

    // 8️⃣ MENU FINAL
    await bot.sendMessage(chatId, MENU_USER);

    // admin menu extra
    if (ADMINS.includes(String(msg.from.id))) {
      await bot.sendMessage(chatId, MENU_ADMIN);
    }

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "Erro ao iniciar sistema.");
  }
});

// ================= CALLBACK =================
bot.on("callback_query", async (cb) => {

  const chatId = cb.message.chat.id;

  if (cb.data === "catalogo") {
    return bot.sendMessage(chatId,
`📦 CATÁLOGO:

/Adquirir produto
/Suporte`);
  }
});

// ================= PRODUTOS =================
bot.onText(/\/Adquirir produto/, async (msg) => {

  const snap = await db.collection("produtos").get();

  let txt = "📦 PRODUTOS DISPONÍVEIS:\n\n";

  snap.forEach(p => {
    const d = p.data();
    txt += `• ${d.nome} - R$ ${d.valor}\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// ================= SUPORTE =================
bot.onText(/\/Suporte/, (msg) => {
  bot.sendMessage(msg.chat.id,
`📞 SUPORTE

WhatsApp:
https://wa.me/${PIX_KEY}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  try {
    await bot.setWebHook(`${URL}/webhook`);
    console.log("🚀 BOT ONLINE:", `${URL}/webhook`);
  } catch (e) {
    console.log("Erro webhook:", e);
  }
});
