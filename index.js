require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// 🔐 CONFIG
const ADMIN_ID = "6863505946";

// 👨‍💼 VENDEDORES
const vendedoresAutorizados = [
  { nome: "Alyson", numero: "+55 35 91002-9714", cargo: "Vendedor" },
  { nome: "Nexus", numero: "+55 67 9624-4153", cargo: "Gerente" },
  { nome: "Bruno", numero: "+55 22 97406-2633", cargo: "Vendedor" },
  { nome: "Faelzin", numero: "+55 51981528372", cargo: "Líder Administrador" }
];

// 🔥 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🤖 Bot
const bot = new TelegramBot(process.env.BOT_TOKEN);

// 🔒 Webhook
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;
const url = process.env.RENDER_EXTERNAL_URL;

bot.setWebHook(`${url}${SECRET_PATH}`);

app.post(SECRET_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send("🔥 SellForge Online"));

// 🧠 Utils
const delay = (ms) => new Promise(res => setTimeout(res, ms));
const userCooldown = new Map();

const diasParaMs = d => d * 86400000;

// =============================
// 🚀 START
// =============================
bot.onText(/\/start$/, async (msg) => {
  const userId = String(msg.from.id);

  await bot.sendPhoto(msg.chat.id, "https://i.postimg.cc/Y9FHz03z/logo.jpg", {
    caption: `🔥 SELLFORGE BOT

👑 Dono: FAELZIN
📞 WhatsApp: 51981528372
⚙ Tipo: Aluguel`,
  });

  await bot.sendMessage(msg.chat.id, "⏳ Carregando...");
  await delay(3000);

  // ADMIN
  if (userId === ADMIN_ID) {
    return bot.sendMessage(msg.chat.id,
`👑 PAINEL ADMIN

/addproduto
/produtos
/meulink
/status
/listarusers
/vendedores
/resetprodutos
/delproduto ID
/resetar ID DIAS`);
  }

  // vendedor
  const produtos = await db.collection('produtos').doc(userId).collection('itens').get();

  if (!produtos.empty) {
    return bot.sendMessage(msg.chat.id,
`💼 PAINEL VENDEDOR

/addproduto
/produtos
/meulink
/status`);
  }

  bot.sendMessage(msg.chat.id, "👤 Use um link de vendedor.");
});

// =============================
// 🔗 REF
// =============================
bot.onText(/\/start (.+)/, async (msg, match) => {
  const vendedorId = match[1];

  const snap = await db.collection('produtos')
    .doc(vendedorId)
    .collection('itens')
    .get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, "❌ Nenhum produto.");

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id,
`${p.nome}
💰 ${p.preco}
${p.descricao}`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "Comprar", url: p.link }]]
        }
      }
    );
  });
});

// =============================
// 🛍️ ADD PRODUTO
// =============================
bot.onText(/\/addproduto/, msg => {
  bot.sendMessage(msg.chat.id, "Envie:\nnome | preco | descricao | link");
});

// =============================
// 📦 LISTAR PRODUTOS
// =============================
bot.onText(/\/produtos/, async msg => {
  const userId = String(msg.from.id);

  const snap = await db.collection('produtos')
    .doc(userId)
    .collection('itens')
    .get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, "❌ Nenhum produto.");

  snap.forEach(doc => {
    bot.sendMessage(msg.chat.id, `${doc.id} | ${doc.data().nome}`);
  });
});

// =============================
// 🔗 LINK
// =============================
bot.onText(/\/meulink/, msg => {
  const id = msg.from.id;
  bot.sendMessage(msg.chat.id, `https://t.me/SellForge_bot?start=${id}`);
});

// =============================
// ⏳ ATIVAR
// =============================
bot.onText(/\/ativar (.+)/, async (msg, m) => {
  const dias = parseInt(m[1]);
  if (isNaN(dias)) return;

  await db.collection('users').doc(String(msg.from.id)).set({
    expiraEm: Date.now() + diasParaMs(dias)
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "✅ Ativado");
});

// =============================
// 📊 STATUS
// =============================
bot.onText(/\/status/, async msg => {
  const doc = await db.collection('users').doc(String(msg.from.id)).get();

  if (!doc.exists || !doc.data().expiraEm)
    return bot.sendMessage(msg.chat.id, "❌ Sem plano");

  if (Date.now() > doc.data().expiraEm)
    return bot.sendMessage(msg.chat.id, "❌ Expirado");

  bot.sendMessage(msg.chat.id, "⏳ Ativo");
});

// =============================
// 👑 ADMIN
// =============================
bot.onText(/\/listarusers/, async msg => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const snap = await db.collection('users').get();
  bot.sendMessage(msg.chat.id, `👥 ${snap.size} usuários`);
});

bot.onText(/\/vendedores/, msg => {
  let t = "👨‍💼 Vendedores:\n\n";
  vendedoresAutorizados.forEach(v => {
    t += `${v.nome} - ${v.numero} (${v.cargo})\n`;
  });
  bot.sendMessage(msg.chat.id, t);
});

// 🗑️ deletar todos produtos
bot.onText(/\/resetprodutos/, async msg => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const col = await db.collection('produtos').get();

  for (const doc of col.docs) {
    const itens = await doc.ref.collection('itens').get();
    for (const item of itens.docs) {
      await item.ref.delete();
    }
  }

  bot.sendMessage(msg.chat.id, "🗑️ Tudo deletado");
});

// 🗑️ deletar produto
bot.onText(/\/delproduto (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const id = m[1];

  const userId = String(msg.from.id);

  await db.collection('produtos')
    .doc(userId)
    .collection('itens')
    .doc(id)
    .delete();

  bot.sendMessage(msg.chat.id, "🗑️ Produto removido");
});

// ⏳ resetar plano
bot.onText(/\/resetar (.+) (.+)/, async (msg, m) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const uid = m[1];
  const dias = parseInt(m[2]);

  await db.collection('users').doc(uid).set({
    expiraEm: Date.now() + diasParaMs(dias)
  }, { merge: true });

  bot.sendMessage(msg.chat.id, "⏳ Resetado");
});

// =============================
// 💾 SAVE USER + PRODUTO
// =============================
bot.on('message', async msg => {
  try {
    if (!msg.from) return;

    const id = String(msg.from.id);

    const now = Date.now();
    if (userCooldown.has(id) && now - userCooldown.get(id) < 2000) return;
    userCooldown.set(id, now);

    await db.collection('users').doc(id).set({
      id,
      nome: msg.from.first_name || "User"
    }, { merge: true });

    if (msg.text && msg.text.includes("|")) {
      const [nome, preco, descricao, link] = msg.text.split("|");

      await db.collection('produtos')
        .doc(id)
        .collection('itens')
        .add({
          nome: nome.trim(),
          preco: preco.trim(),
          descricao: descricao.trim(),
          link: link.trim()
        });

      bot.sendMessage(msg.chat.id, "✅ Produto cadastrado");
    }

  } catch {}
});

// 🚀 SERVER
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Rodando");
});
