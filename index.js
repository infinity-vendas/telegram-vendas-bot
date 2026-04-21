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

// ================= CONFIG =================
const OWNER = "INFINITY CLIENTE";
const BOT_VERSION = "PRO FINAL";

const ADMIN_WHATSAPP = "5551981528372";

// ================= PLANOS =================
const PLANOS = {
  trial: 1,
  semanal: 7,
  mensal: 30
};

// ================= LAYOUT (MANTIDO) =================
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

const MENU_TEXT = `
INFINITY STORE

/produtos
/status
/id
`;

// ================= CONTROLE =================
const cadastroStep = {};
const cadastroData = {};

const addStep = {};
const addData = {};

const deleteProductsConfirm = {};
const deleteUsersConfirm = {};

// ================= UTIL =================
function formatar(ms) {
  return new Date(ms).toLocaleString("pt-BR");
}

function gerarExpiracao(dias) {
  return Date.now() + dias * 86400000;
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
  setTimeout(() => bot.sendMessage(msg.chat.id, MENU_TEXT), 2000);
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
        userId: id,
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

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "Nenhum produto.");
  }

  let txt = "📦 Produtos:\n\n";

  snap.forEach(d => {
    const p = d.data();
    txt += `${p.nome} - R$ ${p.valor}\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// ================= ADD PRODUTO =================
bot.onText(/\/addprodutos/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  addStep[msg.from.id] = "nome";
  addData[msg.from.id] = {};

  bot.sendMessage(msg.chat.id, "Nome do produto:");
});

// ================= DELETE PRODUTOS =================
bot.onText(/\/deletarprodutos/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const snap = await db.collection("produtos").get();
  const batch = db.batch();

  snap.forEach(d => batch.delete(d.ref));

  await batch.commit();

  bot.sendMessage(msg.chat.id, "✔ Produtos deletados");
});

// ================= DELETE USERS =================
bot.onText(/\/deletarusuarios/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const snap = await db.collection("users").get();
  const batch = db.batch();

  snap.forEach(d => batch.delete(d.ref));

  await batch.commit();

  bot.sendMessage(msg.chat.id, "✔ Usuários deletados");
});

// ================= LISTAR USUÁRIOS =================
bot.onText(/\/listarusuarios/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const snap = await db.collection("users").get();

  let txt = "👥 USUÁRIOS REGISTRADOS:\n\n";

  snap.forEach(doc => {
    const d = doc.data();
    txt += `ID: ${doc.id}\nNome: ${d.nome}\nWhatsApp: ${d.whatsapp}\n\n`;
  });

  bot.sendMessage(msg.chat.id, txt);
});

// ================= VER USUÁRIO =================
bot.onText(/\/verusuario (.+)/, async (msg, match) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const id = match[1];

  const doc = await db.collection("users").doc(id).get();

  if (!doc.exists) {
    return bot.sendMessage(msg.chat.id, "Usuário não encontrado");
  }

  const d = doc.data();

  bot.sendMessage(msg.chat.id,
`👤 USUÁRIO

ID: ${id}
Nome: ${d.nome}
WhatsApp: ${d.whatsapp}
Criado: ${formatar(d.criadoEm)}`);
});

// ================= LIBERAR PLANO =================
bot.onText(/\/liberar (.+) (.+)/, async (msg, match) => {

  if (!ADMINS.includes(String(msg.from.id))) return;

  const userId = match[1];
  const plano = match[2];

  const dias = PLANOS[plano];

  if (!dias) return bot.sendMessage(msg.chat.id, "Plano inválido");

  await db.collection("alugueis").doc(userId).set({
    ativo: true,
    plano,
    expiraEm: gerarExpiracao(dias)
  });

  bot.sendMessage(userId,
`✔ Plano liberado

Envie print para análise:
WhatsApp: ${ADMIN_WHATSAPP}`);

  bot.sendMessage(msg.chat.id, "✔ Liberado");
});

// ================= STATUS =================
bot.onText(/\/status/, async (msg) => {

  const doc = await db.collection("alugueis").doc(String(msg.from.id)).get();

  if (!doc.exists) {
    return bot.sendMessage(msg.chat.id, "Sem plano ativo ⚠️");
  }

  bot.sendMessage(msg.chat.id,
`Plano: ${doc.data().plano}
Expira: ${formatar(doc.data().expiraEm)}`);
});

// ================= ID =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `ID: ${msg.from.id}`);
});

// ================= EXPIRA AUTOMÁTICO =================
setInterval(async () => {

  const snap = await db.collection("alugueis").get();

  snap.forEach(async (doc) => {

    const d = doc.data();

    if (d.ativo && Date.now() > d.expiraEm) {

      await db.collection("alugueis").doc(doc.id).update({
        ativo: false
      });

      bot.sendMessage(doc.id, "❌ Seu plano expirou.");
    }
  });

}, 60000);

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("BOT PRO FINAL 🚀");
});
