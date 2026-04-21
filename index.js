const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const ADMINS = ["6863505946"];
const ADMIN_WHATSAPP = "5551981528372";

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

// ================= CONFIG =================
const OWNER = "INFINITY CLIENTE";
const BOT_VERSION = "PRO FINAL";

// ================= PLANOS =================
const PLANOS = {
  trial: 1,
  semanal: 7,
  mensal: 30
};

// ================= LAYOUT ORIGINAL =================
const START_TEXT = `
Dono: INFINITY CLIENTE
Validity: 25,00
Created by: @Infity_cliente_oficial
Parcerias: nenhuma
vendedores (1) admin
divulgadores: nenhum
Facebook: indisponível
Instagram: disponível
YouTube: Em Breve
TikTok: indisponível
Kwai: indisponível
patrocinadores: nenhum

Aceitamos pagamento Pix / cartão: em breve!
Transições 100% manual e seguras
¡compre somente comigo atualmente!

Unidos , fortes venceremos !
`;

// ================= MENU =================
const MENU_TEXT = `
📦 INFINITY STORE

👤 USUÁRIO:
/produtos
/status
/id

🛠 ADMIN:
/admin
`;

// ================= MEMORY =================
const cadastroStep = {};
const cadastroData = {};

const adminState = {};
const productState = {};

// ================= UTIL =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

function formatar(ms) {
  return new Date(ms).toLocaleString("pt-BR");
}

function gerarExpiracao(ms) {
  return Date.now() + ms;
}

// ================= PARSE DATA =================
function parseDataBR(input) {
  const [d1, t1] = input.split(" ");
  const [d, m, y] = d1.split("/");
  const [h, mi, s] = (t1 || "00:00:00").split(":");
  return new Date(y, m - 1, d, h, mi, s).getTime();
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const id = String(msg.from.id);
  const doc = await db.collection("users").doc(id).get();

  if (!doc.exists) {
    cadastroStep[id] = "nome";
    cadastroData[id] = {};

    return bot.sendMessage(msg.chat.id,
`🚀 Cadastro obrigatório

Seu ID: ${id}

Digite seu nome:`);
  }

  bot.sendMessage(msg.chat.id, START_TEXT);
  setTimeout(() => bot.sendMessage(msg.chat.id, MENU_TEXT), 1500);
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
      return bot.sendMessage(msg.chat.id, "WhatsApp:");
    }

    if (cadastroStep[id] === "whatsapp") {

      cadastroData[id].whatsapp = text;

      await db.collection("users").doc(id).set({
        ...cadastroData[id],
        criadoEm: Date.now()
      });

      delete cadastroStep[id];
      delete cadastroData[id];

      return bot.sendMessage(msg.chat.id, "✔ Cadastro concluído");
    }
  }
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  let txt = "📦 PRODUTOS:\n\n";

  snap.forEach(d => {
    const p = d.data();
    txt += `${p.nome} - R$ ${p.valor}\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// ================= STATUS =================
bot.onText(/\/status/, async (msg) => {

  const doc = await db.collection("alugueis").doc(String(msg.from.id)).get();

  if (!doc.exists) return bot.sendMessage(msg.chat.id, "Sem plano");

  bot.sendMessage(msg.chat.id,
`Plano: ${doc.data().plano}
Expira: ${formatar(doc.data().expiraEm)}`);
});

// ================= ID =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `ID: ${msg.from.id}`);
});

// =====================================================
// 🔥 PAINEL ADMIN (BOTÕES)
// =====================================================
bot.onText(/\/admin/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, "⚙ PAINEL ADMIN", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👥 Usuários", callback_data: "users" }],
        [{ text: "📦 Produtos", callback_data: "products" }],
        [{ text: "➕ Add Produto", callback_data: "add_product" }],
        [{ text: "➕ Add Usuário", callback_data: "add_user" }],
        [{ text: "❌ Deletar Users", callback_data: "del_users" }],
        [{ text: "❌ Deletar Produtos", callback_data: "del_products" }]
      ]
    }
  });
});

// ================= CALLBACKS =================
bot.on("callback_query", async (cb) => {

  const id = cb.from.id;
  const data = cb.data;

  if (!isAdmin(id)) return;

  // USUÁRIOS
  if (data === "users") {
    const snap = await db.collection("users").get();
    let txt = "👥 USERS:\n\n";

    snap.forEach(d => {
      txt += `ID: ${d.id}\nNome: ${d.data().nome}\n\n`;
    });

    return bot.sendMessage(id, txt);
  }

  // PRODUTOS
  if (data === "products") {
    const snap = await db.collection("produtos").get();
    let txt = "📦 PRODUTOS:\n\n";

    snap.forEach(d => {
      txt += `${d.data().nome} - R$ ${d.data().valor}\n`;
    });

    return bot.sendMessage(id, txt);
  }

  // DELETE USERS
  if (data === "del_users") {
    const snap = await db.collection("users").get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return bot.sendMessage(id, "✔ Users deletados");
  }

  // DELETE PRODUCTS
  if (data === "del_products") {
    const snap = await db.collection("produtos").get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return bot.sendMessage(id, "✔ Produtos deletados");
  }

});

// ================= LIBERAR PLANO =================
bot.onText(/\/liberar (.+) (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const userId = match[1];
  const plano = match[2];

  const dias = PLANOS[plano];
  if (!dias) return;

  const expiraEm = gerarExpiracao(dias * 86400000);

  await db.collection("alugueis").doc(userId).set({
    ativo: true,
    plano,
    expiraEm,
    avisos: {}
  });

  bot.sendMessage(userId, "✔ Plano liberado");
});

// ================= ALERTAS =================
setInterval(async () => {

  const snap = await db.collection("alugueis").get();

  snap.forEach(async (doc) => {

    const d = doc.data();
    const now = Date.now();
    const diff = d.expiraEm - now;

    if (diff < 86400000 && !d.avisos?.h24) {
      bot.sendMessage(doc.id, "⚠ 24h restantes");
      await db.collection("alugueis").doc(doc.id).update({ "avisos.h24": true });
    }

    if (diff < 3600000 && !d.avisos?.h1) {
      bot.sendMessage(doc.id, "⚠ 1h restante");
      await db.collection("alugueis").doc(doc.id).update({ "avisos.h1": true });
    }

    if (d.ativo && now > d.expiraEm) {
      await db.collection("alugueis").doc(doc.id).update({ ativo: false });
      bot.sendMessage(doc.id, "❌ Expirado");
    }

  });

}, 60000);

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("BOT PRO PAINEL ATIVO 🚀");
});
