const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const ADMINS = ["6863505946"];

// 🔥 IMAGENS
const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";
const BANNER2 = "https://i.postimg.cc/kXXL9B2z/farias.jpg";
const BANNER3 = "https://i.postimg.cc/LsBBWs6Y/tabela.jpg";

// 💬 WHATSAPP
const WHATSAPP1 = "https://wa.me/5595991314453";
const WHATSAPP2 = "https://wa.me/551981528372";

// ================= FIREBASE =================
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

// ================= TEXTO PRINCIPAL =================
const TEXTO1 = `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!

Aqui você encontra um ambiente totalmente estruturado para facilitar sua experiência, com atendimento rápido, organizado e focado em entregar o melhor resultado possível para cada cliente. Nosso compromisso é com a transparência, a segurança e a satisfação de quem confia no nosso trabalho.

Na INFINITY CLIENTES você não perde tempo. Tudo foi pensado para ser simples, direto e eficiente. Desde o primeiro acesso, você já sente a diferença: um sistema automatizado, informações claras e suporte preparado para te atender sempre que precisar.

Trabalhamos diariamente para manter um padrão de qualidade elevado, oferecendo um espaço confiável onde clientes e vendedores podem interagir com tranquilidade. Aqui, cada detalhe importa, e cada cliente é tratado com atenção e respeito.

Se você está chegando agora, seja muito bem-vindo! Você acaba de entrar em uma plataforma criada para crescer, evoluir e entregar resultados de verdade. Explore, conheça nossos serviços e aproveite tudo o que preparamos para você.

INFINITY CLIENTES – confiança, organização e resultado em um só lugar
`;

const TEXTO2 = `
Selecione o tipo de serviço que deseja iniciar atendimento:

Farias criação de sites rápido e avançados (Profissional)
`;

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  try {

    // 1️⃣ LOGO PRINCIPAL
    await bot.sendPhoto(chatId, LOGO);

    // 2️⃣ TEXTO 1
    await bot.sendMessage(chatId, TEXTO1);

    // 3️⃣ TEXTO 2
    await bot.sendMessage(chatId, TEXTO2, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📌 Mais informações", callback_data: "info1" }]
        ]
      }
    });

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "Erro ao iniciar.");
  }
});

// ================= CALLBACK =================
bot.on("callback_query", async (cb) => {

  const chatId = cb.message.chat.id;

  // ===== BANNER 2 =====
  if (cb.data === "info1") {

    return bot.sendPhoto(chatId, BANNER2, {
      caption: `
💬 Atendimento online rápido e seguro

Fale agora com:
👤 Jesus Farias

Desenvolvimento profissional de sites
Sem burocracia, suporte direto
      `,
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 WhatsApp", url: WHATSAPP1 }],
          [{ text: "📌 Mais informações", callback_data: "info2" }]
        ]
      }
    });
  }

  // ===== BANNER 3 =====
  if (cb.data === "info2") {

    return bot.sendPhoto(chatId, BANNER3, {
      caption: `
💬 Atendimento online rápido e seguro

Fale agora com dono oficial:
🔥 INFINITY CLIENTES

📦 Bots Telegram + aluguel semanal, trial e mensal

📢 Planos:
• Mensal: $60
• Semanal: $30
• Trial: $15

🚀 Sistemas automáticos e suporte 24h
      `,
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 WhatsApp", url: WHATSAPP2 }]
        ]
      }
    });
  }
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  try {
    await bot.setWebHook(`${URL}/webhook`);
    console.log("🚀 BOT ONLINE:", `${URL}/webhook`);
  } catch (e) {
    console.log("Webhook error:", e);
  }
});
