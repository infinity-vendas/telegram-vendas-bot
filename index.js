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

// 🔥 WHATSAPP LINKS
const WA1 = "https://wa.me/5595991314453";
const WA2 = "https://wa.me/5551981528372";

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

// ================= MEMORY =================
const cadastro = {};

// ================= CHECK CADASTRO =================
async function isRegistered(id) {
  const user = await db.collection("users").doc(id).get();
  return user.exists;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);

  const user = await db.collection("users").doc(id).get();

  // 🔥 NOVO USUÁRIO
  if (!user.exists) {

    cadastro[id] = { step: "nome" };

    bot.sendPhoto(msg.chat.id, LOGO);

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!
Aqui você encontra um ambiente totalmente estruturado para facilitar sua experiência, com atendimento rápido, organizado e focado em entregar o melhor resultado possível para cada cliente. Nosso compromisso é com a transparência, a segurança e a satisfação de quem confia no nosso trabalho.

Na INFINITY CLIENTES você não perde tempo. Tudo foi pensado para ser simples, direto e eficiente. Desde o primeiro acesso, você já sente a diferença.

Digite seu nome para iniciar cadastro:
`);
    }, 2000);

    return;
  }

  // 🔥 USUÁRIO JÁ CADASTRADO
  bot.sendPhoto(msg.chat.id, LOGO);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, "Carregando sistema atualizado v1.4...");
  }, 3000);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, `
📦 MENU PRINCIPAL

/produtos
/Lista_users_VIP
/users
/afiliado
/moderadores
/denunciar_produto
/denunciar_vendedor
`);
  }, 6000);

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

      cadastro[id].instagram = text;

      await db.collection("users").doc(id).set({
        id,
        nome: cadastro[id].nome,
        whatsapp: cadastro[id].whatsapp,
        instagram: cadastro[id].instagram,
        criadoEm: Date.now()
      });

      delete cadastro[id];

      bot.sendMessage(msg.chat.id, "✅ Cadastro concluído!");

      setTimeout(() => {
        bot.sendMessage(msg.chat.id, "Carregando sistema atualizado v1.4...");
      }, 3000);

      setTimeout(() => {
        bot.sendMessage(msg.chat.id, `
📦 MENU PRINCIPAL

/produtos
/Lista_users_VIP
/users
/afiliado
/moderadores
/denunciar_produto
/denunciar_vendedor
`);
      }, 6000);

      return;
    }
  }
});

// ================= BLOQUEIO =================
async function checkAccess(msg) {
  const ok = await isRegistered(String(msg.from.id));
  if (!ok) {
    bot.sendMessage(msg.chat.id, "❌ Complete seu cadastro primeiro com /start");
    return false;
  }
  return true;
}

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  if (!(await checkAccess(msg))) return;

  const snap = await db.collection("produtos").get();

  let txt = "📦 PRODUTOS:\n\n";

  snap.forEach(p => {
    const d = p.data();
    txt += `• ${d.nome} - R$ ${d.valor}\n`;
  });

  bot.sendMessage(msg.chat.id, txt || "Sem produtos");
});

// ================= VIP =================
bot.onText(/\/Lista_users_VIP/, async (msg) => {

  if (!(await checkAccess(msg))) return;

  bot.sendMessage(msg.chat.id, `
🔥 Top Melhores Serviços ⭐⭐⭐⭐⭐

Farias criação de sites rápido e avançados (Profissional)
`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔥 Adquirir serviço", callback_data: "vip1" }]
      ]
    }
  });

});

// ================= CALLBACK =================
bot.on("callback_query", async (cb) => {

  const data = cb.data;
  const id = cb.from.id;

  if (data === "vip1") {

    bot.sendPhoto(id, BANNER2, {
      caption: "Atendimento rápido e profissional."
    });

    return bot.sendMessage(id, "Contato:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📲 WhatsApp", url: WA1 }],
          [{ text: "➡ Próximo", callback_data: "vip2" }]
        ]
      }
    });
  }

  if (data === "vip2") {

    bot.sendPhoto(id, BANNER3);

    return bot.sendMessage(id, "INFINITY CLIENTES planos:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📲 WhatsApp", url: WA2 }]
        ]
      }
    });
  }

});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT ONLINE V1.4");
});
