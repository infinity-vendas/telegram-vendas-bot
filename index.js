const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const ADMINS = ["6863505946"];

// ===== IMAGENS =====
const LOGO = "https://i.postimg.cc/cJktrZVw/logo.jpg";
const BANNER2 = "https://i.postimg.cc/kXXL9B2z/farias.jpg";
const BANNER3 = "https://i.postimg.cc/LsBBWs6Y/tabela.jpg";

// ===== WHATSAPP =====
const WA1 = "https://wa.me/5595991314453";
const WA2 = "https://wa.me/5551981528372";

// ===== FIREBASE =====
const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bot = new TelegramBot(TOKEN);

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
const iaTimer = {};

// ===== UTIL =====
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

async function isRegistered(id) {
  const doc = await db.collection("users").doc(id).get();
  return doc.exists;
}

async function checkAccess(msg) {
  if (!(await isRegistered(String(msg.from.id)))) {
    bot.sendMessage(msg.chat.id, "❌ Complete seu cadastro usando /start");
    return false;
  }
  return true;
}

// ================= START (FUNIL COMPLETO) =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const user = await db.collection("users").doc(id).get();

  // ===== NOVO USUÁRIO =====
  if (!user.exists) {

    cadastro[id] = { step: "nome" };

    // IMG
    bot.sendPhoto(msg.chat.id, LOGO);

    // TEXTO 1
    setTimeout(() => {
      bot.sendMessage(msg.chat.id, `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!
Aqui você encontra um ambiente totalmente estruturado para facilitar sua experiência, com atendimento rápido, organizado e focado em entregar o melhor resultado possível para cada cliente. Nosso compromisso é com a transparência, a segurança e a satisfação de quem confia no nosso trabalho.

Na INFINITY CLIENTES você não perde tempo. Tudo foi pensado para ser simples, direto e eficiente. Desde o primeiro acesso, você já sente a diferença: um sistema automatizado, informações claras e suporte preparado para te atender sempre que precisar.

Trabalhamos diariamente para manter um padrão de qualidade elevado, oferecendo um espaço confiável onde clientes e vendedores podem interagir com tranquilidade. Aqui, cada detalhe importa, e cada cliente é tratado com atenção e respeito.

Digite seu nome para iniciar cadastro:
`);
    }, 6000);

    return;
  }

  // ===== USUÁRIO EXISTENTE =====

  bot.sendPhoto(msg.chat.id, LOGO);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, "⚡ Carregando sistema atualizado v1.6...");
  }, 6000);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, menuUser());
  }, 12000);

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
        criadoEm: Date.now()
      });

      delete cadastro[id];

      bot.sendMessage(msg.chat.id, "✅ Cadastro concluído!");

      // CONTINUA FUNIL
      setTimeout(() => {
        bot.sendPhoto(msg.chat.id, BANNER3);
      }, 6000);

      setTimeout(() => {
        bot.sendMessage(msg.chat.id, `
💰 PLANOS DISPONÍVEIS

Mensal R$60
Semanal R$30
Trial R$15
`);
      }, 12000);

      setTimeout(() => {
        bot.sendMessage(msg.chat.id, menuUser());
      }, 18000);

      return;
    }
  }
});

// ================= MENU =================
function menuUser() {
  return `
📦 MENU PRINCIPAL

/produtos
/vip
/me
/suporte
/planos
/ajuda
/status
`;
}

// ================= COMANDOS =================

// produtos
bot.onText(/\/produtos/, async (msg) => {
  if (!(await checkAccess(msg))) return;

  const snap = await db.collection("produtos").get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, "Sem produtos.");

  let txt = "📦 PRODUTOS:\n\n";

  snap.forEach(p => {
    const d = p.data();
    txt += `• ${d.nome} - R$ ${d.valor}\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// VIP FUNIL
bot.onText(/\/vip/, async (msg) => {

  if (!(await checkAccess(msg))) return;

  bot.sendMessage(msg.chat.id, `
🔥 TOP SERVIÇOS ⭐⭐⭐⭐⭐

Farias criação de sites profissional
`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔥 Adquirir serviço", callback_data: "vip1" }]
      ]
    }
  });

});

// suporte
bot.onText(/\/suporte/, (msg) => {
  bot.sendMessage(msg.chat.id, "📲 Suporte:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "WhatsApp", url: WA2 }]
      ]
    }
  });
});

// ================= CALLBACK =================
bot.on("callback_query", async (cb) => {

  const id = cb.from.id;

  if (cb.data === "vip1") {

    bot.sendPhoto(id, BANNER2);

    setTimeout(() => {
      bot.sendMessage(id, `
Atendimento rápido, seguro e profissional.

Fale agora com especialista:
`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📲 WhatsApp", url: WA1 }],
            [{ text: "➡ Próximo", callback_data: "vip2" }]
          ]
        }
      });
    }, 3000);
  }

  if (cb.data === "vip2") {

    bot.sendPhoto(id, BANNER3);

    setTimeout(() => {
      bot.sendMessage(id, `
INFINITY CLIENTES

💰 PLANOS:

Mensal R$60
Semanal R$30
Trial R$15
`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📲 Comprar agora", url: WA2 }]
          ]
        }
      });
    }, 3000);
  }

});

// ================= IA AUTOMÁTICA =================
function iniciarIA(chatId) {

  if (iaTimer[chatId]) return;

  iaTimer[chatId] = setInterval(() => {

    bot.sendMessage(chatId, "🤖 Precisa de ajuda? Digite /suporte");

  }, 6000);

}

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT FUNIL V1.6 ONLINE");
});
