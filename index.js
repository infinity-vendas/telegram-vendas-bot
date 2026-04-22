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

// ===== TEMPOS RESET =====
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
  const doc = await db.collection("users").doc(id).get();
  return doc.exists;
}

async function checkAccess(msg) {
  if (!(await isRegistered(String(msg.from.id)))) {
    bot.sendMessage(msg.chat.id, "❌ Complete cadastro com /start");
    return false;
  }
  return true;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const user = await db.collection("users").doc(id).get();

  bot.sendPhoto(msg.chat.id, LOGO);

  const TEXTO = `
Bem-vindo à INFINITY CLIENTES, o seu novo ponto de confiança para serviços, produtos e oportunidades reais dentro do Telegram!
Aqui você encontra um ambiente totalmente estruturado para facilitar sua experiência, com atendimento rápido, organizado e focado em entregar o melhor resultado possível para cada cliente. Nosso compromisso é com a transparência, a segurança e a satisfação de quem confia no nosso trabalho.
Na INFINITY CLIENTES você não perde tempo. Tudo foi pensado para ser simples, direto e eficiente. Desde o primeiro acesso, você já sente a diferença: um sistema automatizado, informações claras e suporte preparado para te atender sempre que precisar.
Trabalhamos diariamente para manter um padrão de qualidade elevado, oferecendo um espaço confiável onde clientes e vendedores podem interagir com tranquilidade. Aqui, cada detalhe importa, e cada cliente é tratado com atenção e respeito.
Se você está chegando agora, seja muito bem-vindo! Você acaba de entrar em uma plataforma criada para crescer, evoluir e entregar resultados de verdade. Explore, conheça nossos serviços e aproveite tudo o que preparamos para você.
INFINITY CLIENTES – confiança, organização e resultado em um só lugar
`;

  if (!user.exists) {

    cadastro[id] = { step: "nome" };

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, TEXTO + "\n\nDigite seu nome:");
    }, 3000);

    return;
  }

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, TEXTO);
  }, 3000);

  setTimeout(() => {
    bot.sendMessage(msg.chat.id, menuUser());
  }, 6000);

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

      setTimeout(() => {
        bot.sendMessage(msg.chat.id, menuUser());
      }, 3000);

      iniciarIA(msg.chat.id);
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
        ...s,
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

  if (snap.empty) return bot.sendMessage(msg.chat.id, "Sem produtos.");

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

// ===== RESET TEMPO =====
bot.onText(/\/reset (.+) (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const userId = match[1];
  const tempo = match[2];

  if (!TEMPOS[tempo]) {
    return bot.sendMessage(msg.chat.id, "❌ Tempo inválido");
  }

  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return bot.sendMessage(msg.chat.id, "❌ Usuário não encontrado");
  }

  await db.collection("alugueis").doc(userId).set({
    ativo: true,
    plano: tempo,
    expiraEm: Date.now() + TEMPOS[tempo]
  }, { merge: true });

  bot.sendMessage(msg.chat.id, `✅ Reset aplicado (${tempo}) para ${userDoc.data().nome}`);
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
  console.log("🚀 BOT V1.9 ONLINE");
});
