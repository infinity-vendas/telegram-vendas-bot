const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

// ================= CONFIG =================
const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";

const CHAVE_PIX = "Infinitycliente.pay.oficial@gmail.com";
const WHATSAPP = "https://wa.me/5551981528372";

const ADMINS = ["6863505946"];

// ================= FIREBASE =================
const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ================= BOT =================
const bot = new TelegramBot(TOKEN, { webHook: true });

const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ================= UTILS =================
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  await bot.sendPhoto(chatId, "https://i.postimg.cc/cJktrZVw/logo.jpg");

  const TEXTO = `
╔══════════════════════════════╗
        🌠 INFINITY CLIENTES
╚══════════════════════════════╝

🔥 Bem-vindo ao seu novo ponto de confiança

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Sistema automatizado  
⚡ Atendimento rápido  
⚡ Entregas seguras  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌠 Plataforma profissional e organizada

🔥 Aqui você não perde tempo  
⚡ Aqui você tem resultado  
🌠 Aqui você evolui  
`;

  setTimeout(() => bot.sendMessage(chatId, TEXTO), 2000);

  setTimeout(() => menuPrincipal(chatId), 4000);
});

// ================= MENU =================
function menuPrincipal(id) {
  bot.sendMessage(id, `
🌠 MENU PRINCIPAL

/produtos  
/id  
/suporte  
/admin  
`);
}

// ================= COMANDOS =================
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 Seu ID: ${msg.from.id}`);
});

bot.onText(/\/suporte/, (msg) => {
  bot.sendMessage(msg.chat.id, "📲 Fale com suporte:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "WhatsApp", url: WHATSAPP }]
      ]
    }
  });
});

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "❌ Nenhum produto disponível.");
  }

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `
📦 ${p.nome}
💰 R$ ${p.valor}

🆔 ID PRODUTO: ${doc.id}

👉 /comprar_${doc.id}
`);
  });
});

// ================= COMPRA =================
bot.onText(/\/comprar_(.+)/, async (msg, match) => {

  const produtoId = match[1];
  const userId = msg.from.id;

  const doc = await db.collection("produtos").doc(produtoId).get();
  if (!doc.exists) return;

  const p = doc.data();

  bot.sendMessage(msg.chat.id, `
💰 PAGAMENTO VIA PIX

📦 Produto: ${p.nome}
💰 Valor: R$ ${p.valor}

🔑 Chave PIX:
${CHAVE_PIX}

👤 Vendedor: INFINITY CLIENTES

⚠️ Após pagar, envie comprovante:
`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📲 Enviar comprovante", url: WHATSAPP }]
      ]
    }
  });

  // salva log
  await db.collection("logs").add({
    userId,
    produtoId,
    data: Date.now()
  });
});

// ================= ADMIN =================
bot.onText(/\/admin/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, `
⚙️ PAINEL ADMIN

/adicionar_produto  
/listar_produtos  
/deletar_produto ID  
/deletar_tudo  

/listar_usuarios  
/buscar_user ID  

/liberar ID_USER ID_PRODUTO  

/estoque ID VALOR  
`);
});

// ================= ADICIONAR =================
const adminState = {};

bot.onText(/\/adicionar_produto/, (msg) => {

  if (!isAdmin(msg.from.id)) return;

  adminState[msg.from.id] = { step: "nome" };
  bot.sendMessage(msg.chat.id, "Nome do produto:");
});

// ================= ADMIN FLOW =================
bot.on("message", async (msg) => {

  const id = msg.from.id;
  const a = adminState[id];

  if (!a || !isAdmin(id)) return;

  const text = msg.text;

  if (a.step === "nome") {
    a.nome = text;
    a.step = "valor";
    return bot.sendMessage(id, "Valor:");
  }

  if (a.step === "valor") {
    a.valor = Number(String(text).replace(",", "."));
    a.step = "descricao";
    return bot.sendMessage(id, "Descrição:");
  }

  if (a.step === "descricao") {
    a.descricao = text;
    a.step = "link";
    return bot.sendMessage(id, "Link:");
  }

  if (a.step === "link") {

    await db.collection("produtos").add({
      nome: a.nome,
      valor: a.valor,
      descricao: a.descricao,
      link: text,
      criadoEm: Date.now()
    });

    delete adminState[id];

    return bot.sendMessage(id, "✅ Produto cadastrado!");
  }
});

// ================= ADMIN EXTRA =================

// LISTAR PRODUTOS
bot.onText(/\/listar_produtos/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("produtos").get();

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, `
📦 ${p.nome}
💰 R$ ${p.valor}
🆔 ${doc.id}
`);
  });
});

// DELETAR PRODUTO
bot.onText(/\/deletar_produto (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  await db.collection("produtos").doc(match[1]).delete();

  bot.sendMessage(msg.chat.id, "🗑️ Produto deletado.");
});

// DELETAR TODOS
bot.onText(/\/deletar_tudo/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("produtos").get();

  snap.forEach(doc => doc.ref.delete());

  bot.sendMessage(msg.chat.id, "🗑️ Todos produtos removidos.");
});

// LISTAR USUÁRIOS (PELOS LOGS)
bot.onText(/\/listar_usuarios/, async (msg) => {

  if (!isAdmin(msg.from.id)) return;

  const snap = await db.collection("logs").get();

  snap.forEach(doc => {
    const l = doc.data();

    bot.sendMessage(msg.chat.id, `
👤 USER ID: ${l.userId}
📦 PRODUTO: ${l.produtoId}
`);
  });
});

// BUSCAR USER
bot.onText(/\/buscar_user (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const userId = match[1];

  bot.sendMessage(msg.chat.id, `🔎 USER ID: ${userId}`);
});

// ================= LIBERAR (CORRIGIDO) =================
bot.onText(/\/liberar (.+) (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const userId = match[1];
  const produtoId = match[2];

  const doc = await db.collection("produtos").doc(produtoId).get();

  if (!doc.exists) {
    return bot.sendMessage(msg.chat.id, "❌ Produto não encontrado.");
  }

  const p = doc.data();

  // entrega produto
  await bot.sendMessage(userId, `
╔════════════════════╗
   ✅ PAGAMENTO APROVADO
╚════════════════════╝

📦 Produto: ${p.nome}

🔗 Acesso:
${p.link}

🔥 Obrigado pela compra!
`);

  bot.sendMessage(msg.chat.id, `
✅ LIBERADO COM SUCESSO

👤 USER: ${userId}
📦 PRODUTO: ${produtoId}
`);
});

// ================= ESTOQUE =================
bot.onText(/\/estoque (.+) (.+)/, async (msg, match) => {

  if (!isAdmin(msg.from.id)) return;

  const id = match[1];
  const valor = Number(match[2]);

  await db.collection("produtos").doc(id).update({
    estoque: valor
  });

  bot.sendMessage(msg.chat.id, "📦 Estoque atualizado.");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("🚀 BOT EMPRESA GIGANTE ONLINE");
});
